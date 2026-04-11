import type { NatsConnection } from "nats";
import { natsManager } from "@/lib/nats/manager";
import { getErrorMessage } from "@/lib/server-action";

interface MonitorStreamParams {
    connectionId: string;
    subject: string;
    servers: string[];
    signal: AbortSignal;
}

/**
 * Build the SSE `ReadableStream` that powers `/api/monitor`.
 *
 * Uses a dedicated NATS connection (not the shared pool) so monitor subscriptions
 * don't block or conflict with other feature operations. The connection is closed
 * when the client aborts (`signal`).
 */
export function createMonitorStream({
    connectionId,
    subject,
    servers,
    signal,
}: MonitorStreamParams): ReadableStream {
    const encoder = new TextEncoder();

    return new ReadableStream({
        async start(controller) {
            let nc: NatsConnection | undefined;

            const send = (event: string, data: string) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
            };

            try {
                nc = await natsManager.getConnection({
                    id: `monitor-${connectionId}-${Date.now()}`,
                    name: `Monitor - ${subject}`,
                    servers,
                    authType: "none",
                });

                const sub = nc.subscribe(subject);

                send("connected", JSON.stringify({ subject }));

                const heartbeat = setInterval(() => {
                    send("ping", String(Date.now()));
                }, 15000);

                (async () => {
                    for await (const msg of sub) {
                        let headers: Record<string, string> | undefined;
                        if (msg.headers) {
                            headers = {};
                            for (const [k, v] of msg.headers) {
                                headers[k] = v[0] || "";
                            }
                        }
                        send(
                            "message",
                            JSON.stringify({
                                timestamp: Date.now(),
                                subject: msg.subject,
                                data: msg.string(),
                                size: msg.data.length,
                                headers,
                            })
                        );
                    }
                })().catch((err) => {
                    console.error("Monitor subscription error:", err);
                });

                signal.addEventListener("abort", async () => {
                    clearInterval(heartbeat);
                    sub.unsubscribe();
                    if (nc) {
                        try {
                            await nc.close();
                        } catch (e) {
                            console.error("Error closing monitor connection:", e);
                        }
                    }
                    controller.close();
                });
            } catch (err: unknown) {
                console.error("SSE NATS Error:", err);
                send("error", getErrorMessage(err));
                controller.close();
            }
        },
    });
}
