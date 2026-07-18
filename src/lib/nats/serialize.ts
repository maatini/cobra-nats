/**
 * JSON-safe serializers for JetStream types returned from Server Actions.
 * Keeps Dates/BigInt/class instances out of the client contract (Q1).
 */

import type {
    StreamInfoDto,
    StreamConfigDto,
    StreamStateDto,
    StreamSourceDto,
    StreamSourceLiveDto,
    StreamExternalDto,
    ConsumerInfoDto,
    ConsumerConfigDto,
    SequenceInfoDto,
} from "@/types/nats";

/** Coerce unknown numeric-ish values (including bigint) to number. */
function num(value: unknown, fallback = 0): number {
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) {
        return Number(value);
    }
    return fallback;
}

function str(value: unknown, fallback = ""): string {
    if (value == null) return fallback;
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

function optStr(value: unknown): string | undefined {
    if (value == null || value === "") return undefined;
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

function optNum(value: unknown): number | undefined {
    if (value == null || value === "") return undefined;
    const n = num(value, NaN);
    return Number.isFinite(n) ? n : undefined;
}

function optBool(value: unknown): boolean | undefined {
    if (value == null) return undefined;
    return Boolean(value);
}

function externalDto(raw: unknown): StreamExternalDto | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const e = raw as Record<string, unknown>;
    if (!e.api) return undefined;
    return {
        api: str(e.api),
        deliver: optStr(e.deliver),
    };
}

function sourceDto(raw: unknown): StreamSourceDto | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const s = raw as Record<string, unknown>;
    if (!s.name) return undefined;
    return {
        name: str(s.name),
        filter_subject: optStr(s.filter_subject),
        opt_start_seq: optNum(s.opt_start_seq),
        opt_start_time: optStr(s.opt_start_time),
        external: externalDto(s.external),
        domain: optStr(s.domain),
    };
}

function sourceLiveDto(raw: unknown): StreamSourceLiveDto | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const s = raw as Record<string, unknown>;
    if (!s.name) return undefined;
    return {
        name: str(s.name),
        lag: optNum(s.lag),
        active: optNum(s.active),
        filter_subject: optStr(s.filter_subject),
        external: externalDto(s.external),
    };
}

function streamConfigDto(raw: unknown): StreamConfigDto {
    const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const subjects = Array.isArray(c.subjects)
        ? c.subjects.map((s) => String(s))
        : undefined;
    const sources = Array.isArray(c.sources)
        ? (c.sources.map(sourceDto).filter(Boolean) as StreamSourceDto[])
        : undefined;

    return {
        name: str(c.name),
        subjects,
        retention: str(c.retention, "limits"),
        storage: str(c.storage, "file"),
        max_consumers: optNum(c.max_consumers),
        max_msgs: num(c.max_msgs, -1),
        max_bytes: num(c.max_bytes, -1),
        max_age: num(c.max_age, 0),
        max_msgs_per_subject: optNum(c.max_msgs_per_subject),
        max_msg_size: optNum(c.max_msg_size),
        discard: str(c.discard, "old"),
        discard_new_per_subject: optBool(c.discard_new_per_subject),
        num_replicas: num(c.num_replicas, 1),
        description: optStr(c.description),
        duplicate_window: optNum(c.duplicate_window),
        compression: optStr(c.compression),
        allow_rollup_hdrs: optBool(c.allow_rollup_hdrs),
        deny_delete: optBool(c.deny_delete),
        deny_purge: optBool(c.deny_purge),
        allow_direct: optBool(c.allow_direct),
        mirror_direct: optBool(c.mirror_direct),
        sealed: optBool(c.sealed),
        mirror: sourceDto(c.mirror),
        sources: sources?.length ? sources : undefined,
        metadata:
            c.metadata && typeof c.metadata === "object"
                ? Object.fromEntries(
                      Object.entries(c.metadata as Record<string, unknown>).map(([k, v]) => [
                          k,
                          String(v),
                      ])
                  )
                : undefined,
    };
}

