import { test, expect } from "@playwright/test";
import { gotoWithConnection } from "./helpers";

test.describe("Dashboard time series", () => {
    test("shows empty metric histories before a successful dashboard sample", async ({ page }) => {
        await gotoWithConnection(page, "/");

        await expect(page.getByRole("heading", { name: "Recent dashboard history" })).toBeVisible();
        await expect(page.getByText("No samples available for this metric.").first()).toBeVisible();
        await expect(page.getByRole("img", { name: /over \d+ dashboard samples/ })).toHaveCount(0);
    });
});
