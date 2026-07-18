# Tag Registry

Central glossary of `@tag:xxx` concepts used throughout the codebase and knowledge base.

## Agent personas (from `.claude/agents/`)

| Tag | Owns | Does not own |
|---|---|---|
| `@nats-jetstream-expert` | `NatsManager`, shared types (`types/nats.ts`), JetStream domain semantics | Feature `actions.ts`, UI, tests |
| `@server-actions-agent` | Wrappers (`withNatsConnection` / `withJetStream`), all feature Server Actions, `monitor/stream.ts`, `src/app/api/**` | Feature React components, primitives |
| `@nextjs-frontend-agent` | Pages, feature components, layout, providers, hooks, connections store | `src/components/ui/*`, `actions.ts`, tests |
| `@ui-shadcn-agent` | shadcn primitives in `src/components/ui/` (CLI-first) | Feature-specific components, layout |
| `@playwright-testing-agent` | E2E under `tests/` | Product feature implementation |

## Architecture concepts

| Tag | Meaning |
|---|---|
| `@tag:server-action` | A function marked `"use server"` that runs on the Next.js server; primary place NATS operations execute |
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
| `@tag:monitor` | Live subject monitoring via SSE (dedicated NATS connection; not Server Actions) |
| `@tag:dashboard` | Landing page aggregation — no own actions |

## Patterns

| Tag | Meaning |
|---|---|
| `@tag:form-pattern` | React Hook Form + Zod schema + `zodResolver` — used for all forms |
| `@tag:confirm-dialog` | `useConfirm()` hook → promise-based styled dialog with optional type-to-confirm |
| `@tag:url-state` | `useUrlState` hook — local React state as source of truth, mirrored to URL |
| `@tag:auto-refresh` | `useAutoRefresh` hook — periodic callback with localStorage-persisted interval |
| `@tag:sse-monitor` | The SSE-based live monitor pattern — REST route + ReadableStream + EventSource client |
| `@tag:os-multipart-upload` | `POST /api/os/upload` multipart route — binary upload outside Server Actions (RSC payload limits) |

## Known issues / workarounds

| Tag | Meaning |
|---|---|
| `@tag:nats-enum-redef` | NATS enums re-defined in `types/nats.ts` to avoid bundling `nats` in the browser |
| `@tag:os-replicas-bug` | `createOSBucket` workaround: `replicas` set non-enumerable to avoid `Object.assign` copying it to raw stream config |
