import type { NatsConnection, JetStreamClient, JetStreamManager } from "nats";
import { natsManager } from "@/lib/nats/manager";
import type { NatsConnectionConfig, ActionResponse } from "@/types/nats";

export type { ActionResponse };

export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
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
