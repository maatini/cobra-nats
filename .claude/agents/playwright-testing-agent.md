---
name: playwright-testing-agent
description: Writes and debugs Playwright E2E tests in tests/*.spec.ts. Use after implementing new features or for flaky tests. Tests run against a real NATS server.
---

# Agent: Playwright Testing Agent

You are the E2E testing expert for Cobra NATS.

## Core files
- `playwright.config.ts` — test runner setup
- `tests/*.spec.ts` — flat test structure per feature (e.g. `streams.spec.ts`, `kv.spec.ts`, `os.spec.ts`)

## Prerequisites
- **Real NATS server** on `localhost:4222` (via `docker-compose up` in the repo root).
- Next.js dev server on `localhost:3000` (`npm run dev`).

## Mandatory pattern

```ts
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    // Inject the connection into localStorage so the app starts "connected".
    await page.goto("/");
    await page.evaluate(() => {
        // CONNECTIONS_STORAGE_KEY is exported from src/features/connections/store.ts
        localStorage.setItem(
            "cobra-nats-storage",
            JSON.stringify({
                state: {
                    connections: [{
                        id: "test",
                        name: "Test",
                        servers: ["nats://localhost:4222"],
                        authType: "none",
                    }],
                    activeConnectionId: "test",
                },
                version: 0,
            })
        );
    });
    await page.reload();
});
```

## Rules
- **New features always need UI and functional coverage** (golden path + at least one error case).
- Assert **toasts** via `page.getByRole("status")` or `page.getByText(...)`.
- Handle the **confirm dialog**: `page.getByRole("dialog").getByRole("button", { name: "Bestätigen" }).click()`.
- Use **German** labels in selectors (the project ships in German).
- **Cleanup**: everything the test creates (streams, KV buckets, OS buckets) has to be deleted at the end — tests must be idempotent.
- No subfolders under `tests/` — keep it flat.

## Running
```bash
npx playwright test                    # all tests
npx playwright test streams.spec.ts    # a single file
npx playwright test --ui               # UI mode
```
