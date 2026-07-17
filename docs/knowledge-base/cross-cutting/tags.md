# Tag Registry

Central glossary of `@tag:xxx` concepts used throughout the codebase and knowledge base.

## Agent personas (from `.claude/agents/`)

| Tag | Meaning |
|---|---|
| `@nats-jetstream-expert` | Owns NatsManager, shared types, all Server Actions that touch NATS directly |
| `@server-actions-agent` | Owns Server Action wrappers (`withNatsConnection`, `withJetStream`), error mapping, SSE stream creation |
| `@nextjs-frontend-agent` | Owns all React components, hooks, stores, layouts, providers — everything in `src/features/*/components/`, `src/components/`, `src/hooks/` |
| `@ui-shadcn-agent` | Owns shadcn/ui primitives (`src/components/ui/`) and their styling — but primitives are generated, not hand-edited |
| `@playwright-testing-agent` | Owns all E2E tests under `tests/` |

## Architecture concepts

| Tag | Meaning |
|---|---|
| `@tag:server-action` | A function marked `"use server"` that runs on the Next.js server; the only place NATS operations execute |
| `@tag:action-response` | The `ActionResponse<T>` discriminated union: `{success:true, data:T} | {success:false, error:string}` |
| `@tag:nats-manager` | The singleton `NatsManager` that owns the connection pool (`src/lib/nats/manager.ts`) |
| `@tag:nats-wrapper` | `withNatsConnection` / `withJetStream` wrappers that standardize error handling and connection management |
| `@tag:connection-config` | `NatsConnectionConfig` — serializable connection info stored in Zustand + localStorage |
| `@tag:connection-store` | Zustand store in `src/features/connections/store.ts` — persisted to localStorage key `cobra-nats-storage` |

## Feature domains

| Tag | Meaning |
|---|---|
| `@tag:streams` | JetStream stream CRUD, consumer management, and message browsing |
| `@tag:kv` | Key-Value bucket discovery and CRUD |
| `@tag:os` | Object Store bucket discovery, upload/download, content preview |
| `@tag:publish` | Message publishing and request-reply |
| `@tag:monitor` | Live subject monitoring via SSE (uses dedicated NATS connection, not Server Actions) |
| `@tag:dashboard` | Landing page aggregation — no own actions |

## Patterns

| Tag | Meaning |
|---|---|
| `@tag:form-pattern` | React Hook Form + Zod schema + `zodResolver` — used for all forms |
| `@tag:confirm-dialog` | `useConfirm()` hook → promise-based styled dialog with optional type-to-confirm |
| `@tag:url-state` | `useUrlState` hook — local React state as source of truth, mirrored to URL |
| `@tag:auto-refresh` | `useAutoRefresh` hook — periodic callback with localStorage-persisted interval |
| `@tag:sse-monitor` | The SSE-based live monitor pattern — REST route + ReadableStream + EventSource client |

## Known issues / workarounds

| Tag | Meaning |
|---|---|
| `@tag:nats-enum-redef` | NATS enums re-defined in `types/nats.ts` to avoid bundling `nats` in the browser |
| `@tag:os-replicas-bug` | `createOSBucket` workaround: `replicas` set non-enumerable to avoid `Object.assign` copying it to raw stream config |
