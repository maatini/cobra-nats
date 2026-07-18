/**
 * Shared NATS types used across server actions and client components.
 *
 * NOTE: JetStream *info* responses use browser-safe DTOs in this file
 * (`StreamInfoDto`, `ConsumerInfoDto`). Server Actions serialize raw `nats`
 * objects via `@/lib/nats/serialize` — do not import StreamInfo/ConsumerInfo
 * from `nats` in client components.
 *
 * Create/update inputs may still use `import type` from `nats` on the server.
 * The enums below mirror the `nats` package values so client forms never pull
 * Node builtins (`dns`, `fs`) into the browser bundle.
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

// ── Stream / Consumer DTOs (browser-safe; never import raw nats types on client) ──

/** External stream reference (mirror/source). */
export interface StreamExternalDto {
    api: string;
    deliver?: string;
}

/** Mirror / source configuration fragment. */
export interface StreamSourceDto {
    name: string;
    filter_subject?: string;
    opt_start_seq?: number;
    opt_start_time?: string;
    external?: StreamExternalDto;
    domain?: string;
}

/** Live mirror/source lag info from StreamInfo. */
export interface StreamSourceLiveDto {
    name: string;
    lag?: number;
    active?: number;
    filter_subject?: string;
    external?: StreamExternalDto;
}

/**
 * Serializable stream config subset used by the UI.
 * Extra keys may be present for export/import fidelity.
 */
export interface StreamConfigDto {
    name: string;
    subjects?: string[];
    retention: string;
    storage: string;
    max_consumers?: number;
    max_msgs: number;
    max_bytes: number;
    max_age: number;
    max_msgs_per_subject?: number;
    max_msg_size?: number;
    discard: string;
    discard_new_per_subject?: boolean;
    num_replicas: number;
    description?: string;
    duplicate_window?: number;
    compression?: string;
    allow_rollup_hdrs?: boolean;
    deny_delete?: boolean;
    deny_purge?: boolean;
    allow_direct?: boolean;
    mirror_direct?: boolean;
    sealed?: boolean;
    mirror?: StreamSourceDto;
    sources?: StreamSourceDto[];
    metadata?: Record<string, string>;
}

export interface StreamStateDto {
    messages: number;
    bytes: number;
    first_seq: number;
    last_seq: number;
    consumer_count: number;
    first_ts?: string;
    last_ts?: string;
    num_deleted?: number;
    num_subjects?: number;
}

/** Full stream info returned from server actions. */
export interface StreamInfoDto {
    config: StreamConfigDto;
    created: string;
    state: StreamStateDto;
    mirror?: StreamSourceLiveDto;
    sources?: StreamSourceLiveDto[];
    ts?: string;
}

/** Serializable consumer config subset used by the UI. */
export interface ConsumerConfigDto {
    durable_name?: string;
    name?: string;
    description?: string;
    deliver_policy: string;
    opt_start_seq?: number;
    opt_start_time?: string;
    ack_policy: string;
    ack_wait?: number;
    max_deliver?: number;
    filter_subject?: string;
    filter_subjects?: string[];
    replay_policy?: string;
    rate_limit_bps?: number;
    sample_freq?: string;
    max_waiting?: number;
    max_ack_pending?: number;
    headers_only?: boolean;
    deliver_subject?: string;
    deliver_group?: string;
    flow_control?: boolean;
    idle_heartbeat?: number;
    inactive_threshold?: number;
    backoff?: number[];
    num_replicas?: number;
    mem_storage?: boolean;
    metadata?: Record<string, string>;
}

export interface SequenceInfoDto {
    consumer_seq: number;
    stream_seq: number;
    last_active?: number;
}

/** Full consumer info returned from server actions. */
export interface ConsumerInfoDto {
    stream_name: string;
    name: string;
    created: string;
    config: ConsumerConfigDto;
    delivered: SequenceInfoDto;
    ack_floor: SequenceInfoDto;
    num_ack_pending: number;
    num_redelivered: number;
    num_waiting: number;
    num_pending: number;
    push_bound?: boolean;
    ts?: string;
    paused?: boolean;
}
