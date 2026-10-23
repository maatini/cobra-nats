import type { NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/server-action";
import { OsDownloadRequestSchema } from "@/lib/validation/nats";
import { connectWithConfig } from "@/lib/nats/connect-options";

export const dynamic = "force-dynamic";

/**
 * POST /api/os/download
 *
 * Streams an Object Store object to the client without base64-encoding the
 * entire payload in memory (unlike the `downloadObject` Server Action).
 *
 * Body JSON: `{ config: NatsConnectionConfig, bucket: string, name: string }`
 */
export async function POST(request: NextRequest) {
    let nc: Awaited<ReturnType<typeof connectWithConfig>> | undefined;

    try {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return new Response("Invalid JSON body", { status: 400 });
        }
        const parsed = OsDownloadRequestSchema.safeParse(body);
        if (!parsed.success) {
            return new Response("Missing or invalid config, bucket, or name", { status: 400 });
        }
        const { config, bucket, name } = parsed.data;

        nc = await connectWithConfig(config, {
            name: "Cobra NATS - OS download",
            maxReconnectAttempts: 0,
            reconnect: false,
            timeout: 15000,
        });

        const js = nc.jetstream();
        const os = await js.views.os(bucket);
        const result = await os.get(name);

        if (!result) {
            await nc.close();
            nc = undefined;
            return new Response(`Object "${name}" not found`, { status: 404 });
        }

        const connection = nc;
        nc = undefined; // stream owns and closes this connection
        let cleanupPromise: Promise<void> | undefined;
        const cleanup = () => {
            if (!cleanupPromise) {
                cleanupPromise = (async () => {
                    try {
                        await connection.close();
                    } catch {
                        // ignore cleanup errors
                    }
                })();
            }
            return cleanupPromise;
        };

        const reader = result.data.getReader();
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                let settled = false;
                const onAbort = () => {
                    void (async () => {
                        try {
                            await reader.cancel(request.signal.reason);
                        } catch {
                            // Reader may already be closed.
                        }
                        if (!settled) {
                            settled = true;
                            try {
                                controller.error(request.signal.reason);
                            } catch {
                                // Stream may already be canceled.
                            }
                        }
                        await cleanup();
                    })();
                };

                request.signal.addEventListener("abort", onAbort, { once: true });
                try {
                    if (request.signal.aborted) {
                        onAbort();
                        return;
                    }
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done || request.signal.aborted) break;
                        if (value) controller.enqueue(value);
                    }
                    if (!settled) {
                        settled = true;
                        controller.close();
                    }
                } catch (err) {
                    if (!settled) {
                        settled = true;
                        controller.error(err);
                    }
                } finally {
                    request.signal.removeEventListener("abort", onAbort);
                    await cleanup();
                }
            },
            async cancel(reason) {
                try {
                    await reader.cancel(reason);
                } catch {
                    // ignore cancellation errors
                }
                await cleanup();
            },
        });

        const safeName = name.replace(/[^\w.\-]+/g, "_");
        return new Response(stream, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${safeName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err: unknown) {
        if (nc) {
            try {
                await nc.close();
            } catch {
                // ignore
            }
        }
        console.error("[OS Download API Error]", err);
        return new Response(getErrorMessage(err) || "Download failed", { status: 500 });
    }
}
