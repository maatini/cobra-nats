# Testing — Dependencies

## Infrastructure

| Dependency | Purpose |
|---|---|
| `@playwright/test` ^1.61.0 | Test runner + assertions |
| Docker (docker-compose.yml) | Runs NATS server with JetStream for functional tests |
| `playwright.config.ts` | Project-wide config (browsers, base URL, webServer) |

## Test dependencies on app code

| Test suite | App code referenced |
|---|---|
| All tests | `CONNECTIONS_STORAGE_KEY` from `features/connections/store.ts` (to seed localStorage) |
| Functional tests | Server Actions + UI components tested end-to-end |
| UI smoke tests | UI components rendered on page |
