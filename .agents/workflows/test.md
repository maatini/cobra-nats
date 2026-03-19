---
description: Run Playwright E2E tests (smoke tests and functional tests)
---

# Testing Workflow

## 1. Lint Check

// turbo
```bash
npm run lint
```

## 2. UI Smoke Tests (no NATS server required)

// turbo
```bash
npx playwright test tests/connections.spec.ts tests/streams.spec.ts tests/kv.spec.ts tests/messaging.spec.ts tests/settings.spec.ts --project=chromium
```

These tests verify the UI renders correctly without needing a running NATS server.

## 3. Functional Tests (requires NATS on localhost:4222)

```bash
npx playwright test tests/functional-streams.spec.ts tests/functional-messaging.spec.ts tests/functional-kv.spec.ts --project=chromium
```

These tests perform real NATS operations (create streams, publish messages, KV operations).

> **Note:** Ensure a NATS server is running on `localhost:4222` before running functional tests.
> Start one with `docker-compose up -d` if needed.
