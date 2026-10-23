# cobra-nats — crew brief

Use this as orientation. Prefer the live tree over this file if they disagree.

- Product: Next.js 16 / React 19 admin UI for NATS + JetStream (v0.7.0).
- Repo: https://github.com/maatini/cobra-nats
- Invariant: `nats` never runs in the browser. Server Actions + wrappers.
- Intentional API exceptions: `POST /api/monitor`, `POST /api/kv/watch`, `POST /api/os/upload`, `POST /api/os/download`.
- Pool: `src/lib/nats/manager.ts` (one connection per config id, generation checks, cap 32, JSM bound to live NC).
- Features: `src/features/{connections,dashboard,streams,kv,os,publish,monitor}`.
- Tests: `tests/*.spec.ts` Playwright, including `functional-*` against real NATS; Vitest next to source.
- Open roadmap: cluster topology (after a verified discovery source). Dashboard time series and same-stream comparison shipped in v0.7.0.
- This crew produces markdown in `crewai/output/` only. No commits, no PRs.
