# Sequenced delivery plan: open README roadmap epics

**Status:** planning only — no roadmap feature has been implemented.  
**Scope:** the three unchecked epics in the README roadmap: live dashboard charts/time series, NATS cluster topology, and multi-tab message comparison.  
**Estimate convention:** S = a few focused days, M = roughly one to two weeks, L = several weeks including discovery/integration; these are relative engineering estimates, not commitments. They assume the current Next.js/React architecture, existing NATS Server Action boundary, and automated tests are retained.

## Planning assumptions and confirmed contracts

- NATS access stays server-side. Feature reads should use Server Actions in `src/features/<domain>/actions.ts`, the existing `withNatsConnection` / `withJetStream` wrappers, and serializable browser-safe DTOs in `src/types/nats.ts`. Do not import the NATS client into client components. The documented SSE and binary API routes are intentional exceptions, not a reason to add another transport casually.
- The dashboard already fetches current server identity/version and JetStream-enabled state through `getServerInfo`, lists streams/KV/OS buckets, and fetches JetStream account totals. `useAutoRefresh` refreshes the dashboard snapshot. This is current-state polling, not historical time-series storage. `HttpMonitoringCard` can fetch only the configured monitoring endpoint's `varz`, `jsz`, or `connz`; its monitoring URL is optional and its summary is a point-in-time view.
- `getServerInfo` returns `nc.info!` as the NATS.js `ServerInfo` object. Existing dashboard code consumes `server_name`, `version`, and `jetstream`. The inspected application code does not consume route lists or model cluster membership. NATS protocol INFO can provide connection/server metadata such as `connect_urls`, but that is not a dependable, complete cluster topology or live route inventory. Do not claim that the current ServerInfo action alone can draw an authoritative topology.
- A topology implementation therefore needs a separately confirmed discovery contract. The likely first source is the NATS HTTP monitoring API (`varz`/`connz`), which is reachable only if the user configures `monitoringUrl`; inspect actual NATS server/version response shapes and permissions before committing to nodes/edges. NATS monitoring endpoints are server-side fetched and constrained by `src/lib/server/monitoring-url-policy.ts`; the current allowlist contains `varz`, `jsz`, and `connz`, not a cluster endpoint. If those sources are insufficient, define a clearly labeled partial view or defer the epic rather than silently broadening access or inferring routes from configured connection URLs.
- `MessageBrowser` is in `src/features/streams/components/message-browser.tsx` and is used on the stream detail Messages tab. It loads an explicit sequence start, batch size (UI default 25, maximum input 500), and optional subject filter by calling `getStreamMessages` in `src/features/streams/actions.ts`. The action validates options, reads JetStream messages by sequence, serializes subject, sequence, timestamp, payload, headers, and size, and indicates whether more messages are available. Current browser supports expansion, keyboard navigation, replay, deletion, reload, and next-batch loading. This is a read/compare UX opportunity, not a request to change NATS message semantics.
- The recommendations document is explicitly an optional backlog, not a source of required scope. In particular, M5 is only optionally related if charts are limited to stream/consumer metrics; all other candidate IDs below are optional associations, not dependencies or acceptance gates.

## Delivery sequence

| Order | Epic / vertical slice | Effort | Why this order |
|---|---|---:|---|
| 1 | Live dashboard charts / time series | M | Builds on already-present dashboard polling and documented current-value sources. It establishes a safe, bounded sampling/data-retention pattern before adding more operational views. |
| 2 | NATS cluster topology view | L | Has the largest source-contract and version/permission uncertainty. Do a discovery spike and validate fixtures first; proceed only when a useful topology source is proven. |
| 3 | Multi-tab message comparison | M | Reuses the stable message-browser action/DTO and can be delivered independently after the user-facing interactions and test patterns are established. |

Sequence is a suggested delivery order, not a technical dependency between all three epics. The topology source-validation checkpoint is a hard go/no-go within that epic, not permission to implement speculative UI.

---

## 1. Live dashboard charts / time series

**Owner paths:** `src/features/dashboard/`, with route composition in `src/app/(dashboard)/page.tsx`; server reads remain in the appropriate existing action modules (`src/features/connections/actions.ts`, `src/features/streams/actions.ts`, and, if needed, `src/features/dashboard/actions.ts`). Shared response DTOs belong in `src/types/nats.ts`. Tests belong under `tests/` following existing Playwright smoke and functional conventions.

