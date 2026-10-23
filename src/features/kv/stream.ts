import { natsManager } from "@/lib/nats/manager";
import { getErrorMessage } from "@/lib/server-action";
import type { NatsConnectionConfig } from "@/types/nats";

interface KVWatchParams {
    config: NatsConnectionConfig;
    bucket: string;
    signal: AbortSignal;
}

/**
 * Build the SSE ReadableStream for a KV bucket watch. The watcher owns a
 * dedicated connection so a long-lived subscription never occupies the CRUD pool.
 */
export function createKVWatchStream({ config, bucket, signal }: KVWatchParams): ReadableStream {
    const encoder = new TextEncoder();
    const connectionId = `kv-watch-${config.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new ReadableStream({
        async start(controller) {
            let heartbeat: ReturnType<typeof setInterval> | undefined;
            let settled = false;
            let shutdownPromise: Promise<void> | undefined;

            const send = (event: string, data: string) => {
                if (settled) return;
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
                } catch {
                    // The stream consumer has already closed the response.
                }
            };

            const shutdown = async (error?: unknown) => {
                if (shutdownPromise) return shutdownPromise;
                shutdownPromise = (async () => {
                    if (heartbeat) clearInterval(heartbeat);
                    try {
                        await natsManager.closeConnection(connectionId);
                    } catch (closeError) {
                        console.error("Error closing KV watch connection:", closeError);
                    }
                    if (!settled) {
                        settled = true;
                        try {
                            if (error !== undefined) controller.error(error);
                            else controller.close();
                        } catch {
                            // The response may already be closed by the client.
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
                    id: connectionId,
                    name: `KV Watch - ${bucket}`,
                });
                if (signal.aborted) {
                    await shutdown();
                    return;
                }

                const kv = await nc.jetstream().views.kv(bucket, { bindOnly: true });
                const watcher = await kv.watch();
                send("connected", JSON.stringify({ bucket }));
                heartbeat = setInterval(() => send("ping", String(Date.now())), 15000);

                const iterator = watcher[Symbol.asyncIterator]();
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
                        const entry = next.value;
                        send("entry", JSON.stringify({
                            key: entry.key,
                            value: entry.string(),
                            revision: entry.revision,
                            created: entry.created,
                            delta: entry.delta,
                            operation: entry.operation,
                        }));
                    }
                    await shutdown();
                } catch (error: unknown) {
                    send("error", getErrorMessage(error));
                    await shutdown(error);
                } finally {
                    signal.removeEventListener("abort", onIteratorAbort);
                }
            } catch (error: unknown) {
                send("error", getErrorMessage(error));
                await shutdown(error);
            } finally {
                signal.removeEventListener("abort", onAbort);
            }
        },
        cancel() {
            void natsManager.closeConnection(connectionId);
        },
    });
}
