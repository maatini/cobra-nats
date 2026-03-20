"use server";

import { NatsConnectionConfig } from "@/lib/nats/nats-types";
import { withJetStream, ActionResponse } from "./action-helpers";

export interface ConsumerStats {
    consumers: number;
    pending: number;
    ackPending: number;
}

/**
 * Fetch aggregated consumer stats for multiple streams in a single call.
 * Returns a record mapping stream name → summed consumer metrics.
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
                    // Stream might have been deleted between list and fetch — ignore
                }
                result[name] = stats;
            })
        );

        return result;
    });
}
