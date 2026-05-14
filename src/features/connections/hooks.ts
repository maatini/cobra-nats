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

/**
 * Polls the active connection every 30s to verify real connectivity.
 * Returns { status, rttMs, error } for the Topbar health indicator.
 */
export function useConnectionHealth(): HealthState {
    const activeConnection = useActiveConnection();
    const [health, setHealth] = useState<HealthState>({
        status: "checking",
        rttMs: null,
        error: null,
    });
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        if (!activeConnection) {
            setHealth({ status: "disconnected", rttMs: null, error: null });
            return;
        }

        let timer: ReturnType<typeof setTimeout>;

        async function check() {
            const result = await pingConnection({
                name: activeConnection!.name,
                servers: activeConnection!.servers,
                authType: activeConnection!.authType,
                user: activeConnection!.user,
                pass: activeConnection!.pass,
                token: activeConnection!.token,
            });

            if (!mountedRef.current) return;

            if (result.success && result.data) {
                setHealth({ status: "connected", rttMs: result.data.rttMs, error: null });
            } else {
                setHealth({ status: "disconnected", rttMs: null, error: result.error || null });
            }

            timer = setTimeout(check, 30_000);
        }

        // Fire immediately, then every 30s
        check();

        return () => {
            mountedRef.current = false;
            clearTimeout(timer);
        };
    }, [activeConnection?.id]);

    return health;
}
