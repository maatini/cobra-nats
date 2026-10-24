# Core — Responsibilities

## NatsManager (`src/lib/nats/manager.ts`)

**What it owns**: The singleton NATS connection pool. Every `NatsConnection` and `JetStreamManager` instance for every configured connection ID.

**Invariants**:
- Exactly one `NatsManager` instance exists (private constructor + `getInstance()`).
- One `NatsConnection` per `config.id`; concurrent `getConnection` for the same id shares one in-flight connect.
- Each id has a generation. `closeConnection` increments it so a late connect is closed and rejected instead of re-entering the pool.
- `JetStreamManager` is cached only for the live `NatsConnection` that created it; a closed/replaced connection drops the cache.
- Pool size is capped at 32 live or connecting ids. New ids are rejected when the cap is reached.
- `JetStreamClient` is NOT cached (created fresh via `nc.jetstream()` on each call — cheap).

**Entry points**:
| Method | Purpose | Return |
|---|---|---|
| `getConnection(config)` | Get or create a NATS connection | `NatsConnection` |
| `getJetStreamManager(config)` | Get or create cached JSM | `JetStreamManager` |
| `closeConnection(id)` | Close and evict one connection | `void` |
| `closeAll()` | Close and evict all connections | `void` |

**Exported singleton**: `export const natsManager = NatsManager.getInstance()`

## Server Action Wrappers (`src/lib/server-action.ts`)

**What it owns**: The standard wrappers that every Server Action calls. Error normalization, connection lifecycle, `ActionResponse<T>` type.

**Invariants**:
- Every action MUST use `withNatsConnection` (core NATS ops like publish/request) or `withJetStream` (JetStream ops like stream/consumer/KV/OS management).
- Wrappers parse `NatsConnectionConfig` with Zod (`src/lib/validation/nats.ts`) before touching the pool. Invalid input returns `ActionResponse` error, not an exception.
- Errors are caught within the wrapper and returned as `ActionResponse<T>` — never thrown across the Server Action boundary.
- `getErrorMessage()` maps raw NATS/Node.js errors to user-friendly strings (DNS, connection refused, TLS, auth errors).

## Runtime validation (`src/lib/validation/nats.ts`)

**What it owns**: Server-only Zod schemas for connection config, stream message batch options, monitor/KV-watch/OS API bodies, and the 20 MB Object Store upload cap. Do not import this module from client components.

## HTTP monitoring URL policy (`src/lib/server/monitoring-url-policy.ts`)

**What it owns**: Server-only SSRF policy for `fetchHttpMonitoring`. Allows `http:`/`https:` including `localhost`; rejects credentials, query/fragment, redirects, link-local addresses, and known cloud-metadata hosts. Final path is only `/varz`, `/jsz`, or `/connz`.

**Entry points**:
| Export | Purpose |
|---|---|
| `withNatsConnection(config, opName, fn)` | Execute core NATS operation with error wrapping |
| `withJetStream(config, opName, fn)` | Execute JetStream operation with JSM cached + JS created on demand |
| `getErrorMessage(err)` | Map error to user-friendly string |
| `ActionResponse<T>` (type) | Standard `{success, data} | {success, error}` discriminated union |

## Shared Types (`src/types/nats.ts`)

**What it owns**: All domain types shared between Server Actions and client components.

**Invariants**:
- NEVER imports from the `nats` package (to keep it browser-safe).
- NATS enums (`RetentionPolicy`, `StorageType`, `DiscardPolicy`) are re-defined here and must stay in sync with `nats/lib/jetstream/jsapi_types`.
- Every Server Action return type uses types from here (or raw `nats` types that never reach the client).

**Key types**:
| Type | Purpose |
|---|---|
| `NatsConnectionConfig` | Serializable connection config (id, name, servers, auth) |
| `ActionResponse<T>` | Discriminated union for all action results |
| `StreamMessage` | Serializable message for client display |
| `KvEntryResult` | Serializable KV entry |
| `OsBucketInfo` / `OsObjectInfo` | Serializable Object Store info |
| `RetentionPolicy` / `StorageType` / `DiscardPolicy` | Re-defined NATS enums |

## App Hooks (`src/hooks/`)

| Hook | File | Purpose | Persistence |
|---|---|---|---|
| `useLocalStorage` | `use-local-storage.ts` | SSR-safe typed localStorage state | Yes (key-based) |
| `useAutoRefresh` | `use-auto-refresh.ts` | Periodic callback with configurable interval; interval persisted to localStorage | Yes (interval) |
| `useUrlState` | `use-url-state.ts` | Local state mirrored to URL as search params; local state is source of truth | No (URL only) |
| `useKeyboardShortcuts` | `use-keyboard-shortcuts.ts` | Register global hotkeys; ignores inputs/textareas | No |
| `useIsMobile` | `use-mobile.ts` | Window width breakpoint (768px) | No |
| `useServerActionQuery` | `use-server-action-query.ts` | Load/reload list pages from a Server Action | No |

## shadcn/ui Primitives (`src/components/ui/`)

**What it owns**: Generated UI primitives. **Never hand-edited** — created via `shadcn add <component>`.

Contains: button, card, dialog, form, input, badge, select, table, tabs, sidebar, breadcrumb, command, dropdown-menu, sheet, popover, tooltip, scroll-area, separator, skeleton, sonner, and custom composite components (`data-table-skeleton`, `detail-skeleton`, `empty-state`, `code-viewer`, `copy-button`, `json-viewer`, `payload-viewer`, `auto-refresh-select`). `payload-viewer` is a hand-written viewer (JSON/CBOR/hex/protobuf), not a generated shadcn primitive.

## Utility (`src/lib/utils.ts`)

**What it owns**: The `cn()` class-name merge function (tailwind-merge + clsx). Used by every UI component.
