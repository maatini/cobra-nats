import { useState, useEffect, useRef } from "react";
import { useNatsStore } from "@/features/connections/store";
import type { NatsConnectionConfig } from "@/types/nats";
import { pingConnection } from "@/features/connections/actions";

/**
 * Returns the currently active NATS connection config, or undefined if none selected.
 * Replaces the repeated pattern of: connections.find((c) => c.id === activeConnectionId)
 */
export function useActiveConnection(): NatsConnectionConfig | undefined {
    const { connections, activeConnectionId } = useNatsStore();
    return connections.find((c) => c.id === activeConnectionId);
}

type HealthState = {
    status: "checking" | "connected" | "disconnected";
    rttMs: number | null;
    error: string | null;
};

/** Health tagged with the connection it was measured on, so results never leak across connections. */
type ConnectionHealth = HealthState & { connectionId: string };

const DISCONNECTED: HealthState = { status: "disconnected", rttMs: null, error: null };
const CHECKING: HealthState = { status: "checking", rttMs: null, error: null };

/**
 * Polls the active connection every 30s to verify real connectivity.
 * Returns { status, rttMs, error } for the Topbar health indicator.
 */
export function useConnectionHealth(): HealthState {
    const activeConnection = useActiveConnection();
    const [health, setHealth] = useState<ConnectionHealth | null>(null);
    const mountedRef = useRef(true);
    const connectionId = activeConnection?.id;

    useEffect(() => {
        if (!activeConnection) return;

        mountedRef.current = true;

        const config = activeConnection;
        let timer: ReturnType<typeof setTimeout>;

        async function check() {
            const result = await pingConnection({
                name: config.name,
                servers: config.servers,
                authType: config.authType,
                user: config.user,
                pass: config.pass,
                token: config.token,
                nkeySeed: config.nkeySeed,
                jwt: config.jwt,
                creds: config.creds,
                tls: config.tls,
            });

            if (!mountedRef.current) return;

            if (result.success) {
                setHealth({ connectionId: config.id, status: "connected", rttMs: result.data.rttMs, error: null });
            } else {
                setHealth({
                    connectionId: config.id,
                    status: "disconnected",
                    rttMs: null,
                    error: result.error || null,
                });
            }

            timer = setTimeout(check, 30_000);
        }

        // Fire immediately, then every 30s
        void check();

        return () => {
            mountedRef.current = false;
            clearTimeout(timer);
        };
        // Re-run only when the selected connection identity changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: activeConnection?.id
    }, [connectionId]);

    if (!activeConnection) return DISCONNECTED;
    if (!health || health.connectionId !== activeConnection.id) return CHECKING;
    return health;
}
