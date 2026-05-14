import type { NatsConnection, JetStreamClient, JetStreamManager } from "nats";
import { natsManager } from "@/lib/nats/manager";
import type { NatsConnectionConfig, ActionResponse } from "@/types/nats";

export type { ActionResponse };

/**
 * Map raw NATS / Node.js errors to user-friendly messages.
 * Parses known DNS and TCP error patterns (ENOTFOUND, ECONNREFUSED, etc.)
 * and falls back to the original message for unrecognised errors.
 */
export function getErrorMessage(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const raw = err.message;

    // DNS / hostname resolution errors (getaddrinfo ENOTFOUND <host>)
    const dnsMatch = raw.match(/getaddrinfo\s+ENOTFOUND\s+(\S+)/i);
    if (dnsMatch) {
        return `Hostname not found: "${dnsMatch[1]}". Check the server address — did you mean "localhost"?`;
    }

    // Connection refused (ECONNREFUSED)
    const refusedMatch = raw.match(/ECONNREFUSED/i);
    if (refusedMatch) {
        return "Connection refused. Is the NATS server running on that host and port?";
    }

    // Connection timeout (ETIMEDOUT)
    const timeoutMatch = raw.match(/ETIMEDOUT/i);
    if (timeoutMatch) {
        return "Connection timed out. Check that the server address is reachable and the port is correct.";
    }

    // TLS / certificate errors
    if (/self.signed|certificate|DEPTH_ZERO|SSL|TLS/i.test(raw)) {
        return "TLS error: the server's certificate could not be verified. If this is a development server, use a plain-text connection (nats:// instead of tls://).";
    }

    // Authorization errors from NATS protocol
    if (/authorization|auth/i.test(raw) && !/authType/i.test(raw)) {
        return "Authorization failed. Check your credentials (username/password or token).";
    }

    return raw;
}

/**
 * Wrap a Core-NATS operation (publish, request, …) with standard error handling.
 */
export async function withNatsConnection<T>(
    config: NatsConnectionConfig,
    operationName: string,
    operation: (nc: NatsConnection) => Promise<T>
): Promise<ActionResponse<T>> {
    try {
        const nc = await natsManager.getConnection(config);
        const result = await operation(nc);
        return { success: true, data: result };
    } catch (err: unknown) {
        console.error(`[NATS Action Error] ${operationName}:`, err);
        return { success: false, error: getErrorMessage(err) || `Failed to execute ${operationName}` };
    }
}

/**
 * Wrap a JetStream operation with standard error handling.
 * The JetStreamManager is cached per connection — `js` is created on demand (cheap).
 */
export async function withJetStream<T>(
    config: NatsConnectionConfig,
    operationName: string,
    operation: (params: { js: JetStreamClient; jsm: JetStreamManager }) => Promise<T>
): Promise<ActionResponse<T>> {
    try {
        const nc = await natsManager.getConnection(config);
        const jsm = await natsManager.getJetStreamManager(config);
        const result = await operation({ js: nc.jetstream(), jsm });
        return { success: true, data: result };
    } catch (err: unknown) {
        console.error(`[JetStream Action Error] ${operationName}:`, err);
        return { success: false, error: getErrorMessage(err) || `Failed to execute ${operationName}` };
    }
}
