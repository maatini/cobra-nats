import { test, expect } from "@playwright/test";
import { seedConnection } from "./helpers";

/**
 * Live Monitor (SSE) — requires real NATS on localhost:4222.
 * Uses two pages so the SSE subscription stays open while we publish.
 */
test.describe("Functional Live Monitor", () => {
    test("subscribe, receive a published message, filter and replay", async ({
        page,
        context,
    }) => {
        const subject = `e2e.mon.${Date.now()}`;
        const payload = JSON.stringify({ ping: "monitor", t: Date.now() });

        await seedConnection(page, { name: "Real NATS" });
        await page.goto("/monitor");
        await expect(
            page.getByRole("heading", { name: "Live Subject Monitor" })
        ).toBeVisible();

        // Narrow subscription to our unique subject (not ">") for a clear assert.
        await page.getByPlaceholder(/Subject or pattern/).fill(subject);
        await page.getByRole("button", { name: "Subscribe" }).click();
        await expect(page.getByText(`Subscribed to ${subject}`)).toBeVisible({
            timeout: 10000,
        });
        await expect(page.getByText("Waiting for messages...")).toBeVisible();
        // Stop button replaces Subscribe while connected.
        await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

        // Publish from a second page so the SSE stream is not torn down.
        const publisher = await context.newPage();
        await seedConnection(publisher, { name: "Real NATS" });
        await publisher.goto("/publish");
        await publisher.getByPlaceholder("orders.new").fill(subject);
        await publisher.locator("textarea").fill(payload);
        await publisher.getByRole("button", { name: "Publish Message" }).click();
        await expect(publisher.getByText("Message published")).toBeVisible({
            timeout: 10000,
        });
        await publisher.close();

        // Message should land in the monitor buffer.
        await expect(page.getByText(subject, { exact: true }).first()).toBeVisible({
            timeout: 15000,
        });
        await expect(page.getByText(payload).first()).toBeVisible();

        // Client-side filter: non-matching pattern hides the row.
        await page
            .getByPlaceholder("Filter subjects (orders.*, events.>)")
            .fill("other.>");
        await expect(
            page.getByText("No messages match the client filter…")
        ).toBeVisible({ timeout: 5000 });

        // Clear filter — message returns.
        await page
            .getByPlaceholder("Filter subjects (orders.*, events.>)")
            .fill("");
        await expect(page.getByText(subject, { exact: true }).first()).toBeVisible();

        // Expand row → Replay → publish form prefilled.
        await page.getByText(subject, { exact: true }).first().click();
        await page.getByRole("link", { name: "Replay" }).click();
        await expect(page).toHaveURL(/\/publish/);
        await expect(
            page.getByText(/Form prefilled from a replayed message/)
        ).toBeVisible({ timeout: 10000 });
        await expect(page.getByPlaceholder("orders.new")).toHaveValue(subject);
        await expect(page.locator("textarea")).toHaveValue(payload);
    });
});
