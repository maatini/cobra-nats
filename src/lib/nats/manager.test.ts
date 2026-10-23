import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NatsConnection, JetStreamManager } from "nats";

const { connectMock, buildOptionsMock } = vi.hoisted(() => ({
    connectMock: vi.fn(),
    buildOptionsMock: vi.fn((config: { id: string }) => ({ name: config.id })),
}));

vi.mock("nats", () => ({ connect: connectMock }));
vi.mock("@/lib/nats/connect-options", () => ({ buildConnectionOptions: buildOptionsMock }));

import { NatsManager } from "./manager";
import type { NatsConnectionConfig } from "@/types/nats";

const config = (id: string): NatsConnectionConfig => ({
    id,
    name: id,
    servers: ["nats://localhost:4222"],
    authType: "none",
});

function fakeConnection() {
    let closed = false;
    const connection = {
        isClosed: vi.fn(() => closed),
        close: vi.fn(async () => { closed = true; }),
        jetstreamManager: vi.fn(),
        jetstream: vi.fn(),
    };
    return { connection: connection as unknown as NatsConnection, raw: connection, close: () => { closed = true; } };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe("NatsManager lifecycle", () => {
    let manager: NatsManager;

    beforeEach(async () => {
        manager = NatsManager.getInstance();
        await manager.closeAll();
        connectMock.mockReset();
        buildOptionsMock.mockClear();
    });

    it("coalesces concurrent getConnection calls into one connect", async () => {
        const pending = deferred<NatsConnection>();
        const nc = fakeConnection();
        connectMock.mockReturnValue(pending.promise);
        const first = manager.getConnection(config("coalesce-test"));
        const second = manager.getConnection(config("coalesce-test"));
        expect(connectMock).toHaveBeenCalledTimes(1);
        pending.resolve(nc.connection);
        await expect(Promise.all([first, second])).resolves.toEqual([nc.connection, nc.connection]);
        await manager.closeConnection("coalesce-test");
    });

    it("replaces a closed cached connection", async () => {
        const first = fakeConnection();
        const replacement = fakeConnection();
        connectMock.mockResolvedValueOnce(first.connection).mockResolvedValueOnce(replacement.connection);
        expect(await manager.getConnection(config("replace-test"))).toBe(first.connection);
        first.close();
        expect(await manager.getConnection(config("replace-test"))).toBe(replacement.connection);
        expect(connectMock).toHaveBeenCalledTimes(2);
        await manager.closeConnection("replace-test");
    });

    it("drops JetStream manager cache when its connection changes", async () => {
        const first = fakeConnection();
        const second = fakeConnection();
        const firstManager = {} as JetStreamManager;
        const secondManager = {} as JetStreamManager;
        first.raw.jetstreamManager.mockResolvedValue(firstManager);
        second.raw.jetstreamManager.mockResolvedValue(secondManager);
        connectMock.mockResolvedValueOnce(first.connection).mockResolvedValueOnce(second.connection);

        expect(await manager.getJetStreamManager(config("jsm-test"))).toBe(firstManager);
        expect(await manager.getJetStreamManager(config("jsm-test"))).toBe(firstManager);
        expect(first.raw.jetstreamManager).toHaveBeenCalledTimes(1);
        first.close();
        expect(await manager.getJetStreamManager(config("jsm-test"))).toBe(secondManager);
        expect(second.raw.jetstreamManager).toHaveBeenCalledTimes(1);
        await manager.closeConnection("jsm-test");
    });

    it("closeConnection clears cached state", async () => {
        const first = fakeConnection();
        const second = fakeConnection();
        connectMock.mockResolvedValueOnce(first.connection).mockResolvedValueOnce(second.connection);
        expect(await manager.getConnection(config("close-test"))).toBe(first.connection);
        await manager.closeConnection("close-test");
        expect(first.raw.close).toHaveBeenCalledTimes(1);
        expect(await manager.getConnection(config("close-test"))).toBe(second.connection);
        expect(connectMock).toHaveBeenCalledTimes(2);
        await manager.closeConnection("close-test");
    });

    it("does not leak a usable connection when closed during connect", async () => {
        const pending = deferred<NatsConnection>();
        const nc = fakeConnection();
        connectMock.mockReturnValue(pending.promise);
        const connectionPromise = manager.getConnection(config("inflight-close-test"));
        await manager.closeConnection("inflight-close-test");
        pending.resolve(nc.connection);
        await expect(connectionPromise).rejects.toThrow(/closed while connecting/);
        expect(nc.raw.close).toHaveBeenCalledTimes(1);
        expect(nc.raw.isClosed()).toBe(true);
        const fresh = fakeConnection();
        connectMock.mockResolvedValueOnce(fresh.connection);
        expect(await manager.getConnection(config("inflight-close-test"))).toBe(fresh.connection);
        await manager.closeConnection("inflight-close-test");
    });
});
