---
name: cobra-e2e
description: >
  Write or fix Cobra NATS Playwright E2E tests against a real NATS server. Use
  when adding specs, debugging flaky tests, seeding the connection store, or
  when the user runs /cobra-e2e.
---

# Cobra: Playwright E2E

Prefer subagent **`playwright-testing-agent`**. Patterns: **`.claude/rules.md`** → Playwright; helpers in `tests/helpers.ts`.

## Prerequisites

- NATS on `localhost:4222` (`docker compose up` or `devbox run nats:up`)
- UI on `localhost:3000` (`npm run dev` or `devbox run dev:full`)

## Rules

1. Specs live **flat** under `tests/*.spec.ts` (including `functional-*.spec.ts`) — **no** `tests/features/`.
2. Seed connection with storage key **`cobra-nats-storage`** (must match `CONNECTIONS_STORAGE_KEY`):

```ts
await page.evaluate(() => {
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
```

Prefer shared helpers in `tests/helpers.ts` when they already exist.

3. Assert toasts via `getByRole("status")` or `getByText(...)`.
4. Confirms: `getByRole("dialog")` + Confirm button.
5. Selectors use **English** UI labels.
6. Cleanup resources the test creates; keep tests **idempotent**.
7. Cover happy path + at least one meaningful failure path for new features.

## Run

```bash
npx playwright test
npx playwright test <name>.spec.ts
npx playwright test --ui
# or: devbox run test:e2e
```

## Do not

- Implement product features in this skill (hand off to feature/action skills).
- Put secrets in query strings for monitor/API fixtures.
