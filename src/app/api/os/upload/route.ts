import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/server-action";
import { MAX_OS_UPLOAD_BYTES, NatsConnectionConfigWithoutIdSchema, UploadMetadataSchema } from "@/lib/validation/nats";
import { connectWithConfig } from "@/lib/nats/connect-options";

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
        const contentLength = Number(request.headers.get("content-length"));
        // Multipart framing adds a small overhead beyond the file bytes.
        if (Number.isFinite(contentLength) && contentLength > MAX_OS_UPLOAD_BYTES + 1_048_576) {
            return NextResponse.json(
                { success: false, error: `Upload exceeds the ${MAX_OS_UPLOAD_BYTES} byte limit` },
                { status: 413 },
            );
        }

        const formData = await request.formData();

        const bucketValue = formData.get("bucket");
        const connectionValue = formData.get("connection");
        const bucket = typeof bucketValue === "string" ? bucketValue.trim() : "";
        const connectionRaw = typeof connectionValue === "string" ? connectionValue : "";
        const nameValue = formData.get("name");
        const metadataValue = formData.get("metadata");
        const objectName = typeof nameValue === "string" ? nameValue.trim() : undefined;
        const metadataRaw = typeof metadataValue === "string" ? metadataValue : null;
        const fileValue = formData.get("file");
        const file = typeof File !== "undefined" && fileValue instanceof File ? fileValue : null;

        if (!bucket || !connectionRaw || !file) {
            return NextResponse.json(
                { success: false, error: "Missing bucket, connection, or file" },
                { status: 400 },
            );
        }
        if (file.size > MAX_OS_UPLOAD_BYTES) {
            return NextResponse.json(
                { success: false, error: `File exceeds the ${MAX_OS_UPLOAD_BYTES} byte upload limit` },
                { status: 413 },
            );
        }

        let connectionInput: unknown;
        try {
            connectionInput = JSON.parse(connectionRaw) as unknown;
        } catch {
            return NextResponse.json({ success: false, error: "Invalid connection JSON" }, { status: 400 });
        }
        const parsedConnection = NatsConnectionConfigWithoutIdSchema.safeParse(connectionInput);
        if (!parsedConnection.success) {
            return NextResponse.json({ success: false, error: "Invalid connection configuration" }, { status: 400 });
        }
        const config = parsedConnection.data;
        if (!objectName && !file.name.trim()) {
            return NextResponse.json({ success: false, error: "Object name is required" }, { status: 400 });
        }
        let metadata: Record<string, string> | undefined;
        if (metadataRaw) {
            try {
                const parsed = JSON.parse(metadataRaw) as unknown;
                const validatedMetadata = UploadMetadataSchema.safeParse(parsed);
                if (!validatedMetadata.success) {
                    return NextResponse.json({ success: false, error: "Invalid object metadata" }, { status: 400 });
                }
                metadata = validatedMetadata.data;
            } catch {
                return NextResponse.json({ success: false, error: "Invalid object metadata JSON" }, { status: 400 });
            }
        }

        // Read file into Uint8Array directly (no base64!)
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const name = objectName || file.name;

        const nc = await connectWithConfig(config, {
            name: "Cobra NATS - OS upload",
            maxReconnectAttempts: 0,
            reconnect: false,
            timeout: 10000,
        });

        try {
            const js = nc.jetstream();
            const os = await js.views.os(bucket);
            const info = await os.putBlob(
                {
                    name,
                    metadata:
                        metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
                },
                bytes
            );

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
        } finally {
            await nc.close();
        }
    } catch (err: unknown) {
        console.error("[OS Upload API Error]", err);
        return NextResponse.json(
            { success: false, error: getErrorMessage(err) || "Upload failed" },
            { status: 500 },
        );
    }
}
