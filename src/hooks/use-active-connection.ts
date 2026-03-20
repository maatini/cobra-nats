import { useNatsStore } from "@/store/useNatsStore";
import { NatsConnectionConfig } from "@/lib/nats/nats-types";

/**
 * Returns the currently active NATS connection config, or undefined if none selected.
 * Replaces the repeated pattern of: connections.find((c) => c.id === activeConnectionId)
 */
export function useActiveConnection(): NatsConnectionConfig | undefined {
    const { connections, activeConnectionId } = useNatsStore();
    return connections.find((c) => c.id === activeConnectionId);
}
