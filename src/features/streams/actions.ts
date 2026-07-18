"use server";

import type {
    NatsConnectionConfig,
    StreamMessage,
    GetStreamMessagesOptions,
    PurgeStreamOptions,
    JetStreamAccountOverview,
} from "@/types/nats";
import type {
    StreamConfig,
    StreamInfo,
    StreamUpdateConfig,
    ConsumerConfig,
    ConsumerInfo,
    ConsumerUpdateConfig,
    PurgeOpts,
} from "nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

// ──────────────────────────────────────────────────────────────────────────────
// Streams
// ──────────────────────────────────────────────────────────────────────────────

/** List all JetStream streams on the active connection. */
export async function listStreams(
    config: NatsConnectionConfig
): Promise<ActionResponse<StreamInfo[]>> {
    return withJetStream(config, "listStreams", async ({ jsm }) => {
        const streamList: StreamInfo[] = [];
        const iter = await jsm.streams.list();
        for await (const s of iter) {
            streamList.push(s);
        }
        return streamList;
    });
}

/** Create a new JetStream stream from a `StreamConfig`. Fails on name collision. */
export async function createStream(
    config: NatsConnectionConfig,
    streamConfig: StreamConfig
): Promise<ActionResponse<StreamInfo>> {
    return withJetStream(config, "createStream", async ({ jsm }) => {
        return await jsm.streams.add(streamConfig);
    });
}

/** Delete a stream and all its messages. Irreversible. */
export async function deleteStream(
    config: NatsConnectionConfig,
    streamName: string
): Promise<ActionResponse<boolean>> {
    return withJetStream(config, "deleteStream", async ({ jsm }) => {
        return await jsm.streams.delete(streamName);
    });
}

/**
 * Delete a single message from a stream by sequence number.
 * When `erase` is true (default), the payload is securely erased when the backend supports it.
 */
export async function deleteStreamMessage(
    config: NatsConnectionConfig,
    streamName: string,
    seq: number,
    erase = true
): Promise<ActionResponse<boolean>> {
    return withJetStream(config, "deleteStreamMessage", async ({ jsm }) => {
        return await jsm.streams.deleteMessage(streamName, seq, erase);
    });
}

/** Fetch current config + state (messages, bytes, seq range) for a single stream. */
export async function getStreamInfo(
    config: NatsConnectionConfig,
    streamName: string
): Promise<ActionResponse<StreamInfo>> {
    return withJetStream(config, "getStreamInfo", async ({ jsm }) => {
        return await jsm.streams.info(streamName);
    });
}

/**
 * Update an existing stream's configuration.
 * Name is immutable; pass a partial `StreamUpdateConfig` (subjects, limits, discard, replicas, …).
 */
export async function updateStream(
    config: NatsConnectionConfig,
    streamName: string,
    update: Partial<StreamUpdateConfig>
): Promise<ActionResponse<StreamInfo>> {
    return withJetStream(config, "updateStream", async ({ jsm }) => {
        return await jsm.streams.update(streamName, update);
    });
}

/**
 * Purge messages from a stream. Optionally filter by subject and/or sequence/keep.
 * Returns how many messages were removed.
 */
export async function purgeStream(
    config: NatsConnectionConfig,
    streamName: string,
    opts: PurgeStreamOptions = {}
): Promise<ActionResponse<{ purged: number }>> {
    return withJetStream(config, "purgeStream", async ({ jsm }) => {
        let purgeOpts: PurgeOpts | undefined;
        if (opts.seq != null && opts.seq > 0) {
            purgeOpts = { seq: opts.seq, filter: opts.filter };
        } else if (opts.keep != null && opts.keep > 0) {
            purgeOpts = { keep: opts.keep, filter: opts.filter };
        } else if (opts.filter) {
            purgeOpts = { filter: opts.filter };
        }

        const result = await jsm.streams.purge(streamName, purgeOpts);
        return { purged: result.purged };
    });
}

/** JetStream account storage / limits overview for the dashboard. */
export async function getJetStreamAccountInfo(
    config: NatsConnectionConfig
): Promise<ActionResponse<JetStreamAccountOverview>> {
    return withJetStream(config, "getJetStreamAccountInfo", async ({ jsm }) => {
        const info = await jsm.getAccountInfo();
        return {
            memory: info.memory,
            storage: info.storage,
            streams: info.streams,
            consumers: info.consumers,
            domain: info.domain,
            limits: {
                maxMemory: info.limits.max_memory,
                maxStorage: info.limits.max_storage,
                maxStreams: info.limits.max_streams,
                maxConsumers: info.limits.max_consumers,
            },
            api: {
                total: info.api.total,
                errors: info.api.errors,
            },
        };
    });
}

/**
 * Fetch messages from a stream by sequence range, with optional subject filter.
 */
