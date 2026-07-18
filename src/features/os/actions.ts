"use server";

import type { NatsConnectionConfig, OsBucketInfo, OsObjectInfo } from "@/types/nats";
import type { ObjectStoreOptions, ObjectInfo } from "nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

/**
 * Serialize a NATS ObjectInfo into a plain OsObjectInfo for client transport.
 */
function serializeObjectInfo(o: ObjectInfo): OsObjectInfo {
    return {
        name: o.name,
        size: o.size,
        chunks: o.chunks,
        modified: o.mtime,
        digest: o.digest,
        deleted: o.deleted,
        metadata: o.metadata,
    };
}

/**
 * List all Object Store buckets by discovering streams with OBJ_ prefix.
 */
export async function listOSBuckets(
    config: NatsConnectionConfig
): Promise<ActionResponse<{ buckets: OsBucketInfo[] }>> {
    return withJetStream(config, "listOSBuckets", async ({ js, jsm }) => {
        // Discover OS buckets via OBJ_ stream prefix
        const bucketNames: string[] = [];
        const iter = await jsm.streams.list();
        for await (const s of iter) {
            if (s.config.name.startsWith("OBJ_")) {
                bucketNames.push(s.config.name.substring(4));
            }
        }

        const buckets: OsBucketInfo[] = [];
        for (const name of bucketNames) {
            const os = await js.views.os(name);
            const status = await os.status();
            const objects = await os.list();
            buckets.push({
                bucket: status.bucket,
                description: status.description,
                size: status.size,
                storage: String(status.storage),
                replicas: status.replicas,
                sealed: status.sealed,
                objectCount: objects.filter((o) => !o.deleted).length,
            });
        }

        return { buckets };
    });
}

/**
 * Create a new Object Store bucket.
 */
export async function createOSBucket(
    config: NatsConnectionConfig,
    name: string,
    opts?: Partial<ObjectStoreOptions>
): Promise<ActionResponse<OsBucketInfo>> {
    return withJetStream(config, "createOSBucket", async ({ js }) => {
        // Workaround for nats.js client bug: ObjectStoreImpl.init() uses
        // Object.assign({}, opts) which copies ALL enumerable properties into the
        // raw stream config. The NATS server rejects the unknown "replicas" field
        // (it expects "num_replicas"). The client maps opts.replicas -> num_replicas
        // but doesn't delete the original. Making replicas non-enumerable prevents
        // Object.assign from copying it while opts.replicas still returns the value.
        const cleanOpts: Record<string, unknown> = { ...opts };
        if ("replicas" in cleanOpts) {
            const replicaCount = cleanOpts.replicas;
            delete cleanOpts.replicas;
            Object.defineProperty(cleanOpts, "replicas", {
                value: replicaCount,
                enumerable: false,
                configurable: true,
            });
        }
        const os = await js.views.os(name, cleanOpts as Partial<ObjectStoreOptions>);
        const status = await os.status();
        const objects = await os.list();
        return {
            bucket: status.bucket,
            description: status.description,
            size: status.size,
            storage: String(status.storage),
            replicas: status.replicas,
            sealed: status.sealed,
            objectCount: objects.filter((o) => !o.deleted).length,
        };
    });
}

/**
 * Delete an Object Store bucket.
 */
export async function deleteOSBucket(
    config: NatsConnectionConfig,
    name: string
): Promise<ActionResponse<void>> {
    return withJetStream(config, "deleteOSBucket", async ({ js }) => {
        const os = await js.views.os(name);
        await os.destroy();
    });
}

/**
 * Seal an Object Store bucket. Irreversible — no further puts/deletes allowed.
 */
export async function sealOSBucket(
    config: NatsConnectionConfig,
    name: string
): Promise<ActionResponse<OsBucketInfo>> {
    return withJetStream(config, "sealOSBucket", async ({ js }) => {
        const os = await js.views.os(name);
        const status = await os.seal();
        const objects = await os.list();
        return {
            bucket: status.bucket,
            description: status.description,
            size: status.size,
            storage: String(status.storage),
            replicas: status.replicas,
            sealed: status.sealed,
            objectCount: objects.filter((o) => !o.deleted).length,
        };
    });
}

/**
 * Fetch status for a single Object Store bucket.
 */
export async function getOSBucket(
    config: NatsConnectionConfig,
    name: string
): Promise<ActionResponse<OsBucketInfo>> {
    return withJetStream(config, "getOSBucket", async ({ js }) => {
        const os = await js.views.os(name);
        const status = await os.status();
        const objects = await os.list();
        return {
            bucket: status.bucket,
            description: status.description,
            size: status.size,
            storage: String(status.storage),
            replicas: status.replicas,
            sealed: status.sealed,
            objectCount: objects.filter((o) => !o.deleted).length,
        };
    });
}

