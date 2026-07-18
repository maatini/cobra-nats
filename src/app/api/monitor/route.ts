import type { NextRequest } from "next/server";
import { createMonitorStream } from "@/features/monitor/stream";
import type { NatsConnectionConfig } from "@/types/nats";

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

    if (!body || typeof body !== "object") {
        return new Response("Invalid body", { status: 400 });
    }

    const { config, subject } = body as {
        config?: NatsConnectionConfig;
        subject?: string;
    };

    if (!config || typeof config !== "object" || !config.id || !Array.isArray(config.servers)) {
        return new Response("Missing or invalid connection config", { status: 400 });
    }

    const stream = createMonitorStream({
        config,
        subject: typeof subject === "string" && subject.length > 0 ? subject : ">",
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
