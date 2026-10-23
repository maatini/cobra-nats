import "server-only";

import { z } from "zod";
import type { ActionResponse, NatsConnectionConfig } from "@/types/nats";

const NatsTlsConfigSchema = z.object({
    enabled: z.boolean().optional(),
    ca: z.string().optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
});

export const NatsConnectionConfigSchema = z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    servers: z.array(z.string().trim().min(1)).min(1),
    authType: z.enum(["none", "user_pass", "token", "nkey", "jwt", "creds"]),
    user: z.string().optional(),
    pass: z.string().optional(),
    token: z.string().optional(),
    nkeySeed: z.string().optional(),
    jwt: z.string().optional(),
    creds: z.string().optional(),
    tls: NatsTlsConfigSchema.optional(),
    monitoringUrl: z.string().optional(),
});

export const NatsConnectionConfigWithoutIdSchema = NatsConnectionConfigSchema.omit({ id: true });

export const MonitorRequestSchema = z.object({
    config: NatsConnectionConfigSchema,
    subject: z.string().optional(),
});

export const OsDownloadRequestSchema = z.object({
    config: NatsConnectionConfigSchema,
    bucket: z.string().trim().min(1),
    name: z.string().trim().min(1),
});

export const OsUploadFieldsSchema = z.object({
    bucket: z.string().trim().min(1),
    name: z.string().trim().optional(),
    connection: z.string().min(1),
});

export const MonitoringActionSchema = z.object({
    monitoringUrl: z.string().trim().url(),
    endpoint: z.enum(["varz", "jsz", "connz"]).optional(),
});

export const StreamMessagesOptionsSchema = z.object({
    startSeq: z.number().int().positive().optional(),
    endSeq: z.number().int().positive().optional(),
    subjectFilter: z.string().optional(),
    batchSize: z.number().int().min(1).max(200).optional(),
});

export const UploadMetadataSchema = z.record(z.string(), z.string());

export const MAX_OS_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isValidNatsConnectionConfig(input: unknown): input is NatsConnectionConfig {
    return NatsConnectionConfigSchema.safeParse(input).success;
}

export function isValidConnectionConfigWithoutId(
    input: unknown,
): input is Omit<NatsConnectionConfig, "id"> {
    return NatsConnectionConfigWithoutIdSchema.safeParse(input).success;
}

export function isValidMonitoringActionInput(input: unknown): input is {
    monitoringUrl: string;
    endpoint?: "varz" | "jsz" | "connz";
} {
    return MonitoringActionSchema.safeParse(input).success;
}

export function isValidStreamMessagesOptions(input: unknown): input is {
    startSeq?: number;
    endSeq?: number;
    subjectFilter?: string;
    batchSize?: number;
} {
    return StreamMessagesOptionsSchema.safeParse(input).success;
}

export function isValidUploadMetadata(input: unknown): input is Record<string, string> {
    return UploadMetadataSchema.safeParse(input).success;
}

export function isValidOsUploadFields(input: unknown): input is {
    bucket: string;
    name?: string;
    connection: string;
} {
    return OsUploadFieldsSchema.safeParse(input).success;
}

export function isValidMonitorRequest(input: unknown): input is {
    config: NatsConnectionConfig;
    subject?: string;
} {
    return MonitorRequestSchema.safeParse(input).success;
}

export function isValidOsDownloadRequest(input: unknown): input is {
    config: NatsConnectionConfig;
    bucket: string;
    name: string;
} {
    return OsDownloadRequestSchema.safeParse(input).success;
}

export type ValidatedNatsConnectionConfig = z.infer<typeof NatsConnectionConfigSchema>;
export type ValidatedNatsConnectionConfigWithoutId = z.infer<typeof NatsConnectionConfigWithoutIdSchema>;

/** Parse untrusted server-action input without letting validation exceptions escape. */
export function parseActionInput<T>(
    schema: z.ZodType<T>,
    input: unknown,
): { success: true; data: T } | { success: false; error: ActionResponse<never> } {
    const result = schema.safeParse(input);
    if (!result.success) {
        return {
            success: false,
            error: {
                success: false,
                error: result.error.issues.map((issue) => issue.message).join("; "),
            },
        };
    }
    return { success: true, data: result.data };
}

export function parseNatsConnectionConfig(input: unknown):
    | { success: true; data: NatsConnectionConfig }
    | { success: false; error: ActionResponse<never> } {
    return parseActionInput(NatsConnectionConfigSchema, input);
}

export function parseNatsConnectionConfigWithoutId(input: unknown):
    | { success: true; data: Omit<NatsConnectionConfig, "id"> }
    | { success: false; error: ActionResponse<never> } {
    return parseActionInput(NatsConnectionConfigWithoutIdSchema, input);
}
