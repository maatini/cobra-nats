# Implementation brief — product (visible) + hygiene

Source: analysis of cobra-nats **0.6.0** (local checkout + README roadmap +
`docs/roadmap-sequence.md` + `docs/recommendations.md` + NATS 2.12 docs +
nats-nui / Qaze / Hyerix).

**Status (v0.7.0):** executed on `main`. Landed: dashboard time series, same-stream
comparison, payload formats, palette actions, KV watch, stream config import,
hygiene (Dockerfile Node 22, Intl dates, README auth table, ADR-003). Skipped:
nats.js v3, NATS 2.12 flags, cluster topology UI, Services API, credential
trust. Do not re-run this brief as a greenfield implementation.

This crew **implements** application, test, and documentation changes in the
local checkout. It does **not** commit, push, merge GitHub PRs, or open pull
requests.

The previous crew (`crewai/knowledge/implement_brief.md`) already landed
runtime Zod, NatsManager generation/pool cap, monitoring URL policy, tests,
cleanup, docs, OS list dedupe, and the **plan** in `docs/roadmap-sequence.md`.
Do not re-do those items. Do not treat that plan as “planning only” anymore:
the three README epics are now **in scope to build**, with the contracts in
that file.

## Hard skip — credential trust (legacy action 2)

Do **not** implement, redesign, or “resolve” the credential trust model:

- Do not add caller authentication / multi-tenant authorization.
- Do not move connection secrets out of the browser store.
- Do not treat config id as a new authz scheme.

Factual docs that profiles (including credentials) currently live in
`localStorage` key `cobra-nats-storage` remain allowed.

## Coding laws (mandatory)

- NATS never in the browser. No `import "nats"` from client components.
- Server Actions in `src/features/<domain>/actions.ts`. First arg is
  `NatsConnectionConfig`. Return `ActionResponse<T>` via `withNatsConnection`
  / `withJetStream`.
- Intentional API exceptions today: `/api/monitor` SSE, `/api/os/upload`
  multipart, `/api/os/download` stream. New SSE routes are allowed **only**
  when a live subscription cannot be a Server Action (same POST-JSON-body
  pattern as monitor: config in body, no secrets in the query string).
  Document each new exception in README, AGENTS.md, CLAUDE.md, and ADR-001.
- Types and browser-safe DTOs in `src/types/nats.ts`. UI: shadcn/ui New York,
  English strings. Do not hand-edit `src/components/ui/*`; add primitives with
  `npx shadcn@latest add`.
- Tests: Playwright under `tests/*.spec.ts`; Vitest next to source.
- TypeScript strict, no `any`, no `@ts-ignore`.
- Surgical diffs. Match existing style.
- Do not invent cluster topology from client `connect_urls`.
- Do not expose NATS 2.12 stream flags in the UI unless the JS client in
  `package.json` actually supports writing those config fields.

## Sequence (mandatory order)

Hygiene first, then the nats.js v3 go/no-go, then product features. Later
items **skip** when a documented gate fails — write that skip in the task
note and continue.

| Order | ID | Outcome | Gate |
|---:|---|---|---|
| 1 | H-A, H-C, H-D, H-E, H-F | Dependabot prod bumps, Dockerfile Node 22, README auth table, ADR-003, date-fns → Intl | none |
| 2 | H-B | Evaluate and, if safe, migrate `nats` npm 2.29.x → nats.js v3 | if unsafe, skip P-6 and H-G |
| 3 | P-1 | Live dashboard charts / time series | `docs/roadmap-sequence.md` §1 |
| 4 | P-2 | Multi-tab message comparison | `docs/roadmap-sequence.md` §3 |
| 5 | P-3 + P-4 | Payload formats (hex / CBOR / optional protobuf) + command-palette **actions** | none |
| 6 | P-5 | KV watch / live key updates | none |
| 7 | P-6 + H-G | Stream flags NATS 2.11/2.12 + prioritized pull consumer | **requires H-B landed** |
| 8 | P-7 | Cluster topology | discovery spike first; skip UI if source is not truthful |
| 9 | P-8 + P-9 | NATS Services API + stream backup/restore (or config import fallback) | skip each independently if the client has no API |
| 10 | QA | Tests for whatever landed | none |
| 11 | Docs | README roadmap checkboxes, knowledge-base, ADR-001 if new SSE | none |

