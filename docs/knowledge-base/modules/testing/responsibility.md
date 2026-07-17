# Testing — Responsibilities

## Test Types

### UI Smoke Tests (no real NATS operations)
These test the UI renders correctly and user interactions work at the DOM level.

| File | What it tests |
|---|---|
| `connections.spec.ts` | Connection creation dialog, form validation, saving to localStorage |
| `streams.spec.ts` | Stream list table rendering, sort/filter UI |
| `kv.spec.ts` | KV bucket list UI |
| `os.spec.ts` | Object Store page UI |
| `messaging.spec.ts` | Publish page form UI |
| `settings.spec.ts` | Settings page, theme toggle |

### Functional E2E Tests (against real NATS server)
These create, operate on, and delete real NATS resources. Require `nats-server` running on `localhost:4222`.

| File | What it tests |
|---|---|
| `functional-streams.spec.ts` | Create → verify → delete stream flow |
| `functional-consumers-and-messages.spec.ts` | Create consumer → browse messages flow |
| `functional-kv.spec.ts` | Create bucket → put key → get key → delete flow |
| `functional-os.spec.ts` | Create bucket → upload → download → delete flow |
| `functional-messaging.spec.ts` | Publish → verify + request-reply flow |

## Conventions

- **Connection seeding**: Tests seed localStorage via `page.evaluate()` → `localStorage.setItem("cobra-nats-storage", JSON.stringify(state))`.
- **Toast interaction**: Use `page.getByText(...)` or `page.getByRole("status")` for Sonner toasts.
- **Confirm dialogs**: Use `page.getByRole("dialog")` to find the confirm modal.
- **Flat file structure**: All tests in `tests/` root, no subdirectories.
- **Config**: `playwright.config.ts` at project root.

## Prerequisites

- NATS server with JetStream: `docker-compose up -d` (exposes `4222` for clients, `8222` for monitoring)
- Or: `devbox run start-nats`
