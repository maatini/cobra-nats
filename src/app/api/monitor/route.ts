import type { NextRequest } from "next/server";
import { createMonitorStream } from "@/features/monitor/stream";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const subject = searchParams.get("subject") || ">";
    const servers = searchParams.get("servers")?.split(",") || ["nats://localhost:4222"];

    if (!connectionId) {
        return new Response("Missing connectionId", { status: 400 });
    }

    const stream = createMonitorStream({
        connectionId,
        subject,
        servers,
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
