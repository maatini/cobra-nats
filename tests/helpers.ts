import type { Page } from "@playwright/test";

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