**Confirmed data sources:** dashboard current snapshot: NATS server info (`server_name`, `version`, `jetstream`), stream/KV/OS bucket counts, and JetStream account totals (`memory`, `storage`, `streams`, `consumers`, API totals/errors). Optional HTTP `varz` offers point-in-time server counters/CPU/memory/connections; `jsz` offers JetStream summaries; `connz` is connection-oriented. `useAutoRefresh` provides refresh cadence. None of these sources currently provides persisted historical samples.

**Vertical slices and dependencies:**

1. Define a small browser-safe, timestamped sample contract, source/metric labels, and a bounded history policy. Decide which metrics are meaningful and available without monitoring URL, and which are explicitly optional when monitoring is configured. Avoid treating missing/disabled JetStream values as actual zero.
2. Add a dashboard-local sampler that records successful snapshots at the configured refresh interval, bounds the number/age of samples, handles active-connection changes by resetting or segmenting series, and prevents overlapping requests/stale responses from polluting the new connection's series. No database is required for the initial slice.
3. Render accessible charts with units, time labels, loading/empty/error states, and a readable non-chart summary. Reuse current dashboard actions and monitoring fetch policy; do not put NATS calls in the browser.
4. Add deterministic tests for sampling, connection changes, missing metrics, and refresh/error behavior, plus dashboard coverage for rendered series and empty states.

**Acceptance criteria:**

- At least one clearly labeled time series is visible from repeated successful dashboard samples, with sample timestamps and units; metrics are sourced only from confirmed fields.
- The UI distinguishes unavailable/unsupported data from a measured zero and works when JetStream or optional HTTP monitoring is absent.
- The sample history has an explicit finite bound, does not grow indefinitely, and is not mixed across active connection changes.
- Refresh and chart failures do not break existing dashboard cards; errors and no-history states are understandable and accessible.
- All chart data is fetched through server actions/current approved monitoring action; no client-side NATS access or credentials are introduced.

**Effort:** M. **Optional backlog association:** M5 only if the delivered scope specifically includes stream/consumer metrics charts; optional, not a prerequisite.

**Explicitly out of scope:** durable historical storage, cross-session comparisons, alerting/thresholds, arbitrary metric query builders, a general metrics platform, full per-stream/per-consumer chart catalog, adding new monitoring endpoints without a separate security/source review, and claiming that client-side samples are authoritative server history.

---

## 2. NATS Cluster topology view

**Owner paths:** proposed `src/features/cluster/` (or `src/features/connections/` if kept strictly as connection diagnostics), a thin route at `src/app/(dashboard)/cluster/page.tsx` only if navigation/product scope is approved, and a server-side discovery action in the owning feature. Shared, sanitized topology DTOs belong in `src/types/nats.ts`. Extend `src/lib/server/monitoring-url-policy.ts` only after endpoint and SSRF policy review. Tests/fixtures belong in `tests/` and the feature's unit tests if available.

**Source contract / discovery dependency:** `getServerInfo` exposes the current connection's NATS.js `ServerInfo`; existing app usage confirms server name, version, and JetStream flag only. `connect_urls` (where present) describes client connection addresses, not a full peer/route graph. Current monitoring access permits `varz`, `jsz`, and `connz` using an optional configured monitoring base URL; it does not expose a cluster-specific route endpoint. `varz`/`connz` may provide useful cluster name, route, or peer information depending on the NATS Server version/configuration, but the app has not established that contract. Validate representative JSON from supported NATS versions and restricted/no-monitoring configurations before selecting fields.

**Vertical slices and dependencies:**

1. **Discovery spike (required, before UI):** collect/inspect supported server response fixtures and determine which identifiers and peer/route fields are present, stable, and permission-safe. Establish whether one monitoring URL covers only one server, how other nodes are queried, and whether routes are connections or inferred peers. Decide whether the feature can show a truthful partial topology. If the source does not support a useful graph, stop and revise scope.
2. Define a server-only discovery action and normalized topology DTO: stable node identity, display label, source/observed timestamp, optional connection/route edge state, and explicit completeness/limitations. Validate external inputs and keep secrets/credentials out of returned DTOs and logs.
3. Fetch and present a single-server or multi-node view only to the extent supported by the verified source. Provide useful unavailable, partial-data, stale-data, and authorization/configuration states. If additional node monitoring URLs are needed, specify how they are supplied and validated before implementing fan-out.
4. Add versioned fixture tests for normalization, missing/unknown fields, malformed data, and disconnected/partial cases; add functional coverage against a configured NATS test cluster if available.

**Acceptance criteria:**

