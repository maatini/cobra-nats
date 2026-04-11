/**
 * Shared NATS types used across server actions and client components.
 *
 * NOTE: Core NATS/JetStream *types* (StreamConfig, StreamInfo, ConsumerConfig,
 * ConsumerInfo) come from the `nats` package — import them directly there.
 *
 * The enums below mirror the `nats` package values. We re-define them (instead
 * of re-exporting) so client components can use them without pulling the full
 * `nats` package — which imports Node builtins (`dns`, `fs`) — into the browser
 * bundle. Values must stay in sync with `nats/lib/jetstream/jsapi_types`.
 */

export enum RetentionPolicy {
    Limits = "limits",
    Interest = "interest",
    Workqueue = "workqueue",
}

export enum StorageType {
    File = "file",
    Memory = "memory",
}

export enum DiscardPolicy {
    Old = "old",
    New = "new",
}

export interface NatsConnectionConfig {
    id: string;
    name: string;
    servers: string[];
    user?: string;
    pass?: string;
    token?: string;
    authType: "none" | "user_pass" | "token";
}

/** Standardized response shape for all server actions. */
export type ActionResponse<T> =
    | { success: true; data: T }
    | { success: false; error: string };

/** Serializable KV entry returned from server actions. */
export interface KvEntryResult {
    key: string;
    value: string;
    revision: number;
    created: Date;
    delta?: number;
    operation: "PUT" | "DEL" | "PURGE";
}

/** Serializable Object Store bucket info returned from server actions. */
export interface OsBucketInfo {
    bucket: string;
    description: string;
    size: number;
    storage: string;
    replicas: number;
    sealed: boolean;
    objectCount: number;
}

/** Serializable Object Store object info returned from server actions. */
export interface OsObjectInfo {
    name: string;
    size: number;
    chunks: number;
    modified: string;
    digest: string;
    deleted: boolean;
    metadata?: Record<string, string>;
}

/** Serializable stream message returned from server actions. */
export interface StreamMessage {
    seq: number;
    subject: string;
    timestamp: string;
    data: string;
    headers: Record<string, string[]>;
    size: number;
}

/** Options for fetching stream messages. */
export interface GetStreamMessagesOptions {
    startSeq?: number;
    endSeq?: number;
    subjectFilter?: string;
    batchSize?: number;
}
