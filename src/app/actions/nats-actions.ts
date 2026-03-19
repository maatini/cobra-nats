"use server";

import { natsManager } from "@/lib/nats/NatsManager";
import { ActionResponse, NatsConnectionConfig } from "@/lib/nats/nats-types";
import { getErrorMessage, withNatsConnection } from "@/app/actions/action-helpers";
import { type ServerInfo } from "nats";

/**
 * Tests connectivity to a NATS server without persisting the connection.
 */
export async function testConnection(config: Omit<NatsConnectionConfig, "id">): Promise<ActionResponse<{ serverInfo: ServerInfo }>> {
    const tempId = `test-${Date.now()}`;
    try {
        const nc = await natsManager.getConnection({ ...config, id: tempId } as NatsConnectionConfig);
        const serverInfo = nc.info!;
        await natsManager.closeConnection(tempId);
        return { success: true, data: { serverInfo } };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err) || "Failed to connect to NATS" };
    }
}

/**
 * Retrieves server info from an active NATS connection.
 */
export async function getServerInfo(config: NatsConnectionConfig): Promise<ActionResponse<{ info: ServerInfo }>> {
    return withNatsConnection(config, "getServerInfo", async (nc) => {
        return { info: nc.info! };
    });
}
