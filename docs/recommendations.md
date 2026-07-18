# Remaining optional backlog — Cobra NATS

**Stand:** after P0–P4 implementation (v0.6.0)  
**Scope:** open nice-to-haves only. Completed work is in git history; do not treat this file as a gap analysis of the current tree.

Architecture constraints still apply: NATS only on the server; Server Actions + wrappers; SSE/Multipart only as intentional exceptions (`CLAUDE.md`, `docs/knowledge-base/`).

---

## Done (reference)

P0–P4 checklist items (Monitor auth, stream update/purge, KV history, consumer detail, TLS/nkey/JWT/creds, OS seal/prefix/download, mirrors, dashboard, publish replay, monitor backpressure, DTOs, ESLint, E2E CI, …) are implemented. Details: commits on `main` and feature modules under `src/features/**`.

---

## Still open (optional)

| ID | Item | Priority | Effort | Notes |
|---|---|---|---|---|
| **U4** | Command palette: actions, not only navigation | Low–Med | M | e.g. “Purge stream X” |
| **M4** | System subjects / `$JS.EVENT` advisory views | Low | M | Power-user |
| **M5** | Consumer/Stream metrics charts | Low | L | Needs sampling/store |
| **K3** | KV watch / live key updates | Low | M | If demanded |
| **K4** | KV multi-get / bulk UX | Low | S–M | |
| **A4** | Connection profiles / env presets | Low | M | Deploy ergonomics |
| **Q2** | Replace `date-fns` with `Intl` where possible | Low | S | Bundle polish |
| **Q4** | App-level UI auth (shared deployment) | Low until needed | L | Not browser NATS |
| **Q5** | Connection-pool limits / idle timeout UX | Low–Med | M | Long-running servers |
| **P2** | Publish binary / schema UX polish | Low | S | |

---

## Explicit non-goals (unchanged)

| Idea | Why not (now) |
|---|---|
| `nats` in the browser | Breaks server-boundary ADR |
| Secrets in SSE/query strings | Logging/referrer risk |
| Full Control-Plane parity | Scope explosion |
| Stack rewrite / GraphQL gateway | No ROI |
| German product UI | Admin English is standard |
| Re-introduce React Query without need | `useServerActionQuery` covers lists |
| Custom Button/Input instead of shadcn | Project rule |
