# Cobra NATS — Overview

## Purpose

Cobra NATS is a **browser-based management dashboard** for NATS messaging and JetStream persistence. It replaces CLI tooling with a visual UI for managing streams, consumers, KV buckets, Object Stores, publishing messages, and monitoring subjects in real-time.

**Core promise**: NATS credentials and connection logic never reach the client browser. Almost all operations run as Server Actions; a small set of intentional API routes covers SSE and large binary uploads.

## Architecture at 30,000 feet

```
Browser (React SPA)
   │  Server Actions (features/*/actions.ts)  ──┐
   │  GET  /api/monitor (SSE)                 ──┼──> NatsManager / dedicated NC
   │  POST /api/os/upload (multipart)         ──┘
```

- **Client**: React 19 components under `src/features/<domain>/components/` and `src/app/(dashboard)/<route>/page.tsx`
- **Server boundary (primary)**: Server Actions under `src/features/<domain>/actions.ts` via `withNatsConnection` / `withJetStream`
- **Server boundary (exceptions)**: `GET /api/monitor` (SSE live monitor via `features/monitor/stream.ts`) and `POST /api/os/upload` (multipart binary; avoids RSC payload limits)
- **Connection pool**: `src/lib/nats/manager.ts` — singleton `NatsManager` caches one `NatsConnection` per config ID (monitor uses a dedicated connection ID)
- **State**: Zustand store (`src/features/connections/store.ts`) persisted to `localStorage` under key `cobra-nats-storage`
- **Routing**: Next.js App Router with a single dashboard layout wrapping all pages

## Key principles

1. **Server-first NATS**. The client NEVER imports `nats` or calls NATS directly. NATS runs on the server — either as a Server Action returning `ActionResponse<T>`, or via the intentional API routes above (SSE / multipart).
2. **Feature isolation**. Everything for a domain (actions, UI, store) lives in `src/features/<domain>/`. No cross-feature imports without justification.
3. **TypeScript strict**. No `any`, no `@ts-ignore`. NATS enums are re-defined in `src/types/nats.ts` so the client never pulls the full `nats` package.
4. **shadcn/ui only**. UI primitives come from `src/components/ui/`, populated via `shadcn add`. No custom buttons/inputs.
5. **Actions pattern**: Every Server Action takes `NatsConnectionConfig` as first param, returns `ActionResponse<T>`, uses `withNatsConnection` or `withJetStream` wrapper.
6. **Error surfacing**: Client always checks `if (!res.success)` and toasts the error for action results. No silent failures.

## Project layout (condensed)

| Path | Role |
|---|---|
| `src/app/(dashboard)/` | Next.js routes (thin — delegates to feature components) |
| `src/app/api/monitor/route.ts` | SSE endpoint for live monitor |
| `src/app/api/os/upload/route.ts` | Multipart OS object upload (binary; not a Server Action) |
| `src/features/<domain>/actions.ts` | All Server Actions for the domain |
| `src/features/<domain>/components/` | Domain-specific UI components |
| `src/features/connections/store.ts` | Zustand connection store (persisted) |
| `src/features/connections/hooks.ts` | `useActiveConnection()`, `useConnectionHealth()` |
| `src/components/ui/` | shadcn primitives — managed by CLI, never hand-edited |
| `src/components/layout/` | App shell: sidebar, topbar, breadcrumbs, shortcuts, command palette |
| `src/components/providers/` | React context providers (Root + Confirm dialog) |
| `src/hooks/` | App-wide hooks: localStorage, auto-refresh, URL state, keyboard shortcuts |
| `src/lib/nats/manager.ts` | `NatsManager` singleton — connection pool and JSM cache |
| `src/lib/server-action.ts` | `withNatsConnection`, `withJetStream`, `ActionResponse<T>`, `getErrorMessage` |
| `src/lib/utils.ts` | `cn()` tailwind-merge utility |
| `src/types/nats.ts` | Shared domain types + re-defined NATS enums |
| `tests/` | Flat Playwright E2E tests (spec + functional) |

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (New York style) |
| State | Zustand 5, TanStack React Query 5 |
| Forms | React Hook Form 7 + Zod 4 + `@hookform/resolvers` |
| NATS client | nats.js 2.29 (server-side only) |
| Tables | TanStack Table 8 |
| Syntax highlighting | Shiki 4 |
| Markdown rendering | Marked 18 |
| Toast | Sonner 2 |
| Command palette | cmdk 1 |
| Icons | Lucide React 1 |
| Testing | Playwright 1.61 |
