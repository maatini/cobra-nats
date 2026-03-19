import { connect, NatsConnection, JSONCodec, JetStreamManager, JetStreamClient } from "nats";
import { NatsConnectionConfig } from "./nats-types";

export class NatsManager {
  private static instance: NatsManager;
  private connections: Map<string, NatsConnection> = new Map();
  private jsm: Map<string, JetStreamManager> = new Map();
  private js: Map<string, JetStreamClient> = new Map();
  private jc = JSONCodec();

  private constructor() { }

  public static getInstance(): NatsManager {
    if (!NatsManager.instance) {
      NatsManager.instance = new NatsManager();
    }
    return NatsManager.instance;
  }

  async getConnection(config: NatsConnectionConfig): Promise<NatsConnection> {
    const existing = this.connections.get(config.id);
    if (existing && !existing.isClosed()) {
      return existing;
    }

    try {
      const nc = await connect({
        servers: config.servers,
        user: config.user,
        pass: config.pass,
        token: config.token,
        name: `Cobra NATS - ${config.name}`,
        // Add more options as needed
      });
      this.connections.set(config.id, nc);
      return nc;
    } catch (err) {
      console.error(`Failed to connect to NATS (${config.name}):`, err);
      throw err;
    }
  }

  async getJetStreamManager(config: NatsConnectionConfig): Promise<JetStreamManager> {
    const nc = await this.getConnection(config);
    let manager = this.jsm.get(config.id);
    if (!manager) {
      manager = await nc.jetstreamManager();
      this.jsm.set(config.id, manager);
    }
    return manager;
  }

  async getJetStreamContext(config: NatsConnectionConfig): Promise<JetStreamClient> {
    const nc = await this.getConnection(config);
    let js = this.js.get(config.id);
    if (!js) {
      js = nc.jetstream();
      this.js.set(config.id, js);
    }
    return js;
  }

  async closeConnection(id: string) {
    const nc = this.connections.get(id);
    if (nc) {
      await nc.close();
      this.connections.delete(id);
      this.jsm.delete(id);
      this.js.delete(id);
    }
  }

  async closeAll() {
    for (const id of this.connections.keys()) {
      await this.closeConnection(id);
    }
  }
}

export const natsManager = NatsManager.getInstance();
