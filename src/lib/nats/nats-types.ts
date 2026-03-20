/**
 * Shared NATS types used across server actions and client components.
 */

export interface NatsConnectionConfig {
    id: string;
    name: string;
    servers: string[];
    user?: string;
    pass?: string;
    token?: string;
    authType: "none" | "user_pass" | "token";
}

/**
 * Standardized response shape for all server actions.
 */
export type ActionResponse<T> =
    | { success: true; data: T }
    | { success: false; error: string };

/**
 * Serializable KV entry returned from server actions.
 */
export interface KvEntryResult {
    key: string;
    value: string;
    revision: number;
    created: Date;
    delta?: number;
    operation: "PUT" | "DEL" | "PURGE";
}

export enum RetentionPolicy {
    Limits = "limits",
    Interest = "interest",
    WorkQueue = "workqueue",
}

export enum StorageType {
    File = "file",
    Memory = "memory",
}

export enum DiscardPolicy {
    Old = "old",
    New = "new",
}

export enum AckPolicy {
    None = "none",
    All = "all",
    Explicit = "explicit",
}

export interface StreamConfig {
    name: string;
    description?: string;
    subjects?: string[];
    retention: RetentionPolicy;
    storage: StorageType;
    max_msgs: number;
    max_bytes: number;
    max_age: number;
    discard: DiscardPolicy;
    num_replicas: number;
    no_ack?: boolean;
    template_id?: string;
    duplicate_window?: number;
}

export interface StreamInfo {
    config: StreamConfig;
    created: string | Date;
    state: {
        messages: number;
        bytes: number;
        first_seq: number;
        last_seq: number;
        consumer_count: number;
    };
}

export interface ConsumerConfig {
    durable_name?: string;
    description?: string;
    deliver_subject?: string;
    deliver_group?: string;
    deliver_policy: string;
    ack_policy: AckPolicy;
    ack_wait?: number;
    max_deliver?: number;
    filter_subject?: string;
    replay_policy: string;
    sample_frequency?: string;
    max_waiting?: number;
    max_ack_pending?: number;
    flow_control?: boolean;
    idle_heartbeat?: number;
    headers_only?: boolean;
}

export interface ConsumerInfo {
    stream_name: string;
    name: string;
    created: string | Date;
    config: ConsumerConfig;
    delivered: {
        consumer_seq: number;
        stream_seq: number;
    };
    ack_floor: {
        consumer_seq: number;
        stream_seq: number;
    };
    num_pending: number;
    num_redelivered: number;
    num_waiting: number;
    num_headers_only: number;
}

/**
 * Serializable Object Store bucket info returned from server actions.
 */
export interface OsBucketInfo {
    bucket: string;
    description: string;
    size: number;
    storage: string;
    replicas: number;
    sealed: boolean;
    objectCount: number;
}

/**
 * Serializable Object Store object info returned from server actions.
 */
export interface OsObjectInfo {
    name: string;
    size: number;
    chunks: number;
    modified: string;
    digest: string;
    deleted: boolean;
    metadata?: Record<string, string>;
}

/**
 * Serializable stream message returned from server actions.
 */
export interface StreamMessage {
    seq: number;
    subject: string;
    timestamp: string;
    data: string;
    headers: Record<string, string[]>;
    size: number;
}

/**
 * Options for fetching stream messages.
 */
export interface GetStreamMessagesOptions {
    startSeq?: number;
    endSeq?: number;
    subjectFilter?: string;
    batchSize?: number;
}
