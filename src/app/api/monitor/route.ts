import { NextRequest } from "next/server";
import { natsManager } from "@/lib/nats/NatsManager";
import { NatsConnection } from "nats";
import { getErrorMessage } from "@/app/actions/action-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const subject = searchParams.get("subject") || ">";
    const servers = searchParams.get("servers")?.split(",") || ["nats://localhost:4222"];

    if (!connectionId) {
        return new Response("Missing connectionId", { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let nc: NatsConnection | undefined;
            try {
                // We use a dedicated connection for monitoring to avoid blocking other operations
                // and because we need to handle subscriptions in a specific way for SSE
                nc = await natsManager.getConnection({
                    id: `monitor-${connectionId}-${Date.now()}`,
                    name: `Monitor - ${subject}`,
                    servers: servers,
                    authType: "none",
                });

                const sub = nc.subscribe(subject);

                // Signal connection success
                controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ subject })}\n\n`));

                // Keep-alive heartbeat
                const heartbeat = setInterval(() => {
                    controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
                }, 15000);

                (async () => {
                    for await (const msg of sub) {
                        let headersDict: Record<string, string> | undefined;
                        if (msg.headers) {
                            headersDict = {};
                            for (const [key, value] of msg.headers) {
                                headersDict[key] = value[0] || '';
                            }
                        }

                        const payload = {
                            timestamp: Date.now(),
                            subject: msg.subject,
                            data: msg.string(),
                            size: msg.data.length,
                            headers: headersDict,
                        };

                        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(payload)}\n\n`));
                    }
                })().catch(err => {
                    console.error("Subscription error:", err);
                });

                req.signal.addEventListener("abort", async () => {
                    clearInterval(heartbeat);
                    sub.unsubscribe();
                    if (nc) {
                        try {
                            await nc.close();
                        } catch (e) {
                            console.error("Error closing dedicated monitor connection:", e);
                        }
                    }
                    controller.close();
                });

            } catch (err: unknown) {
                console.error("SSE NATS Error:", err);
                controller.enqueue(encoder.encode(`event: error\ndata: ${getErrorMessage(err)}\n\n`));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