function streamStateDto(raw: unknown): StreamStateDto {
    const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
        messages: num(s.messages),
        bytes: num(s.bytes),
        first_seq: num(s.first_seq),
        last_seq: num(s.last_seq),
        consumer_count: num(s.consumer_count),
        first_ts: optStr(s.first_ts),
        last_ts: optStr(s.last_ts),
        num_deleted: optNum(s.num_deleted),
        num_subjects: optNum(s.num_subjects),
    };
}

/** Convert a raw nats StreamInfo into a browser-safe DTO. */
export function serializeStreamInfo(info: unknown): StreamInfoDto {
    const i = (info && typeof info === "object" ? info : {}) as Record<string, unknown>;
    const sources = Array.isArray(i.sources)
        ? (i.sources.map(sourceLiveDto).filter(Boolean) as StreamSourceLiveDto[])
        : undefined;

    return {
        config: streamConfigDto(i.config),
        created: str(i.created, new Date(0).toISOString()),
        state: streamStateDto(i.state),
        mirror: sourceLiveDto(i.mirror),
        sources: sources?.length ? sources : undefined,
        ts: optStr(i.ts),
    };
}

function sequenceDto(raw: unknown): SequenceInfoDto {
    const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
        consumer_seq: num(s.consumer_seq),
        stream_seq: num(s.stream_seq),
        last_active: optNum(s.last_active),
    };
}

function consumerConfigDto(raw: unknown): ConsumerConfigDto {
    const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const filterSubjects = Array.isArray(c.filter_subjects)
        ? c.filter_subjects.map((s) => String(s))
        : undefined;
    const backoff = Array.isArray(c.backoff)
        ? c.backoff.map((b) => num(b))
        : undefined;

    return {
        durable_name: optStr(c.durable_name),
        name: optStr(c.name),
        description: optStr(c.description),
        deliver_policy: str(c.deliver_policy, "all"),
        opt_start_seq: optNum(c.opt_start_seq),
        opt_start_time: optStr(c.opt_start_time),
        ack_policy: str(c.ack_policy, "explicit"),
        ack_wait: optNum(c.ack_wait),
        max_deliver: optNum(c.max_deliver),
        filter_subject: optStr(c.filter_subject),
        filter_subjects: filterSubjects,
        replay_policy: optStr(c.replay_policy),
        rate_limit_bps: optNum(c.rate_limit_bps),
        sample_freq: optStr(c.sample_freq),
        max_waiting: optNum(c.max_waiting),
        max_ack_pending: optNum(c.max_ack_pending),
        headers_only: optBool(c.headers_only),
        deliver_subject: optStr(c.deliver_subject),
        deliver_group: optStr(c.deliver_group),
        flow_control: optBool(c.flow_control),
        idle_heartbeat: optNum(c.idle_heartbeat),
        inactive_threshold: optNum(c.inactive_threshold),
        backoff,
        num_replicas: optNum(c.num_replicas),
        mem_storage: optBool(c.mem_storage),
        metadata:
            c.metadata && typeof c.metadata === "object"
                ? Object.fromEntries(
                      Object.entries(c.metadata as Record<string, unknown>).map(([k, v]) => [
                          k,
                          String(v),
                      ])
                  )
                : undefined,
    };
}

/** Convert a raw nats ConsumerInfo into a browser-safe DTO. */
export function serializeConsumerInfo(info: unknown): ConsumerInfoDto {
    const i = (info && typeof info === "object" ? info : {}) as Record<string, unknown>;
    return {
        stream_name: str(i.stream_name),
        name: str(i.name),
        created: str(i.created, new Date(0).toISOString()),
        config: consumerConfigDto(i.config),
        delivered: sequenceDto(i.delivered),
        ack_floor: sequenceDto(i.ack_floor),
        num_ack_pending: num(i.num_ack_pending),
        num_redelivered: num(i.num_redelivered),
        num_waiting: num(i.num_waiting),
        num_pending: num(i.num_pending),
        push_bound: optBool(i.push_bound),
        ts: optStr(i.ts),
        paused: optBool(i.paused),
    };
}
