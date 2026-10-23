import { connect, type NatsConnection, type JetStreamManager } from "nats";
import type { NatsConnectionConfig } from "@/types/nats";
import { buildConnectionOptions } from "@/lib/nats/connect-options";

/**
 * Singleton connection pool. Connection and JetStream-manager entries are bound
 * to a generation/connection identity so stale async work cannot repopulate the
 * pool after closeConnection() invalidates it.
 */
export class NatsManager {
    private static instance: NatsManager;
    /** Live plus in-flight ids. New ids are rejected when this cap is reached. */
    private static readonly MAX_POOL_SIZE = 32;
    private connections = new Map<string, NatsConnection>();
    private connecting = new Map<string, { generation: number; promise: Promise<NatsConnection> }>();
    private generations = new Map<string, number>();
    private jsmCache = new Map<string, { connection: NatsConnection; manager: JetStreamManager }>();
    private jsmPending = new Map<string, { connection: NatsConnection; promise: Promise<JetStreamManager> }>();

    private constructor() { }

    static getInstance(): NatsManager {
        if (!NatsManager.instance) NatsManager.instance = new NatsManager();
        return NatsManager.instance;
    }

    async getConnection(config: NatsConnectionConfig): Promise<NatsConnection> {
        const id = config.id;
        const existing = this.connections.get(id);
        if (existing && !existing.isClosed()) return existing;
        if (existing) {
            this.connections.delete(id);
            this.jsmCache.delete(id);
            this.jsmPending.delete(id);
        }

        const pending = this.connecting.get(id);
        if (pending) return pending.promise;

        const liveIds = new Set([...this.connections.keys(), ...this.connecting.keys()]);
        if (liveIds.size >= NatsManager.MAX_POOL_SIZE) {
            throw new Error(
                `NATS connection pool is full (maximum ${NatsManager.MAX_POOL_SIZE} live or connecting connections)`
            );
        }

        const generation = this.generations.get(id) ?? 0;
        const slot: { promise?: Promise<NatsConnection> } = {};
        slot.promise = (async () => {
            try {
                const nc = await connect(buildConnectionOptions(config));
                const current = this.connecting.get(id);
                if ((this.generations.get(id) ?? 0) !== generation || current?.promise !== slot.promise) {
                    await nc.close();
                    throw new Error(`NATS connection for ${id} was closed while connecting`);
                }
                this.connections.set(id, nc);
                return nc;
            } catch (err) {
                if (err instanceof Error && /closed while connecting/.test(err.message)) throw err;
                console.error(`Failed to connect to NATS (${config.name}):`, err);
                throw err;
            } finally {
                if (this.connecting.get(id)?.promise === slot.promise) this.connecting.delete(id);
            }
        })();
        this.connecting.set(id, { generation, promise: slot.promise });
        return slot.promise;
    }

    /** Cached JetStream manager, only valid for the connection that created it. */
    async getJetStreamManager(config: NatsConnectionConfig): Promise<JetStreamManager> {
        const nc = await this.getConnection(config);
        const cached = this.jsmCache.get(config.id);
        if (cached?.connection === nc) return cached.manager;

        const pending = this.jsmPending.get(config.id);
        if (pending?.connection === nc) return pending.promise;

        const slot: { promise?: Promise<JetStreamManager> } = {};
        slot.promise = (async () => {
            const manager = await nc.jetstreamManager();
            if (this.connections.get(config.id) !== nc || nc.isClosed()) {
                throw new Error(`NATS connection for ${config.id} changed while creating JetStream manager`);
            }
            this.jsmCache.set(config.id, { connection: nc, manager });
            return manager;
        })().finally(() => {
            if (this.jsmPending.get(config.id)?.promise === slot.promise) this.jsmPending.delete(config.id);
        });
        this.jsmPending.set(config.id, { connection: nc, promise: slot.promise });
        return slot.promise;
    }

    async closeConnection(id: string): Promise<void> {
        this.generations.set(id, (this.generations.get(id) ?? 0) + 1);
        const nc = this.connections.get(id);
        this.connections.delete(id);
        this.connecting.delete(id);
        this.jsmCache.delete(id);
        this.jsmPending.delete(id);
        if (nc) await nc.close();
    }

    async closeAll(): Promise<void> {
        const ids = new Set([...this.connections.keys(), ...this.connecting.keys()]);
        await Promise.all([...ids].map((id) => this.closeConnection(id)));
    }
}

export const natsManager = NatsManager.getInstance();
