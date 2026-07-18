import { expect, type Page } from "@playwright/test";

/** localStorage key used by the Zustand connection store (must match production). */
export const CONNECTIONS_STORAGE_KEY = "cobra-nats-storage";

export type SeedConnectionOptions = {
    id?: string;
    name?: string;
    servers?: string[];
    authType?: "none" | "user_pass" | "token";
};

/**
 * Seed a NATS connection into localStorage before page load.
 * Call before `page.goto` (uses `addInitScript`).
 */
export async function seedConnection(
    page: Page,
    options: SeedConnectionOptions = {}
): Promise<void> {
    const {
        id = "1",
        name = "Local",
        servers = ["localhost:4222"],
        authType = "none",
    } = options;

    await page.addInitScript(
        ({ key, connection }) => {
            const state = {
                state: {
                    connections: [connection],
                    activeConnectionId: connection.id,
                },
                version: 0,
            };
            localStorage.setItem(key, JSON.stringify(state));
        },
        {
            key: CONNECTIONS_STORAGE_KEY,
            connection: { id, name, servers, authType },
        }
    );
}

/** Seed connection and navigate to a path. */
export async function gotoWithConnection(
    page: Page,
    path: string,
    options?: SeedConnectionOptions
): Promise<void> {
    await seedConnection(page, options);
    await page.goto(path);
}

/**
 * Create a stream via the Streams UI and wait for the success toast + list settle.
 * Uses a native DOM click on the dialog submit to avoid Radix open-animation races.
 */
export async function createStreamViaUi(
    page: Page,
    streamName: string,
    subjects?: string
): Promise<void> {
    const subjectFilter = subjects ?? `${streamName}.>`;
    await page.goto("/streams");
    await expect(
        page.getByRole("button", { name: "Create Stream", exact: true })
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Create Stream", exact: true }).click();
    await page.getByLabel("Stream Name").fill(streamName);
    await page.getByLabel("Subjects").fill(subjectFilter);

    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Create Stream", exact: true })
        .evaluate((el: HTMLButtonElement) => el.click());

    await expect(
        page.getByText(`Stream "${streamName}" created successfully`)
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Loading streams...")).not.toBeVisible({
        timeout: 15000,
    });
}

/**
 * Assert the stream appears in the filtered streams table.
 * Call after create (or from /streams) when list presence matters.
 */
export async function expectStreamInList(
    page: Page,
    streamName: string
): Promise<void> {
    if (!page.url().includes("/streams") || page.url().match(/\/streams\/[^/]+/)) {
        await page.goto("/streams");
    }
    await expect(page.getByText("Loading streams...")).not.toBeVisible({
        timeout: 15000,
    });
    await page.getByPlaceholder("Search streams...").fill(streamName);
    const streamRow = page.locator("table tbody tr", { hasText: streamName });
    await expect(streamRow).toBeVisible({ timeout: 10000 });
}

/**
 * Open stream detail by direct navigation.
 * Prefer this over the row actions dropdown — Radix portal + table refetch
 * races make "View Details" menuitem clicks flaky under parallel workers.
 */
export async function gotoStreamDetail(
    page: Page,
    streamName: string
): Promise<void> {
    await page.goto(`/streams/${encodeURIComponent(streamName)}`);
    await expect(page).toHaveURL(new RegExp(`/streams/${streamName}`));
    await expect(
        page.getByRole("heading", { name: streamName, exact: true })
    ).toBeVisible({ timeout: 10000 });
}

/** Delete the open stream from the detail page (typed-name confirm). */
export async function deleteStreamViaUi(
    page: Page,
    streamName: string
): Promise<void> {
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog.getByText(/Delete stream/)).toBeVisible();
    await confirmDialog.getByLabel("Confirm name").fill(streamName);
    await confirmDialog.getByRole("button", { name: "Delete Stream" }).click();
    await expect(page.getByText("Stream deleted")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/streams/);
}
