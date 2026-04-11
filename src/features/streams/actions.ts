"use server";

import type {
    NatsConnectionConfig,
    StreamMessage,
    GetStreamMessagesOptions,
} from "@/types/nats";
import type {
    StreamConfig,
    StreamInfo,
    ConsumerConfig,
    ConsumerInfo,
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
