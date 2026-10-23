# Architectural Decisions

## ADR-001: Server-side NATS execution and API transport exceptions

**Decision**: NATS client operations execute on the Next.js server. The default transport is a Server Action (`features/*/actions.ts` + `withNatsConnection` / `withJetStream`). App Router API routes are intentional exceptions where the operation needs a streaming or binary HTTP response:
- `POST /api/monitor` — long-lived SSE with connection config and subject in the JSON body (`features/monitor/stream.ts`)
- `POST /api/kv/watch` — long-lived KV watcher SSE with connection config and bucket in the JSON body (`features/kv/stream.ts`); it uses a dedicated connection and closes it when the request is aborted
- `POST /api/os/upload` — multipart binary upload (avoids RSC payload limits)
- `POST /api/os/download` — streaming binary download (avoids base64-encoding entire objects in memory)

SSE routes accept request data in the POST body, not query strings. The KV watcher route validates its JSON request against `KVWatchRequestSchema` before starting the stream. API routes are server entry points and require their own request validation and resource cleanup; they do not inherit Server Action wrappers.

**Rationale**:
- The `nats` package imports Node.js builtins (`dns`, `fs`) that cannot run in browsers.
- Server Actions provide RPC-style serialization with TypeScript contracts across the boundary for ordinary CRUD/publish operations.
- Long-lived subscriptions and large binary transfers need response semantics that Server Actions do not provide.

**Trade-offs**:
- No offline-first capabilities (NATS requires a running server anyway).
- Slightly higher latency versus direct client connections.
- Streaming and large binaries require dedicated routes rather than Actions.
- This decision concerns where NATS operations execute; it is not a statement about authentication, authorization, or connection-profile storage policy.

## ADR-002: Feature-based module organization

**Decision**: Each domain (streams, kv, os, publish, monitor, connections) owns its actions, components, and store in a single `src/features/<domain>/` folder.

**Rationale**:
- Clear ownership boundaries — one domain per folder.
- Easy to add new features: create folder, write actions, write UI, add route.
- Prevents `src/app/actions/` sprawl that the project previously suffered from.

**Trade-offs**:
- The connection store is shared (lives in `features/connections/`) but it's the root of all state, so this is intentional.

## ADR-003: Singleton NatsManager with connection pooling

**Decision**: `NatsManager` remains a singleton. The pool is bounded by `MAX_POOL_SIZE` (32 config IDs). It reuses a live `NatsConnection` per config ID, coalesces concurrent connection attempts for that ID, and uses per-ID generations to prevent work invalidated by `closeConnection()` from repopulating the pool. A `JetStreamManager` is cached only for the exact live connection that created it; pending manager creation is coalesced. `JetStreamClient` is created per use and is not cached.

**Rationale**:
- NATS connections are stateful (keep-alive, reconnect logic). Reusing a connection avoids creating one for every action call.
- Single-flight creation avoids duplicate concurrent connections for the same config ID.
- Generation checks prevent late asynchronous connection work from restoring state after a close or replacement.
- Binding the manager cache to its live connection avoids reusing a stale manager after connection changes.

**Trade-offs**:
- The pool rejects new IDs when 32 live or connecting IDs are present. Closing an ID removes its connection and cached/in-flight state; a later request may reconnect.
- The pool key is the config ID; the manager does not make that ID an authorization boundary.

## ADR-004: NATS enums re-defined, not re-exported

**Decision**: `RetentionPolicy`, `StorageType`, `DiscardPolicy` enums are defined in `src/types/nats.ts` rather than re-exported from the `nats` package.

**Rationale**:
- Client components import `types/nats.ts` for form rendering and display. If they re-exported `nats` types, the bundler would pull the entire `nats` package (including Node builtins) into the browser bundle.
- The re-defined enums are constrained to match the `nats` library values. They must stay in sync.

## ADR-005: Dedicated monitor connection

**Decision**: The live monitor uses a separate NATS connection (`monitor-${id}-${timestamp}`) rather than sharing the pooled connection.

**Rationale**:
- Monitor subscriptions are long-lived. A shared connection could block or interfere with other operations.
- The dedicated connection is ephemeral — it's created for the SSE session and closed when the client disconnects.

## ADR-006: Promise-based confirm dialog over window.confirm

**Decision**: `ConfirmProvider` + `useConfirm()` hook provides a styled promise-based confirmation dialog.

**Rationale**:
- `window.confirm` is unstyled, non-themable, and can't support type-to-confirm.
- The promise pattern (`const ok = await confirm({...}); if (!ok) return;`) integrates cleanly with async Server Action flows.
- Implements typed-name confirmation for destructive actions (delete stream, delete bucket).

## ADR-007: URL-synced state via local React state as source of truth

**Decision**: `useUrlState` maintains local React state as the canonical source, mirroring it to the URL via `router.replace`.

**Rationale**:
- Reading from `useSearchParams()` on every render causes race conditions with fast keystrokes (the URL update lags behind the next render).
- Local state is immediately updated; the URL sync is a side effect. On mount, it reads once from the URL to seed the initial state.

## ADR-008: Shadcn/ui primitives are generated, never hand-edited

**Decision**: All `src/components/ui/*` files generated by `npx shadcn add <component>` must never be manually edited. Feature-specific viewers (for example payload inspection) live outside that generated set.

**Rationale**:
- `shadcn add` overwrites the generated primitive on the next run, so manual edits would be silently lost.
- Custom styling goes through Tailwind classes on the consumer side, not by editing the primitive.

## ADR-009: Browser-local bounded dashboard samples

**Decision**: Dashboard time series live in React state only. Samples are capped at 60, segmented by connection ID and monitoring endpoint, and cleared when there is no active connection. Unavailable metrics stay `null` and are not drawn as zero.

**Rationale**:
- The roadmap asked for live charts without a database or alerting backend.
- Connection changes must not mix series from different servers.

## ADR-010: Same-stream message comparison workspaces

**Decision**: Message comparison is a set of independent in-memory browsers for the current stream, capped at four tabs. Tabs do not persist payloads and reset when the active connection or stream changes.

**Rationale**:
- Operators need to compare positions in one stream without a multi-stream join.
- Keeping state in memory avoids storing message bodies in `localStorage`.

## ADR-011: Stream configuration import is not backup/restore

**Decision**: JSON stream-config import creates a new empty stream from a validated config (the inverse of config export). It does not restore messages, consumers, or stream state.

**Rationale**:
- nats.js v2 does not expose a JetStream snapshot/restore API used by this app.
- Presenting import as backup would be a false recovery path.

## ADR-012: KV watch uses a dedicated SSE connection

**Decision**: Live KV updates use `POST /api/kv/watch` with JSON body validation and a dedicated NATS connection (`kv-watch-${id}-…`), closed on abort. This is an ADR-001 exception, not a Server Action.

**Rationale**:
- A long-lived KV watcher would occupy the CRUD pool if it reused the shared connection.
- Credentials stay out of the query string.
