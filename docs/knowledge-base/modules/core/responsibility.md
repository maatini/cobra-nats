# Core — Responsibilities

## NatsManager (`src/lib/nats/manager.ts`)

**What it owns**: The singleton NATS connection pool. Every `NatsConnection` and `JetStreamManager` instance for every configured connection ID.

**Invariants**:
- Exactly one `NatsManager` instance exists (private constructor + `getInstance()`).
- One `NatsConnection` per `config.id`; stale closed connections are replaced on next `getConnection()`.
- `JetStreamManager` is cached per `config.id`; cache is invalidated when the connection is closed.
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
- Errors are caught within the wrapper and returned as `ActionResponse<T>` — never thrown across the Server Action boundary.
- `getErrorMessage()` maps raw NATS/Node.js errors to user-friendly strings (DNS, connection refused, TLS, auth errors).

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

## shadcn/ui Primitives (`src/components/ui/`)

**What it owns**: Generated UI primitives. **Never hand-edited** — created via `shadcn add <component>`.

Contains: button, card, dialog, form, input, badge, select, table, tabs, sidebar, breadcrumb, command, dropdown-menu, sheet, popover, tooltip, scroll-area, separator, skeleton, sonner, and custom composite components (`data-table-skeleton`, `detail-skeleton`, `empty-state`, `code-viewer`, `copy-button`, `json-viewer`, `auto-refresh-select`, `pagination`).

## Utility (`src/lib/utils.ts`)

**What it owns**: The `cn()` class-name merge function (tailwind-merge + clsx). Used by every UI component.
