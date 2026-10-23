import type { NextRequest } from "next/server";
import { createMonitorStream } from "@/features/monitor/stream";
import { MonitorRequestSchema } from "@/lib/validation/nats";

export const dynamic = "force-dynamic";

/**
 * Live subject monitor via SSE.
 *
 * Accepts POST with JSON body so credentials never appear in the URL/query string:
 * `{ config: NatsConnectionConfig, subject?: string }`
 */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return new Response("Invalid JSON body", { status: 400 });
    }

    const parsed = MonitorRequestSchema.safeParse(body);
    if (!parsed.success) {
        return new Response("Missing or invalid connection config or subject", { status: 400 });
    }

    const { config, subject } = parsed.data;
    const stream = createMonitorStream({
        config,
        subject: subject && subject.length > 0 ? subject : ">",
        signal: req.signal,
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
