# Sequenced delivery plan: README roadmap epics

**Status:** two of three shipped in **v0.7.0**. Cluster topology remains open.  
**Shipped:** live dashboard time series (ADR-009), same-stream message comparison (ADR-010).  
**Open:** NATS cluster topology — discovery spike found no truthful graph; no UI until a verified source exists.  
**Estimate convention:** S = a few focused days, M = roughly one to two weeks, L = several weeks including discovery/integration.

## Planning assumptions (still apply)

- NATS access stays server-side. Feature reads use Server Actions in `src/features/<domain>/actions.ts`, the existing `withNatsConnection` / `withJetStream` wrappers, and serializable DTOs in `src/types/nats.ts`. Documented SSE and binary API routes are intentional exceptions.
- HTTP monitoring is optional (`monitoringUrl`) and constrained by `src/lib/server/monitoring-url-policy.ts` to `varz`, `jsz`, and `connz`.
- `getServerInfo` exposes `server_name`, `version`, and `jetstream`. `connect_urls` are client connection addresses, not a cluster topology. Do not infer routes from them.
- `docs/recommendations.md` is an optional backlog, not required scope.

## Delivery sequence

| Order | Epic | Status | Effort |
|---|---|---|---:|
| 1 | Live dashboard charts / time series | **Shipped in v0.7.0** — `sampler.ts`, `dashboard-time-series.tsx`, ADR-009, `tests/functional-dashboard-history.spec.ts` | M |
| 2 | NATS cluster topology view | **Open** — discovery first; no UI without a proven source | L |
| 3 | Multi-tab message comparison | **Shipped in v0.7.0** — `message-comparison-tabs.tsx`, ADR-010, same-stream only, max 4 tabs | M |

---

## 1. Live dashboard charts / time series — shipped

In-memory samples (cap 60), segmented by connection ID and monitoring endpoint. Missing metrics stay `null`. No database, no alerting.

Owner paths: `src/features/dashboard/{sampler.ts,dashboard-time-series.tsx,dashboard-overview.tsx}`.

---

## 2. NATS Cluster topology view — open

**Owner paths:** proposed `src/features/cluster/` (or `src/features/connections/` if kept as connection diagnostics), a thin route at `src/app/(dashboard)/cluster/page.tsx` only if navigation/product scope is approved, and a server-side discovery action in the owning feature. Shared topology DTOs belong in `src/types/nats.ts`. Extend `src/lib/server/monitoring-url-policy.ts` only after endpoint and SSRF policy review.

**Source contract:** `getServerInfo` confirms server name, version, and JetStream flag only. `connect_urls` are not a peer/route graph. Current monitoring permits `varz`, `jsz`, and `connz` using an optional monitoring base URL. Validate representative JSON from supported NATS versions before selecting fields.

**Vertical slices:**

1. **Discovery spike (required, before UI):** inspect fixtures; decide whether a truthful partial topology is possible. If not, stop.
2. Define a server-only discovery action and normalized DTO: stable node identity, source timestamp, optional edges, explicit completeness. Keep secrets out of DTOs and logs.
3. Present only what the verified source supports. Degrade honestly when monitoring is absent.
4. Versioned fixture tests plus functional coverage against a configured test cluster if available.

**Acceptance criteria:**

- A documented discovery source and tested response contract exist before topology rendering.
- Rendered nodes and edges reflect observed data only; `connect_urls` are never presented as confirmed routes.
- The view reports source timestamp and completeness.
- Server calls remain server-side and use existing monitoring URL safety controls.

**Explicitly out of scope:** Control Plane parity, route management, inferring topology from seed URLs, broad monitoring allowlisting.

---

## 3. Multi-tab message comparison — shipped

Up to four independent in-memory browsers on the **current** stream. Each tab has its own sequence, filter, and batch. Not a diff view. Not cross-stream. Tabs reset when the active connection or stream changes.

Owner paths: `src/features/streams/components/message-comparison-tabs.tsx`, `message-browser.tsx`. Tests: `tests/functional-consumers-and-messages.spec.ts` (scope locators to the visible tabpanel; hidden tabs stay mounted).

---

## Cross-epic quality and release gates

- Keep route files thin and feature ownership aligned with `src/features/<domain>/`.
- Do not mark a README checkbox complete until acceptance criteria are met.
- No database, new charting dependency, or broad monitoring-policy relaxation is approved by this document.
