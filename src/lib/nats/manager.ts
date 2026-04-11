import { connect, type NatsConnection, type JetStreamManager } from "nats";
import type { NatsConnectionConfig } from "@/types/nats";

/**
 * Singleton connection pool for NATS.
 *
 * Holds one `NatsConnection` per config-id and caches the JetStreamManager
 * (since `nc.jetstreamManager()` issues a request round-trip). The lightweight
 * `JetStreamClient` is not cached — `nc.jetstream()` is cheap.
 */
export class NatsManager {
    private static instance: NatsManager;
    private connections = new Map<string, NatsConnection>();
    private jsmCache = new Map<string, JetStreamManager>();

    private constructor() { }

    static getInstance(): NatsManager {
        if (!NatsManager.instance) {
            NatsManager.instance = new NatsManager();
        }
        return NatsManager.instance;
    }

    async getConnection(config: NatsConnectionConfig): Promise<NatsConnection> {
        const existing = this.connections.get(config.id);
        if (existing && !existing.isClosed()) return existing;

        try {
            const nc = await connect({
                servers: config.servers,
                user: config.user,
                pass: config.pass,
                token: config.token,
                name: `Cobra NATS - ${config.name}`,
            });
            this.connections.set(config.id, nc);
            return nc;
        } catch (err) {
            console.error(`Failed to connect to NATS (${config.name}):`, err);
            throw err;
        }
    }

    /** Cached JetStream manager — avoids re-issuing `nc.jetstreamManager()` per action call. */
    async getJetStreamManager(config: NatsConnectionConfig): Promise<JetStreamManager> {
        const cached = this.jsmCache.get(config.id);
        if (cached) return cached;

        const nc = await this.getConnection(config);
        const jsm = await nc.jetstreamManager();
        this.jsmCache.set(config.id, jsm);
        return jsm;
    }

    async closeConnection(id: string) {
        const nc = this.connections.get(id);
        if (!nc) return;
        await nc.close();
        this.connections.delete(id);
        this.jsmCache.delete(id);
    }

    async closeAll() {
        for (const id of this.connections.keys()) {
            await this.closeConnection(id);
        }
    }
}

export const natsManager = NatsManager.getInstance();
