"use server";

import { natsManager } from "@/lib/nats/manager";
import type {
    ActionResponse,
    HttpMonitoringEndpoint,
    NatsConnectionConfig,
} from "@/types/nats";
import { getErrorMessage, withNatsConnection } from "@/lib/server-action";
import type { ServerInfo } from "nats";
import { connectWithConfig } from "@/lib/nats/connect-options";
import { createMonitoringEndpointUrl } from "@/lib/server/monitoring-url-policy";
import {
    MonitoringActionSchema,
    parseNatsConnectionConfig,
    parseNatsConnectionConfigWithoutId,
} from "@/lib/validation/nats";

/**
 * Probe a NATS server without persisting the connection (used by Connect-Dialog's "Test" button).
 * Opens a throwaway connection with a generated temp-id, returns server info, then closes it.
 */
export async function testConnection(
    config: Omit<NatsConnectionConfig, "id">
): Promise<ActionResponse<{ serverInfo: ServerInfo }>> {
    const parsed = parseNatsConnectionConfigWithoutId(config);
    if (!parsed.success) return parsed.error;
    const tempConfig: NatsConnectionConfig = { ...parsed.data, id: `test-${Date.now()}` };
    try {
        const nc = await natsManager.getConnection(tempConfig);
        const serverInfo = nc.info!;
        return { success: true, data: { serverInfo } };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err) || "Failed to connect to NATS" };
    } finally {
        try {
            await natsManager.closeConnection(tempConfig.id);
        } catch (err: unknown) {
            console.error("Error closing test connection:", err);
        }
    }
}

/**
 * Lightweight connectivity probe (used by the Topbar health indicator).
 * Opens a short-lived connection with fast-fail options and measures round-trip time.
 */
export async function pingConnection(
    config: Omit<NatsConnectionConfig, "id">
): Promise<ActionResponse<{ rttMs: number }>> {
    const parsed = parseNatsConnectionConfigWithoutId(config);
    if (!parsed.success) return parsed.error;
    try {
        const start = performance.now();
        const nc = await connectWithConfig(parsed.data, {
            maxReconnectAttempts: 0,
            reconnect: false,
            timeout: 5000,
            name: "Cobra NATS - health",
        });
        await nc.flush();
        const rttMs = Math.round(performance.now() - start);
        await nc.close();
        return { success: true, data: { rttMs } };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Retrieve server info from an already-active NATS connection (dashboard overview).
 */
export async function getServerInfo(
    config: NatsConnectionConfig
): Promise<ActionResponse<{ info: ServerInfo }>> {
    const parsed = parseNatsConnectionConfig(config);
    if (!parsed.success) return parsed.error;
    return withNatsConnection(parsed.data, "getServerInfo", async (nc) => {
        return { info: nc.info! };
    });
}

/**
 * Fetch NATS HTTP monitoring JSON (varz / jsz / connz) via server-side fetch.
 * Uses the connection's `monitoringUrl` (e.g. http://localhost:8222).
 * Does not use the NATS client protocol.
 */
export async function fetchHttpMonitoring(
    monitoringUrl: string,
    endpoint: HttpMonitoringEndpoint = "varz"
): Promise<ActionResponse<{ endpoint: HttpMonitoringEndpoint; data: Record<string, unknown> }>> {
    const parsed = MonitoringActionSchema.safeParse({ monitoringUrl, endpoint });
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map((issue) => issue.message).join("; ") };
    }
    const { monitoringUrl: validatedUrl, endpoint: validatedEndpoint = "varz" } = parsed.data;
    const policy = createMonitoringEndpointUrl(validatedUrl, validatedEndpoint);
    if (!policy.success) return { success: false, error: policy.error };

    try {
        const res = await fetch(policy.url, {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            return {
                success: false,
                error: `Monitoring ${validatedEndpoint} failed: HTTP ${res.status}`,
            };
        }

        const data = (await res.json()) as Record<string, unknown>;
        return { success: true, data: { endpoint: validatedEndpoint, data } };
    } catch (err: unknown) {
        return {
            success: false,
            error: getErrorMessage(err) || "Failed to fetch monitoring endpoint",
        };
    }
}
