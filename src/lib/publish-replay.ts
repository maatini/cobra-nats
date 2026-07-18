/**
 * Build / parse publish form prefill from Message Browser / Monitor "Replay".
 * Uses query params so no shared client store is required.
 */

export interface PublishReplayPrefill {
    subject: string;
    payload: string;
    headers: Array<{ key: string; value: string }>;
}

const MAX_PAYLOAD_LEN = 50_000;
const MAX_HEADER_ENTRIES = 32;

/** Encode a message as `/publish?...` search string (leading `?`). */
export function buildPublishReplayHref(input: {
    subject: string;
    payload: string;
    headers?: Record<string, string | string[]>;
}): string {
    const params = new URLSearchParams();
    params.set("subject", input.subject);
    const payload =
        input.payload.length > MAX_PAYLOAD_LEN
            ? input.payload.slice(0, MAX_PAYLOAD_LEN)
            : input.payload;
    params.set("payload", payload);

    if (input.headers) {
        const entries: Array<{ key: string; value: string }> = [];
        for (const [key, raw] of Object.entries(input.headers)) {
            if (!key) continue;
            if (Array.isArray(raw)) {
                for (const v of raw) {
                    entries.push({ key, value: String(v) });
                }
            } else if (raw != null && raw !== "") {
                entries.push({ key, value: String(raw) });
            }
            if (entries.length >= MAX_HEADER_ENTRIES) break;
        }
        if (entries.length > 0) {
            params.set("headers", JSON.stringify(entries.slice(0, MAX_HEADER_ENTRIES)));
        }
    }

    return `/publish?${params.toString()}`;
}

/** Read prefill from URLSearchParams (client). */
export function parsePublishReplayParams(
    searchParams: URLSearchParams | { get(name: string): string | null }
): PublishReplayPrefill | null {
    const subject = searchParams.get("subject");
    if (!subject) return null;

    const payload = searchParams.get("payload") ?? "";
    let headers: Array<{ key: string; value: string }> = [];
    const headersRaw = searchParams.get("headers");
    if (headersRaw) {
        try {
            const parsed: unknown = JSON.parse(headersRaw);
            if (Array.isArray(parsed)) {
                headers = parsed
                    .filter(
                        (h): h is { key: string; value: string } =>
                            !!h &&
                            typeof h === "object" &&
                            typeof (h as { key?: unknown }).key === "string" &&
                            typeof (h as { value?: unknown }).value === "string"
                    )
                    .slice(0, MAX_HEADER_ENTRIES);
            }
        } catch {
            // ignore bad headers JSON
        }
    }

    return { subject, payload, headers };
}