## Hygiene details

### H-A — Dependabot alignment (local versions, not GitHub merge)

Open GitHub items on `maatini/cobra-nats` are Dependabot PRs, not product
issues. Align **local** `package.json` / lockfile with prod PR **98**:

- `@tanstack/react-table` 9.3.1
- `lucide-react` 1.57.0
- `marked` 18.1.1
- `next` 16.4.2
- `radix-ui` 1.8.1
- `react` / `react-dom` 19.3.1
- `react-hook-form` 7.90.0
- `shiki` 4.5.0
- `zod` 4.6.7

Use `npm install <pkg>@<version>` (allowlisted). Do not `gh pr merge`. Skip
GitHub Actions workflow-only bumps if they are not in this checkout’s npm
tree. After bumps: `npx tsc --noEmit`.

### H-C — Dockerfile runtime line

`Dockerfile` uses `node:26-alpine`. mise pins Node **22**. README says ≥ 20.
Change all three Dockerfile stages to `node:22-alpine` and add a one-line
comment that the image follows mise LTS. Do not rewrite the Docker build.

### H-D — README auth table

README “Authentication Types” currently lists only `none`, `user_pass`,
`token`. Features and the connect dialog already support `nkey`, `jwt`,
`creds` and optional TLS. Extend the table to match `NatsAuthType` in
`src/types/nats.ts`.

### H-E — ADR-003

`docs/knowledge-base/architecture/decisions.md` ADR-003 still describes
cache-until-close. Update it to the current `NatsManager`: generation checks,
in-flight coalescing, JSM bound to the live connection, `MAX_POOL_SIZE` 32.
Keep the singleton decision.

### H-F — date-fns → Intl (Q2)

Usages: `consumer-list.tsx`, `monitor-view.tsx`, `kv-detail-view.tsx`,
`consumer-detail-sheet.tsx`, `stream-table.tsx`, `stream-info-view.tsx`,
`message-browser.tsx`. Replace with `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`
(small helper under `src/lib/` if that avoids duplication). Remove `date-fns`
from `package.json` if nothing imports it (`npm uninstall date-fns`).

## H-B — nats.js v2 → v3 (enabler)

Current client: `nats` 2.29.3. NATS 2.12 APIs (atomic batch, counters,
schedules, prioritized pull) landed in **nats.js v3.2.0** (`@nats-io/*`
modules; `jetstream(nc)` instead of `nc.jetstream()`).

1. Read current imports of `"nats"` under `src/` and `package.json`.
2. If a focused migration can keep `npx tsc --noEmit` green without rewriting
   feature UI, do it (server-only; ADR-004 enums stay local).
3. If the blast radius is a half-migrated tree or a multi-day rewrite, **stop**:
   write the spike findings in the task note, leave `nats@2.29.x` in place,
   and skip P-6 and H-G.

Do not leave the checkout compiling against a mix of v2 and v3 APIs.

## Product details

### P-1 — Live dashboard charts

Follow `docs/roadmap-sequence.md` section 1 **acceptance criteria**.

- Browser-safe timestamped samples from existing dashboard actions /
  `fetchHttpMonitoring`. No database.
- Bound history; reset or segment when the active connection changes.
- Distinguish unavailable metrics from measured zero.
- Charts: SVG sparklines **or** `npx shadcn@latest add chart` (recharts).
  No metrics platform, no alerting.
- Owner: `src/features/dashboard/`. Tests for sampler + empty/error states.

### P-2 — Multi-tab message comparison

Follow `docs/roadmap-sequence.md` section 3.

- Tabs on the current stream first (independent sequence/filter/batch).
- Cap tab count and batch size. Reuse `getStreamMessages`.
- Keep existing single-browser keyboard / expand / replay / delete.
- Owner: `src/features/streams/components/`. Playwright in
  `tests/functional-consumers-and-messages.spec.ts` or a new
  `tests/functional-message-comparison.spec.ts`.

