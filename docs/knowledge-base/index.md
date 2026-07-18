# Cobra NATS — Knowledge Base (Agent-Optimized)

**Project**: Web-based management UI for [NATS](https://nats.io) and JetStream.
**Stack**: Next.js 16 (App Router) · React 19 · TypeScript 6 · Tailwind v4 · shadcn/ui · nats.js v2.29
**Version**: 0.6.0

## Quick-start for coding agents

1. Read [overview.md](./overview.md) for high-level purpose and principles.
2. Read [architecture/components.md](./architecture/components.md) for the map of every major component.
3. Find the module you need below → open its `responsibility.md` to understand ownership, invariants, and entry points.
4. Check the module's `dependencies.md` to see what it depends on and who calls it.
5. Check **[cross-cutting/tags.md](./cross-cutting/tags.md)** for the `@tag:...` glossary if you see one in use.

## Navigation

### Architecture (global)
- [overview.md](./overview.md) — Project purpose, architecture summary, key principles, tech versions
- [architecture/index.md](./architecture/index.md) — Architecture folder index
- [architecture/components.md](./architecture/components.md) — All logical components with responsibilities at-a-glance
- [architecture/dependencies.md](./architecture/dependencies.md) — Global dependency map + Mermaid graphs
- [architecture/data-flows.md](./architecture/data-flows.md) — Key data flows and interactions (Mermaid)
- [architecture/decisions.md](./architecture/decisions.md) — Key architectural decisions (ADR-style)

### Modules (domains)
- [modules/core/](./modules/core/) — Shared infrastructure: `lib/nats/`, `lib/server-action.ts`, `types/nats.ts`, `hooks/`, `components/ui/`
- [modules/connections/](./modules/connections/) — NATS connection store, hook, actions, connect dialog
- [modules/streams/](./modules/streams/) — JetStream streams + consumers + message browser
- [modules/kv/](./modules/kv/) — Key-Value bucket management
- [modules/os/](./modules/os/) — Object Store bucket management + upload/download
- [modules/publish/](./modules/publish/) — Publish + request-reply actions
- [modules/monitor/](./modules/monitor/) — Live subject monitor (SSE-based)
- [modules/dashboard/](./modules/dashboard/) — Dashboard overview (pure UI aggregation)
- [modules/layout/](./modules/layout/) — App chrome: sidebar, topbar, breadcrumbs, shortcuts, command palette
- [modules/testing/](./modules/testing/) — Playwright E2E test suites

### Cross-cutting
- [cross-cutting/index.md](./cross-cutting/index.md) — Shared concerns index
- [cross-cutting/tags.md](./cross-cutting/tags.md) — Registry of `@tag:...` concepts
- [cross-cutting/shared-patterns.md](./cross-cutting/shared-patterns.md) — Reusable patterns that span modules

### Maintenance
- [maintenance.md](./maintenance.md) — How/when to update this knowledge base

### Product backlog (optional)
- [../recommendations.md](../recommendations.md) — Residual nice-to-haves after P0–P4 (not a full gap analysis).
