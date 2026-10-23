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
            let heartbeat: ReturnType<typeof setInterval> | undefined;
            let subscription: ReturnType<NatsConnection["subscribe"]> | undefined;
            let settled = false;
            let shutdownPromise: Promise<void> | undefined;

            const send = (event: string, data: string) => {
                if (settled) return;
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
                } catch {
                    // Controller already closed.
                }
            };

            const shutdown = (error?: unknown): Promise<void> => {
                if (shutdownPromise) return shutdownPromise;
                shutdownPromise = (async () => {
                    if (heartbeat) clearInterval(heartbeat);
                    try {
                        subscription?.unsubscribe();
                    } catch {
                        // already unsubscribed
                    }
                    try {
                        await natsManager.closeConnection(monitorConnectionId);
                    } catch (closeError) {
                        console.error("Error closing monitor connection:", closeError);
                    }
                    if (!settled) {
                        settled = true;
                        try {
                            if (error !== undefined) controller.error(error);
                            else controller.close();
                        } catch {
                            // Controller was already closed by the stream consumer.
                        }
                    }
                })();
                return shutdownPromise;
            };

            const onAbort = () => {
                void shutdown();
            };
            signal.addEventListener("abort", onAbort, { once: true });

            try {
                if (signal.aborted) {
                    await shutdown();
                    return;
                }

                const nc = await natsManager.getConnection({
                    ...config,
                    id: monitorConnectionId,
                    name: `Monitor - ${subject}`,
                });
                if (signal.aborted) {
                    await shutdown();
                    return;
                }

                subscription = nc.subscribe(subject);
                send("connected", JSON.stringify({ subject }));
                heartbeat = setInterval(() => send("ping", String(Date.now())), 15000);

                const iterator = subscription[Symbol.asyncIterator]();
                let resolveAbort!: () => void;
                const aborted = new Promise<null>((resolve) => {
                    resolveAbort = () => resolve(null);
                });
                const onIteratorAbort = () => resolveAbort();
                if (signal.aborted) resolveAbort();
                else signal.addEventListener("abort", onIteratorAbort, { once: true });

                try {
                    while (!signal.aborted) {
                        const next = await Promise.race([iterator.next(), aborted]);
                        if (next === null || next.done) break;
                        const msg = next.value;
                        let headers: Record<string, string> | undefined;
                        if (msg.headers) {
                            headers = {};
                            for (const [key, values] of msg.headers) {
                                headers[key] = values[0] || "";
                            }
                        }
                        send(
                            "message",
                            JSON.stringify({
                                timestamp: Date.now(),
                                subject: msg.subject,
                                data: msg.string(),
                                dataBase64: Buffer.from(msg.data).toString("base64"),
                                size: msg.data.length,
                                headers,
                            })
                        );
                    }
                    await shutdown();
                } catch (err: unknown) {
                    console.error("Monitor subscription error:", err);
                    send("error", getErrorMessage(err));
                    await shutdown(err);
                } finally {
                    signal.removeEventListener("abort", onIteratorAbort);
                }
            } catch (err: unknown) {
                console.error("SSE NATS Error:", err);
                send("error", getErrorMessage(err));
                await shutdown(err);
            } finally {
                signal.removeEventListener("abort", onAbort);
            }
        },
    });
}
