import type { NatsConnection } from "nats";
import { natsManager } from "@/lib/nats/manager";
import { getErrorMessage } from "@/lib/server-action";
import type { NatsConnectionConfig } from "@/types/nats";

interface MonitorStreamParams {
    config: NatsConnectionConfig;
    subject: string;
    signal: AbortSignal;
}

/**
 * Build the SSE `ReadableStream` that powers `/api/monitor`.
 *
 * Uses a dedicated NATS connection (not the shared feature pool) so monitor
 * subscriptions don't block other ops. Full auth comes from the connection
 * config in the POST body — never from query-string secrets.
 * The dedicated connection is closed when the client aborts (`signal`).
 */
export function createMonitorStream({
    config,
    subject,
    signal,
}: MonitorStreamParams): ReadableStream {
    const encoder = new TextEncoder();
    // Unique pool key so this connection is never reused by feature actions.
    const monitorConnectionId = `monitor-${config.id}-${Date.now()}`;

    return new ReadableStream({
        async start(controller) {
            let nc: NatsConnection | undefined;

            const send = (event: string, data: string) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
                } catch {
                    // Controller already closed.
                }
            };

            try {
                nc = await natsManager.getConnection({
                    ...config,
                    id: monitorConnectionId,
                    name: `Monitor - ${subject}`,
                });

                const sub = nc.subscribe(subject);

                send("connected", JSON.stringify({ subject }));

                const heartbeat = setInterval(() => {
                    send("ping", String(Date.now()));
                }, 15000);

                const shutdown = async () => {
                    clearInterval(heartbeat);
                    try {
                        sub.unsubscribe();
                    } catch {
                        // already unsubscribed
                    }
                    try {
                        await natsManager.closeConnection(monitorConnectionId);
                    } catch (e) {
                        console.error("Error closing monitor connection:", e);
                    }
                    try {
                        controller.close();
                    } catch {
                        // already closed
                    }
                };

                (async () => {
                    for await (const msg of sub) {
                        if (signal.aborted) break;
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

                signal.addEventListener("abort", () => {
                    void shutdown();
                });
            } catch (err: unknown) {
                console.error("SSE NATS Error:", err);
                send("error", getErrorMessage(err));
                try {
                    await natsManager.closeConnection(monitorConnectionId);
                } catch {
                    // ignore cleanup errors
                }
                try {
                    controller.close();
                } catch {
                    // ignore
                }
            }
        },
    });
}
