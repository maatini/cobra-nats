import { describe, expect, it } from "vitest";
import { NatsConnectionConfigSchema } from "./nats";

const validConfig = {
    id: "test",
    name: "Test",
    servers: ["nats://localhost:4222"],
    authType: "none",
};

describe("NATS connection schema", () => {
    it("rejects missing servers", () => {
        const missingServers = { id: validConfig.id, name: validConfig.name, authType: validConfig.authType };
        expect(NatsConnectionConfigSchema.safeParse(missingServers).success).toBe(false);
    });

    it("rejects an unsupported authType", () => {
        expect(NatsConnectionConfigSchema.safeParse({ ...validConfig, authType: "password" }).success).toBe(false);
    });
});
