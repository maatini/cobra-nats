---
name: cobra-new-feature
description: >
  Scaffold a new Cobra NATS domain end-to-end (types, Server Actions, UI, route,
  sidebar, Playwright). Use when the user asks for a new feature/domain module,
  "add a new page", or runs /cobra-new-feature.
---

# Cobra: new feature

Follow the blueprint in **`.claude/architecture.md`** → “Blueprint: add a new feature”. Patterns live in **`.claude/rules.md`** — do not invent alternate layouts.

## Checklist

1. **Types** (if needed) → extend `src/types/nats.ts` only (`nats-jetstream-expert` for enum/DTO design).
2. **Feature folder** → `src/features/<domain>/{actions.ts, components/}` (+ store/hooks only if required).
3. **Server Actions** → `"use server"` + `withJetStream` / `withNatsConnection`; first arg `NatsConnectionConfig`; return `ActionResponse<T>`. Prefer **`server-actions-agent`**.
4. **UI** → `src/features/<domain>/components/*` with `useActiveConnection()` and mandatory `if (!res.success)` narrowing. Prefer **`nextjs-frontend-agent`**.
5. **Route** → thin page under `src/app/(dashboard)/<domain>/page.tsx`.
6. **Chrome** → sidebar / command palette / breadcrumbs if the feature is user-facing.
7. **shadcn** → only via `npx shadcn@latest add …` (`ui-shadcn-agent`); no custom Button/Input.
8. **E2E** → `tests/<domain>.spec.ts` (flat); seed `cobra-nats-storage`. Prefer **`playwright-testing-agent`** or skill `cobra-e2e`.

## Invariants (never regress)

- NATS and credentials only on the server.
- No `src/app/actions/*`; no `nats` import on the client.
- Intentional API exceptions only: monitor SSE, OS upload/download (see `AGENTS.md`).
- English UI strings; domain colors from `.claude/project.md`.

## Verify

- `npm run lint` / typecheck as appropriate.
- `npx playwright test <domain>.spec.ts` with NATS on `:4222`.
- If docs claim stack/features changed: `node scripts/verify-prompt-docs.mjs`.