### P-3 — Payload formats

nats-nui differentiates on hex / protobuf / CBOR. Today `code-viewer` treats
`proto` as syntax highlight only.

- Message browser, monitor expand, and publish preview: detect JSON vs
  binary; show hex for binary; decode CBOR with a small dependency if the
  bytes look like CBOR.
- Protobuf: optional paste-a-schema / descriptor in the view — skip a full
  schema registry.
- Do not put decoders on the NATS server path; decode in the UI from already
  serialized payload bytes/strings.

### P-4 — Command palette actions (U4)

`src/components/layout/command-palette.tsx` is navigation + connection switch.
Add **actions** (not only routes): e.g. New Connection, Publish, and
context-aware Purge/Delete when the URL is a stream/KV/OS detail.
Destructive actions must go through `useConfirm()`. Do not run NATS from the
palette without the existing Server Actions.

### P-5 — KV watch (K3)

Live key updates on KV detail. Prefer a dedicated connection (ADR-005 pattern)
and SSE POST if a long-lived watch is required; otherwise bounded polling via
an existing Server Action. Pause/resume. Do not share the pooled CRUD
connection for a long-lived watch. New SSE = document as an API exception.

### P-6 — Stream flags 2.11 / 2.12

Only if H-B landed. Extend `StreamConfigDto`, serialize, create/edit dialogs,
and info view for flags the **client actually types**:

- AllowMsgTTL (2.11)
- AllowAtomicPublish, AllowMsgCounter, AllowMsgSchedules (2.12)
- PersistMode if present
- Subject transforms only if the DTO/client supports them

Do not send unknown fields that the server will reject on 2.10. Gate the UI
on server version from `getServerInfo` when easy; otherwise document that
older servers return errors.

### H-G — Prioritized pull

Only if H-B landed. Add the 2.12 prioritized pull policy to
`create-consumer-dialog.tsx` / consumer DTOs when the client enum exists.

### P-7 — Cluster topology

Follow `docs/roadmap-sequence.md` section 2.

1. **Discovery spike required** before UI: inspect `varz` / `connz` fixtures
   (and `getServerInfo`). Current allowlist is varz, jsz, connz only.
2. If the source cannot support a truthful partial graph, skip the UI and
   write the finding.
3. Never present `connect_urls` as confirmed routes.
4. New monitoring paths need a separate policy review — do not silently
   widen `monitoring-url-policy.ts`.

### P-8 — NATS Services API

New feature folder `src/features/services/` only if the connected client can
discover `$SRV` / services. Thin route, sidebar + palette entry, Playwright
smoke. Skip if the API is missing.

### P-9 — Stream backup / restore

nats-nui lists this as coming soon. Prefer JetStream snapshot APIs if the
client exposes them. If not, land **config JSON import** (inverse of
`exportStreamConfig` in `stream-form-utils.ts`) and skip binary snapshot.
Do not claim backup if only config import landed.

## Verification

After each code task: `npx tsc --noEmit`, then `npm run lint` when the graph
changed. Targeted `npx vitest run` for new unit tests. Named Playwright specs
only; skip the run if no NATS on localhost:4222 and say so.

## Key files

- `docs/roadmap-sequence.md`, `docs/recommendations.md`, `README.md`
- `src/lib/nats/manager.ts`, `src/types/nats.ts`, `src/lib/nats/serialize.ts`
- `src/features/dashboard/`, `src/features/streams/`, `src/features/kv/`
- `src/components/layout/command-palette.tsx`, `src/components/layout/app-sidebar.tsx`
- `src/lib/server/monitoring-url-policy.ts`
- `Dockerfile`, `package.json`, `docs/knowledge-base/architecture/decisions.md`
- `tests/*.spec.ts`

## Out of scope

- Credential trust redesign
- Control Plane / Synadia parity
- NATS in the browser
- German product UI
- Git commit, push, `gh`, Dependabot PR merge
- Durable metrics database, alerting, Terraform export, desktop app
