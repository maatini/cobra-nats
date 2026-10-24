# Remaining optional backlog — Cobra NATS

**Stand:** after v0.7.0 product/hygiene release  
**Scope:** open nice-to-haves only. Completed work is in git history; do not treat this file as a gap analysis of the current tree.

Architecture constraints still apply: NATS only on the server; Server Actions + wrappers; SSE/Multipart only as intentional exceptions (`AGENTS.md`, `docs/knowledge-base/`).

---

## Done (reference)

P0–P4 checklist items (Monitor auth, stream update/purge, KV history, consumer detail, TLS/nkey/JWT/creds, OS seal/prefix/download, mirrors, dashboard, publish replay, monitor backpressure, DTOs, ESLint, E2E CI, …) are implemented.

Also shipped in **v0.7.0**: dashboard time series (ADR-009), same-stream message comparison (ADR-010), stream config JSON import (ADR-011), KV watch SSE (ADR-012), command-palette actions (U4), payload inspection (JSON/CBOR/hex/protobuf), `date-fns` → Intl (Q2). Details: commits on `main` and feature modules under `src/features/**`.

---

## Still open (optional)

| ID | Item | Priority | Effort | Notes |
|---|---|---|---|---|
| **M4** | System subjects / `$JS.EVENT` advisory views | Low | M | Power-user |
| **M5** | Consumer/Stream metrics charts | Low | L | Dashboard already has **server-level** sparklines; this is per-stream/consumer |
| **K4** | KV multi-get / bulk UX | Low | S–M | Live watch (K3) shipped in v0.7.0 |
| **A4** | Connection profiles / env presets | Low | M | Deploy ergonomics |
| **Q4** | App-level UI auth (shared deployment) | Low until needed | L | Not browser NATS |
| **Q5** | Connection-pool limits / idle timeout UX | Low–Med | M | Pool cap 32 exists; no idle-timeout UX |
| **P2** | Publish binary / schema UX polish | Low | S | Message/monitor payload viewer shipped; Publish still text-first |

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
