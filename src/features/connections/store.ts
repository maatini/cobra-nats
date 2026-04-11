import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { NatsConnectionConfig } from "@/types/nats";

/** localStorage key for the persisted connection state. Referenced by Playwright tests. */
export const CONNECTIONS_STORAGE_KEY = "cobra-nats-storage";

interface NatsState {
    connections: NatsConnectionConfig[];
    activeConnectionId: string | null;
    addConnection: (config: NatsConnectionConfig) => void;
    removeConnection: (id: string) => void;
    setActiveConnection: (id: string | null) => void;
    updateConnection: (id: string, config: Partial<NatsConnectionConfig>) => void;
}

export const useNatsStore = create<NatsState>()(
    persist(
        (set) => ({
            connections: [],
            activeConnectionId: null,

            addConnection: (config) =>
                set((state) => ({
                    connections: [...state.connections, config],
                    activeConnectionId: state.activeConnectionId || config.id,
                })),

            removeConnection: (id) =>
                set((state) => ({
                    connections: state.connections.filter((c) => c.id !== id),
                    activeConnectionId:
                        state.activeConnectionId === id ? null : state.activeConnectionId,
                })),

            setActiveConnection: (id) => set({ activeConnectionId: id }),

            updateConnection: (id, config) =>
                set((state) => ({
                    connections: state.connections.map((c) =>
                        c.id === id ? { ...c, ...config } : c
                    ),
                })),
        }),
        {
            name: CONNECTIONS_STORAGE_KEY,
            storage: createJSONStorage(() => localStorage),
        }
    )
);
