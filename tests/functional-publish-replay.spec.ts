import { test, expect } from "@playwright/test";
import { seedConnection } from "./helpers";
import { buildPublishReplayHref } from "../src/lib/publish-replay";

/**
 * Publish form prefill from Message Browser / Monitor "Replay" query params.
 * Does not require a live message in the buffer — only URL → form mapping.
 */
test.describe("Functional Publish Replay", () => {
    test("prefills subject, payload, and headers from query params", async ({
        page,
    }) => {
        const subject = `e2e.replay.${Date.now()}`;
        const payload = '{"replayed":true,"n":1}';
        const href = buildPublishReplayHref({
            subject,
            payload,
            headers: { "X-E2E": "yes", "X-Source": "test" },
        });

        await seedConnection(page, { name: "Real NATS" });
        await page.goto(href);

        await expect(
            page.getByRole("heading", { name: "Publish Message" })
        ).toBeVisible();
        await expect(
            page.getByText(/Form prefilled from a replayed message/)
        ).toBeVisible({ timeout: 10000 });

        await expect(page.getByPlaceholder("orders.new")).toHaveValue(subject);
        await expect(page.locator("textarea")).toHaveValue(payload);

        // Header rows from JSON query param (exact — avoids matching payload placeholder `{"key": "value"}`)
        await expect(page.getByPlaceholder("Key", { exact: true }).nth(0)).toHaveValue("X-E2E");
        await expect(page.getByPlaceholder("Value", { exact: true }).nth(0)).toHaveValue("yes");
        await expect(page.getByPlaceholder("Key", { exact: true }).nth(1)).toHaveValue("X-Source");
        await expect(page.getByPlaceholder("Value", { exact: true }).nth(1)).toHaveValue("test");


        // Query string is stripped after one-shot prefill (router.replace).
        await expect(page).toHaveURL(/\/publish\/?$/);

        // Prefill is publishable against real NATS.
        await page.getByRole("button", { name: "Publish Message" }).click();
        await expect(page.getByText("Message published")).toBeVisible({
            timeout: 10000,
        });
    });

    test("ignores publish URL without subject (no banner)", async ({ page }) => {
        await seedConnection(page);
        await page.goto("/publish?payload=only-payload");
        await expect(
            page.getByRole("heading", { name: "Publish Message" })
        ).toBeVisible();
        await expect(
            page.getByText(/Form prefilled from a replayed message/)
        ).not.toBeVisible();
        // Default form payload remains
        await expect(page.locator("textarea")).not.toHaveValue("only-payload");
    });
});
