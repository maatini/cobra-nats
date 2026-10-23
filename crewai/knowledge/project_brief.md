# cobra-nats — crew brief

Use this as orientation. Prefer the live tree over this file if they disagree.

- Product: Next.js 16 / React 19 admin UI for NATS + JetStream (v0.6.0).
- Repo: https://github.com/maatini/cobra-nats
- Invariant: `nats` never runs in the browser. Server Actions + wrappers.
- Pool: `src/lib/nats/manager.ts` (one connection per config id, cached JSM).
- Features: `src/features/{connections,dashboard,streams,kv,os,publish,monitor}`.
- Tests: `tests/*.spec.ts` Playwright, including `functional-*` against real NATS.
- Open roadmap: live dashboard charts, cluster topology, multi-tab comparison.
- This crew produces markdown in `crewai/output/` only. No commits, no PRs.
