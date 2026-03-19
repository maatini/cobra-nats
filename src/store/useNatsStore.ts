import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { NatsConnectionConfig } from "@/lib/nats/nats-types";

export type { NatsConnectionConfig };

interface NatsState {
    connections: NatsConnectionConfig[];
    activeConnectionId: string | null;
    sidebarOpen: boolean;

    // Actions
    addConnection: (config: NatsConnectionConfig) => void;
    removeConnection: (id: string) => void;
    setActiveConnection: (id: string | null) => void;
    setSidebarOpen: (open: boolean) => void;
    updateConnection: (id: string, config: Partial<NatsConnectionConfig>) => void;
}

export const useNatsStore = create<NatsState>()(
    persist(
        (set) => ({
            connections: [],
            activeConnectionId: null,
            sidebarOpen: true,

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

            setSidebarOpen: (open) => set({ sidebarOpen: open }),

            updateConnection: (id, config) =>
                set((state) => ({
                    connections: state.connections.map((c) =>
                        c.id === id ? { ...c, ...config } : c
                    ),
                })),
        }),
        {
            name: "cobra-nats-storage",
            storage: createJSONStorage(() => localStorage),
        }
    )
);
