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

/** Mirror of nats StoreCompression — browser-safe. */
export enum StoreCompression {
    None = "none",
    S2 = "s2",
}

export type NatsAuthType = "none" | "user_pass" | "token" | "nkey" | "jwt" | "creds";

/** HTTP monitoring endpoints (NATS `-m` / monitoring port). */
export type HttpMonitoringEndpoint = "varz" | "jsz" | "connz";

/** Optional TLS material (PEM strings). Prefer server-side paths in future hard-sec deployments. */
export interface NatsTlsConfig {
    /** Force TLS even if server URL is not tls:// */
    enabled?: boolean;
    /** CA / root certificate PEM */
    ca?: string;
    /** Client certificate PEM */
    cert?: string;
    /** Client private key PEM */
    key?: string;
}

export interface NatsConnectionConfig {
    id: string;
    name: string;
    servers: string[];
    user?: string;
    pass?: string;
    token?: string;
    /** NKey seed (e.g. SU…) for nkey or JWT+seed auth */
    nkeySeed?: string;
    /** User JWT (for jwt auth; bearer JWT alone is valid without seed) */
    jwt?: string;
    /** Full contents of a NATS .creds file */
    creds?: string;
    tls?: NatsTlsConfig;
    authType: NatsAuthType;
    /**
     * Optional NATS HTTP monitoring base URL (e.g. http://localhost:8222).
     * Used for varz/jsz/connz — separate from client protocol auth.
     */
    monitoringUrl?: string;
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

/** Options for purging messages from a stream. */
export interface PurgeStreamOptions {
    /** Restrict purge to this subject filter. */
    filter?: string;
    /** Purge up to (but not including) this sequence. */
    seq?: number;
    /** Keep this many messages (from the end). Mutually exclusive with seq in most servers. */
    keep?: number;
}

/** Serializable JetStream account / storage overview. */
export interface JetStreamAccountOverview {
    memory: number;
    storage: number;
    streams: number;
    consumers: number;
    domain?: string;
    limits: {
        maxMemory: number;
        maxStorage: number;
        maxStreams: number;
        maxConsumers: number;
    };
    api: {
        total: number;
        errors: number;
    };
}