/**
 * List all objects in an Object Store bucket.
 */
export async function listObjects(
    config: NatsConnectionConfig,
    bucket: string
): Promise<ActionResponse<{ objects: OsObjectInfo[] }>> {
    return withJetStream(config, "listObjects", async ({ js }) => {
        const os = await js.views.os(bucket);
        const items = await os.list();

        const objects: OsObjectInfo[] = items
            .filter((o) => !o.deleted)
            .map(serializeObjectInfo);

        return { objects };
    });
}

/**
 * Get metadata for a single object.
 */
export async function getObjectInfo(
    config: NatsConnectionConfig,
    bucket: string,
    name: string
): Promise<ActionResponse<OsObjectInfo>> {
    return withJetStream(config, "getObjectInfo", async ({ js }) => {
        const os = await js.views.os(bucket);
        const info = await os.info(name);
        if (!info) throw new Error(`Object "${name}" not found`);
        return serializeObjectInfo(info);
    });
}

/**
 * Upload a file to an Object Store bucket.
 * Accepts base64-encoded data and decodes server-side.
 */
export async function uploadObject(
    config: NatsConnectionConfig,
    bucket: string,
    name: string,
    base64Data: string,
    metadata?: Record<string, string>
): Promise<ActionResponse<OsObjectInfo>> {
    return withJetStream(config, "uploadObject", async ({ js }) => {
        const os = await js.views.os(bucket);
        // Decode base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const info = await os.putBlob(
            { name, metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined },
            bytes
        );
        return serializeObjectInfo(info);
    });
}

/**
 * Update object metadata and/or rename (via ObjectStore.update).
 */
export async function updateObjectMeta(
    config: NatsConnectionConfig,
    bucket: string,
    name: string,
    meta: { name?: string; description?: string; metadata?: Record<string, string> }
): Promise<ActionResponse<OsObjectInfo>> {
    return withJetStream(config, "updateObjectMeta", async ({ js }) => {
        const os = await js.views.os(bucket);
        await os.update(name, meta);
        const info = await os.info(meta.name || name);
        if (!info) throw new Error(`Object "${meta.name || name}" not found after update`);
        return serializeObjectInfo(info);
    });
}

/**
 * Download a file from an Object Store bucket.
 * Returns base64-encoded data.
 */
export async function downloadObject(
    config: NatsConnectionConfig,
    bucket: string,
    name: string
): Promise<ActionResponse<{ data: string; name: string }>> {
    return withJetStream(config, "downloadObject", async ({ js }) => {
        const os = await js.views.os(bucket);
        const blob = await os.getBlob(name);
        if (!blob) throw new Error(`Object "${name}" not found or empty`);

        // Encode Uint8Array to base64
        let binary = "";
        for (let i = 0; i < blob.length; i++) {
            binary += String.fromCharCode(blob[i]);
        }
        const base64 = btoa(binary);
        return { data: base64, name };
    });
}

/**
 * Fetch object content for in-browser preview.
 * Attempts UTF-8 text decoding; returns binary flag when the content
 * is not valid UTF-8 (caller should show a hex dump or "binary file" notice).
 */
export async function getObjectContent(
    config: NatsConnectionConfig,
    bucket: string,
    name: string
): Promise<ActionResponse<{ text: string; binary: boolean; size: number }>> {
    return withJetStream(config, "getObjectContent", async ({ js }) => {
        const os = await js.views.os(bucket);
        const blob = await os.getBlob(name);
        if (!blob) throw new Error(`Object "${name}" not found or empty`);

        // Attempt UTF-8 decode. If invalid byte sequences are found,
        // return a hex representation instead.
        try {
            const decoder = new TextDecoder("utf-8", { fatal: true });
            const text = decoder.decode(blob);
            return { text, binary: false, size: blob.length };
        } catch {
            // Binary content — return hex dump (first 4 KB)
            const slice = blob.slice(0, 4096);
            const hex = Array.from(slice)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(" ");
            return { text: hex, binary: true, size: blob.length };
        }
    });
}

/**
 * Delete a single object from an Object Store bucket.
 */
export async function deleteObject(
    config: NatsConnectionConfig,
    bucket: string,
    name: string
): Promise<ActionResponse<void>> {
    return withJetStream(config, "deleteObject", async ({ js }) => {
        const os = await js.views.os(bucket);
        await os.delete(name);
    });
}
