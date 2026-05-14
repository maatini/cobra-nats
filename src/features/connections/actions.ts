"use server";

import { natsManager } from "@/lib/nats/manager";
import type { ActionResponse, NatsConnectionConfig } from "@/types/nats";
import { getErrorMessage, withNatsConnection } from "@/lib/server-action";
import type { ServerInfo } from "nats";
import { connect } from "nats";

/**
 * Probe a NATS server without persisting the connection (used by Connect-Dialog's "Test" button).
 * Opens a throwaway connection with a generated temp-id, returns server info, then closes it.
 */
export async function testConnection(
    config: Omit<NatsConnectionConfig, "id">
): Promise<ActionResponse<{ serverInfo: ServerInfo }>> {
    const tempConfig: NatsConnectionConfig = { ...config, id: `test-${Date.now()}` };
    try {
        const nc = await natsManager.getConnection(tempConfig);
        const serverInfo = nc.info!;
        await natsManager.closeConnection(tempConfig.id);
        return { success: true, data: { serverInfo } };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err) || "Failed to connect to NATS" };
    }
}

/**
 * Lightweight connectivity probe (used by the Topbar health indicator).
 * Opens a short-lived connection with fast-fail options and measures round-trip time.
 */
export async function pingConnection(
    config: Omit<NatsConnectionConfig, "id">
): Promise<ActionResponse<{ rttMs: number }>> {
    try {
        const start = performance.now();
        const nc = await connect({
            servers: config.servers,
            user: config.user,
            pass: config.pass,
            token: config.token,
            name: `Cobra NATS - health`,
            maxReconnectAttempts: 0,
            reconnect: false,
            timeout: 5000,
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
    return withNatsConnection(config, "getServerInfo", async (nc) => {
        return { info: nc.info! };
    });
}
