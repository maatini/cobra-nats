import { expect, test } from "@playwright/test";

const validUploadFields = {
    bucket: "qa-bucket",
    connection: JSON.stringify({
        name: "QA",
        servers: ["nats://localhost:4222"],
        authType: "none",
    }),
};

test.describe("malformed API inputs", () => {
    test("monitor returns 400 for missing and invalid JSON", async ({ request }) => {
        const missing = await request.post("/api/monitor", {
            headers: { "content-type": "application/json" },
            data: "{}",
        });
        expect(missing.status()).toBe(400);

        const invalid = await request.post("/api/monitor", {
            headers: { "content-type": "application/json" },
            data: "{invalid",
        });
        expect(invalid.status()).toBe(400);
    });

    test("OS download returns 400 for missing and invalid JSON", async ({ request }) => {
        const missing = await request.post("/api/os/download", {
            headers: { "content-type": "application/json" },
            data: "{}",
        });
        expect(missing.status()).toBe(400);

        const invalid = await request.post("/api/os/download", {
            headers: { "content-type": "application/json" },
            data: "{invalid",
        });
        expect(invalid.status()).toBe(400);
    });

    test("OS upload returns 400 for missing fields and malformed connection JSON", async ({ request }) => {
        const missing = await request.post("/api/os/upload", { multipart: {} });
        expect(missing.status()).toBe(400);

        const invalid = await request.post("/api/os/upload", {
            multipart: {
                ...validUploadFields,
                connection: "{invalid",
                file: { name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("test") },
            },
        });
        expect(invalid.status()).toBe(400);
    });
});
