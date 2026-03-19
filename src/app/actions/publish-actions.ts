"use server";

import { NatsConnectionConfig } from "@/lib/nats/nats-types";
import { headers, JSONCodec, PublishOptions } from "nats";
import { withNatsConnection, ActionResponse } from "./action-helpers";

export async function publishMessage(
    config: NatsConnectionConfig,
    subject: string,
    payload: string,
    msgHeaders?: Record<string, string>
): Promise<ActionResponse<void>> {
    return withNatsConnection(config, "publishMessage", async (nc) => {
        const jc = JSONCodec();

        const opts: PublishOptions = {};
        if (msgHeaders && Object.keys(msgHeaders).length > 0) {
            const h = headers();
            for (const [k, v] of Object.entries(msgHeaders)) {
                h.append(k, v);
            }
            opts.headers = h;
        }

        // Attempt to parse JSON if possible, otherwise use as string
        let data: string | Uint8Array | Record<string, unknown> = payload;
        try {
            data = JSON.parse(payload);
            nc.publish(subject, jc.encode(data), opts);
        } catch {
            nc.publish(subject, payload, opts);
        }
    });
}

export async function requestMessage(
    config: NatsConnectionConfig,
    subject: string,
    payload: string,
    timeout: number = 5000
): Promise<ActionResponse<{ reply: { subject: string; data: string; headers?: Record<string, string> } }>> {
    return withNatsConnection(config, "requestMessage", async (nc) => {
        const jc = JSONCodec();

        // Attempt to parse JSON if possible, otherwise use as string
        let data: string | Uint8Array | Record<string, unknown> = payload;
        try {
            data = JSON.parse(payload);
        } catch { }

        const msg = await nc.request(subject, typeof data === 'string' ? data : jc.encode(data), { timeout });

        let headersDict: Record<string, string> | undefined;
        if (msg.headers) {
            headersDict = {};
            for (const [key, value] of msg.headers) {
                headersDict[key] = value[0] || '';
            }
        }

        return {
            reply: {
                subject: msg.subject,
                data: msg.string(),
                headers: headersDict
            }
        };
    });
}
