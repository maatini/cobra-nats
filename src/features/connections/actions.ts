"use server";

import { natsManager } from "@/lib/nats/manager";
import type { ActionResponse, NatsConnectionConfig } from "@/types/nats";
import { getErrorMessage, withNatsConnection } from "@/lib/server-action";
import type { ServerInfo } from "nats";

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
 * Retrieve server info from an already-active NATS connection (dashboard overview).
 */
export async function getServerInfo(
    config: NatsConnectionConfig
): Promise<ActionResponse<{ info: ServerInfo }>> {
    return withNatsConnection(config, "getServerInfo", async (nc) => {
        return { info: nc.info! };
    });
}
