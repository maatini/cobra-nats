"use server";

import { NatsConnectionConfig, StreamMessage, GetStreamMessagesOptions } from "@/lib/nats/nats-types";
import { StreamConfig, StreamInfo } from "nats";
import { withJetStream, ActionResponse } from "./action-helpers";

export async function listStreams(config: NatsConnectionConfig): Promise<ActionResponse<StreamInfo[]>> {
    return withJetStream(config, "listStreams", async ({ jsm }) => {
        const streamList: StreamInfo[] = [];
        const iter = await jsm.streams.list();
        for await (const s of iter) {
            streamList.push(s);
        }
        return streamList;
    });
}

export async function createStream(config: NatsConnectionConfig, streamConfig: StreamConfig): Promise<ActionResponse<StreamInfo>> {
    return withJetStream(config, "createStream", async ({ jsm }) => {
        return await jsm.streams.add(streamConfig);
    });
}

export async function deleteStream(config: NatsConnectionConfig, streamName: string): Promise<ActionResponse<boolean>> {
    return withJetStream(config, "deleteStream", async ({ jsm }) => {
        return await jsm.streams.delete(streamName);
    });
}

export async function getStreamInfo(config: NatsConnectionConfig, streamName: string): Promise<ActionResponse<StreamInfo>> {
    return withJetStream(config, "getStreamInfo", async ({ jsm }) => {
        return await jsm.streams.info(streamName);
    });
}

/**
 * Fetch messages from a stream by sequence range.
 * Supports optional subject filtering and batch size.
 */
export async function getStreamMessages(
    config: NatsConnectionConfig,
    streamName: string,
    opts: GetStreamMessagesOptions = {}
): Promise<ActionResponse<{ messages: StreamMessage[]; hasMore: boolean }>> {
    return withJetStream(config, "getStreamMessages", async ({ jsm }) => {
        const batchSize = opts.batchSize ?? 25;

        // Get stream info to determine valid sequence range
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

                // Apply subject filter if specified
                if (opts.subjectFilter && !subjectMatches(msg.subject, opts.subjectFilter)) {
                    currentSeq++;
                    continue;
                }

                // Serialize headers to plain object
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
                // Sequence might be deleted, skip it
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

/**
 * Simple NATS subject matching (supports * and > wildcards).
 */
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
