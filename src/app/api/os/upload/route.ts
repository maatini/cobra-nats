import { NextRequest, NextResponse } from "next/server";
import { connect } from "nats";
import { getErrorMessage } from "@/lib/server-action";
import type { NatsConnectionConfig } from "@/types/nats";

export const dynamic = "force-dynamic";

/**
 * POST /api/os/upload
 *
 * Accepts multipart/form-data with:
 *  - bucket: string
 *  - connection: JSON-serialized NatsConnectionConfig (without id)
 *  - file: the file to upload
 *
 * Uses a standard REST endpoint instead of a Server Action so that
 * large binary payloads avoid Reactʼs RSC serialisation limits.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const bucket = formData.get("bucket") as string;
        const connectionRaw = formData.get("connection") as string;
        const file = formData.get("file") as File | null;

        if (!bucket || !connectionRaw || !file) {
            return NextResponse.json(
                { success: false, error: "Missing bucket, connection, or file" },
                { status: 400 },
            );
        }

        const config: Omit<NatsConnectionConfig, "id"> = JSON.parse(connectionRaw);

        // Read file into Uint8Array directly (no base64!)
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const nc = await connect({
            servers: config.servers,
            user: config.user,
            pass: config.pass,
            token: config.token,
            name: `Cobra NATS - OS upload`,
            maxReconnectAttempts: 0,
            reconnect: false,
            timeout: 10000,
        });

        const js = nc.jetstream();
        const os = await js.views.os(bucket);
        const info = await os.putBlob({ name: file.name }, bytes);
        await nc.close();

        return NextResponse.json({
            success: true,
            data: {
                name: info.name,
                size: info.size,
                chunks: info.chunks,
                modified: info.mtime,
                digest: info.digest,
                deleted: info.deleted,
                metadata: info.metadata,
            },
        });
    } catch (err: unknown) {
        console.error("[OS Upload API Error]", err);
        return NextResponse.json(
            { success: false, error: getErrorMessage(err) || "Upload failed" },
            { status: 500 },
        );
    }
}
