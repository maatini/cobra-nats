import type { NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/server-action";
import type { NatsConnectionConfig } from "@/types/nats";
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
        const body = await request.json();
        const config = body?.config as NatsConnectionConfig | undefined;
        const bucket = body?.bucket as string | undefined;
        const name = body?.name as string | undefined;

        if (!config?.servers || !bucket || !name) {
            return new Response("Missing config, bucket, or name", { status: 400 });
        }

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
        nc = undefined; // ownership transferred to stream cancel

        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                const reader = result.data.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value) controller.enqueue(value);
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                } finally {
                    try {
                        await connection.close();
                    } catch {
                        // ignore
                    }
                }
            },
            async cancel() {
                try {
                    await result.data.cancel();
                } catch {
                    // ignore
                }
                try {
                    await connection.close();
                } catch {
                    // ignore
                }
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