- A documented discovery source and tested response contract are proven for the supported server configurations before topology rendering is built.
- Rendered nodes and edges reflect observed data only; client `connect_urls` are never presented as confirmed routes or cluster members.
- The view reports source timestamp and completeness and degrades honestly when HTTP monitoring is not configured, unsupported, or partially available.
- Server calls remain server-side and use existing monitoring URL safety controls (or separately reviewed extensions); no secrets or untrusted raw endpoint URLs are returned to the client.
- Fixture tests cover absent fields, version variation, malformed responses, and partial topology; functional tests demonstrate the supported configuration.

**Effort:** L (including discovery; revise after the spike). **Optional backlog association:** none required. M4 (system subjects/advisories) is adjacent operational work, not a topology dependency.

**Explicitly out of scope:** full NATS Control Plane parity, route management or server configuration changes, cluster healing/diagnostics, discovering arbitrary hosts from user-controlled URLs, treating seed URLs/client `connect_urls` as a complete topology, broad monitoring endpoint allowlisting, and guaranteed multi-cluster aggregation without a verified secure discovery contract.

---

## 3. Multi-tab message comparison

**Owner paths:** `src/features/streams/components/message-browser.tsx` and a feature-local comparison component under `src/features/streams/components/`; existing `src/features/streams/actions.ts` and `StreamMessage` / `GetStreamMessagesOptions` in `src/types/nats.ts` are the initial data contract. Keep integration within the existing stream detail Messages tab in `src/features/streams/components/stream-detail-view.tsx`. E2E coverage belongs in `tests/functional-consumers-and-messages.spec.ts` or a focused `tests/functional-message-comparison.spec.ts`.

**Confirmed data source:** `getStreamMessages(config, streamName, options)` returns sequence-addressed messages with sequence, subject, timestamp, payload string, headers, and byte size plus `hasMore`. Existing controls permit sequence range/start, bounded batch size, and subject filter; message actions include deletion and replay. The comparison feature can initially make independent reads against a selected stream using this existing action contract.

**Vertical slices and dependencies:**

1. Define the comparison interaction and state contract: two or more user-created tabs, each with independent stream/sequence/filter/batch/loading/error/expanded state; cap tab count and fetch size. Clarify whether tabs compare positions in one stream only or allow different streams before implementation. Initial recommendation: tabs can select independent positions in the current stream; cross-stream comparison is a separately scoped extension.
2. Extract/reuse message fetching and display primitives without changing existing single-browser behavior. Add/close/label tabs and preserve independent paging/filter state; only the active tab should trigger user-driven fetches unless prefetch is explicitly justified.
3. Add comparison affordances that make differences inspectable (e.g. aligned rows or side-by-side payload/header/subject/sequence/timestamp); provide clear empty and unequal-length states. Keep destructive operations explicit and scoped to the message's stream and sequence.
4. Add tests for tab independence, switching/closing, reload and pagination, filtered/empty responses, connection changes, and delete/replay source identity.

**Acceptance criteria:**

- Users can create, label/select, and close multiple comparison tabs, and each tab retains its own stream/sequence/filter and loaded result state when switching.
- Each pane clearly identifies its stream and sequence context; comparison never implies messages are equal by sequence alone across different streams.
- Fetches reuse validated Server Actions and bounded batches; loading, failure, no-result, and has-more states work independently per tab.
- Existing single message-browser flows (keyboard navigation, expansion, replay, deletion, reload, next batch) remain available and correctly target the selected message.
- State resets or is safely reloaded when the active NATS connection changes; no message payloads or connection credentials are persisted beyond the established UI state policy.

**Effort:** M. **Optional backlog association:** none required; no listed backlog item is a required dependency.

**Explicitly out of scope:** message publishing/editing, bulk delete, cross-stream diff semantics in the initial slice, server-side message retention or export, automatic live subscriptions, unbounded tabs/prefetch, persistent comparison workspaces, and changes to JetStream sequence or filtering semantics.

---

## Cross-epic quality and release gates

- Keep route files thin and feature ownership aligned with `src/features/<domain>/`; use the current `ActionResponse<T>` server-action convention and browser-safe DTOs.
- Add focused automated tests for each slice and preserve existing dashboard and stream-browser smoke/functional coverage. A topology feature must not pass acceptance on mocked assumptions alone: verify its source contract against a real supported server setup or captured, version-identified fixtures plus functional validation.
- Do not make a README feature checkbox look complete until the corresponding acceptance criteria are met and verified. Document optional monitoring prerequisites and known data limitations in the feature help/docs.
- No database, UI implementation, new charting dependency, new endpoint, or broad monitoring-policy relaxation is approved by this planning document.