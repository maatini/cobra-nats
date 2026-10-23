import type { NextRequest } from "next/server";
import { createKVWatchStream } from "@/features/kv/stream";
import { KVWatchRequestSchema } from "@/lib/validation/nats";

export const dynamic = "force-dynamic";

/** Live KV updates over SSE; full connection config is accepted only in JSON body. */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return new Response("Invalid JSON body", { status: 400 });
    }

    const parsed = KVWatchRequestSchema.safeParse(body);
    if (!parsed.success) {
        return new Response("Missing or invalid connection config or bucket", { status: 400 });
    }

    const stream = createKVWatchStream({ ...parsed.data, signal: req.signal });
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