export async function getStreamMessages(
    config: NatsConnectionConfig,
    streamName: string,
    opts: GetStreamMessagesOptions = {}
): Promise<ActionResponse<{ messages: StreamMessage[]; hasMore: boolean }>> {
    return withJetStream(config, "getStreamMessages", async ({ jsm }) => {
        const batchSize = opts.batchSize ?? 25;

        const info = await jsm.streams.info(streamName);
        const firstSeq = info.state.first_seq;
        const lastSeq = info.state.last_seq;

        const startSeq = opts.startSeq ?? firstSeq;
        const endSeq = opts.endSeq ?? lastSeq;

        if (startSeq > lastSeq || endSeq < firstSeq) {
            return { messages: [], hasMore: false };
        }

        const messages: StreamMessage[] = [];
        let currentSeq = startSeq;

        while (currentSeq <= endSeq && messages.length < batchSize) {
            try {
                const msg = await jsm.streams.getMessage(streamName, { seq: currentSeq });

                if (opts.subjectFilter && !subjectMatches(msg.subject, opts.subjectFilter)) {
                    currentSeq++;
                    continue;
                }

                const headers: Record<string, string[]> = {};
                if (msg.header) {
                    for (const [key, values] of msg.header) {
                        headers[key] = values;
                    }
                }

                messages.push({
                    seq: msg.seq,
                    subject: msg.subject,
                    timestamp: msg.timestamp,
                    data: msg.string(),
                    headers,
                    size: msg.data.length,
                });
            } catch (err: unknown) {
                if (err instanceof Error && err.message.includes("no message found")) {
                    currentSeq++;
                    continue;
                }
                throw err;
            }
            currentSeq++;
        }

        return {
            messages,
            hasMore: currentSeq <= endSeq,
        };
    });
}

// NATS subject matcher with * and > wildcards.
function subjectMatches(subject: string, filter: string): boolean {
    if (filter === ">") return true;

    const subParts = subject.split(".");
    const filterParts = filter.split(".");

    for (let i = 0; i < filterParts.length; i++) {
        if (filterParts[i] === ">") return true;
        if (i >= subParts.length) return false;
        if (filterParts[i] === "*") continue;
        if (filterParts[i] !== subParts[i]) return false;
    }

    return subParts.length === filterParts.length;
}

// ──────────────────────────────────────────────────────────────────────────────
// Consumers
// ──────────────────────────────────────────────────────────────────────────────

/** List all consumers attached to a given stream. */
export async function listConsumers(
    config: NatsConnectionConfig,
    stream: string
): Promise<ActionResponse<{ consumers: ConsumerInfo[] }>> {
    return withJetStream(config, "listConsumers", async ({ jsm }) => {
        const iter = await jsm.consumers.list(stream);
        const consumerList: ConsumerInfo[] = [];
        for await (const c of iter) {
            consumerList.push(c);
        }
        return { consumers: consumerList };
    });
}

/** Create a consumer on a stream. Durable consumers require `durable_name`. */
export async function createConsumer(
    config: NatsConnectionConfig,
    stream: string,
    consumerConfig: ConsumerConfig
): Promise<ActionResponse<{ info: ConsumerInfo }>> {
    return withJetStream(config, "createConsumer", async ({ jsm }) => {
        const info = await jsm.consumers.add(stream, consumerConfig);
        return { info };
    });
}

/** Delete a consumer from a stream. Pending messages on the consumer are lost. */
export async function deleteConsumer(
    config: NatsConnectionConfig,
    stream: string,
    consumer: string
): Promise<ActionResponse<void>> {
    return withJetStream(config, "deleteConsumer", async ({ jsm }) => {
        await jsm.consumers.delete(stream, consumer);
    });
}

/** Fetch a single consumer's full info (config + delivery/ack state). */
export async function getConsumerInfo(
    config: NatsConnectionConfig,
    stream: string,
    consumer: string
): Promise<ActionResponse<{ info: ConsumerInfo }>> {
    return withJetStream(config, "getConsumerInfo", async ({ jsm }) => {
        const info = await jsm.consumers.info(stream, consumer);
        return { info };
    });
}

/**
 * Update a durable consumer. Only fields allowed by `ConsumerUpdateConfig`
 * (ack_wait, max_deliver, filter_subject, max_ack_pending, …) may change.
 */
export async function updateConsumer(
    config: NatsConnectionConfig,
    stream: string,
    consumer: string,
    update: Partial<ConsumerUpdateConfig>
): Promise<ActionResponse<{ info: ConsumerInfo }>> {
    return withJetStream(config, "updateConsumer", async ({ jsm }) => {
        const info = await jsm.consumers.update(stream, consumer, update);
        return { info };
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Consumer Stats
// ──────────────────────────────────────────────────────────────────────────────

export interface ConsumerStats {
    consumers: number;
    pending: number;
    ackPending: number;
}

/**
 * Aggregated consumer stats for multiple streams in a single round-trip.
 */
export async function getStreamConsumerStats(
    config: NatsConnectionConfig,
    streamNames: string[]
): Promise<ActionResponse<Record<string, ConsumerStats>>> {
    return withJetStream(config, "getStreamConsumerStats", async ({ jsm }) => {
        const result: Record<string, ConsumerStats> = {};

        await Promise.all(
            streamNames.map(async (name) => {
                const stats: ConsumerStats = { consumers: 0, pending: 0, ackPending: 0 };
                try {
                    const iter = await jsm.consumers.list(name);
                    for await (const c of iter) {
                        stats.consumers++;
                        stats.pending += c.num_pending ?? 0;
                        stats.ackPending += c.num_ack_pending ?? 0;
                    }
                } catch {
                    // Stream may have been deleted between list and fetch — ignore.
                }
                result[name] = stats;
            })
        );

        return result;
    });
}
