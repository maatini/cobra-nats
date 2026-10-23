import { test, expect } from "@playwright/test";
import { isLocalNatsAvailable, seedConnection, uniqueNatsName } from "./helpers";

test.describe("Functional stream config import", () => {
    test.beforeAll(async () => {
        test.skip(!(await isLocalNatsAvailable()), "Requires NATS on localhost:4222.");
    });

    test("creates a new stream from config JSON and does not imply message restore", async ({ page }, testInfo) => {
        const streamName = uniqueNatsName("IMPORT", testInfo);
        await seedConnection(page, { name: "Real NATS" });
        await page.goto("/streams");

        await page.getByRole("button", { name: "Import Config JSON" }).click();
        const json = JSON.stringify({
            name: streamName,
            subjects: [`${streamName}.>`],
            retention: "limits",
            storage: "file",
            num_replicas: 1,
        });
        await page.getByLabel("Stream configuration JSON file").setInputFiles({
            name: `${streamName}.stream.json`,
            mimeType: "application/json",
            buffer: Buffer.from(json),
        });
        await expect(page.getByText("Configuration is valid and ready to create.")).toBeVisible();
        await expect(page.getByText("Messages are not restored.")).toBeVisible();
        await page.getByRole("button", { name: "Create Stream", exact: true }).last().click();
        await expect(page.getByText(`Stream "${streamName}" created from configuration`)).toBeVisible({ timeout: 15000 });

        await page.goto(`/streams/${encodeURIComponent(streamName)}`);
        await expect(page.getByRole("heading", { name: streamName, exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Delete", exact: true }).click();
        const confirmDialog = page.getByRole("dialog");
        await confirmDialog.getByLabel("Confirm name").fill(streamName);
        await confirmDialog.getByRole("button", { name: "Delete Stream" }).click();
        await expect(page.getByText("Stream deleted")).toBeVisible({ timeout: 10000 });
    });
});
