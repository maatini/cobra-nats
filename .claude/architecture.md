# Architecture – Cobra NATS

This document is the **"where does what live?" map** for AI agents. Read it first, before you write code.

## Data flow

```
┌──────────────┐   import    ┌──────────────────┐   call    ┌──────────────────┐
│ UI Component │ ──────────> │ Server Action    │ ────────> │ NatsManager      │
│ (.tsx)       │             │ features/…/      │           │ lib/nats/        │
│              │  <───────── │  actions.ts      │ <──────── │  manager.ts      │
└──────────────┘  Action      └──────────────────┘ NATS conn └──────────────────┘
                  Response           │
                  <T>                │ wraps via
                                     ▼
                           ┌──────────────────────┐
                           │ withJetStream /      │
                           │ withNatsConnection   │
                           │ lib/server-action.ts │
                           └──────────────────────┘
```

The client **never calls NATS directly**. It imports server actions; Next.js marshals the call, the action uses the singleton `natsManager`, and returns a serializable `ActionResponse<T>`.

## Full folder map

| Path | Role | Who edits it? |
|---|---|---|
| `src/app/(dashboard)/<route>/page.tsx` | User pages | `@nextjs-frontend-agent` |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout (sidebar + topbar + breadcrumbs + command palette) | `@nextjs-frontend-agent` |
| `src/app/api/monitor/route.ts` | SSE endpoint for the live subject monitor (the only REST endpoint) | `@server-actions-agent` |
| `src/features/<domain>/actions.ts` | All server actions for the feature | `@server-actions-agent` |
| `src/features/<domain>/components/*.tsx` | Feature-specific UI | `@nextjs-frontend-agent` / `@ui-shadcn-agent` |
| `src/features/connections/store.ts` | Zustand store for connections (persist) | `@nextjs-frontend-agent` |
| `src/features/connections/hooks.ts` | `useActiveConnection()` | `@nextjs-frontend-agent` |
| `src/features/dashboard/dashboard-overview.tsx` | Landing page — pure aggregation, no own actions | `@nextjs-frontend-agent` |
| `src/features/monitor/monitor-view.tsx` + `stream.ts` | Live monitor: `stream.ts` encapsulates the SSE client (not `actions.ts`!) | `@nextjs-frontend-agent` / `@server-actions-agent` |
| `src/components/ui/*` | shadcn primitives — only via `shadcn add` | – |
| `src/components/layout/*` | app-sidebar, topbar, theme-toggle, auto-breadcrumbs, command-palette, global-shortcuts, help-dialog, no-connection-banner | `@nextjs-frontend-agent` |
| `src/components/providers/*` | Root provider + confirm-dialog provider | `@nextjs-frontend-agent` |
| `src/hooks/*` | App-wide hooks: `use-mobile`, `use-keyboard-shortcuts`, `use-local-storage`, `use-auto-refresh`, `use-url-state` | `@nextjs-frontend-agent` |
| `src/lib/nats/manager.ts` | Singleton `NatsManager` — connection pool | `@nats-jetstream-expert` |
| `src/lib/server-action.ts` | `withNatsConnection`, `withJetStream`, `ActionResponse<T>` | `@server-actions-agent` |
| `src/types/nats.ts` | All shared domain types + enums | `@nats-jetstream-expert` |
| `tests/*.spec.ts` | Playwright E2E (flat, including `functional-*.spec.ts`) | `@playwright-testing-agent` |

## Blueprint: add a new feature

Example: you want to add a **"Subjects"** feature.

1. **Types** (if new) → extend `src/types/nats.ts`.
2. **Create the folder** → `src/features/subjects/{actions.ts, components/}`
3. **Write the action** → `src/features/subjects/actions.ts`:
   ```ts
   "use server";
   import type { NatsConnectionConfig } from "@/types/nats";
   import { withNatsConnection, type ActionResponse } from "@/lib/server-action";

   export async function listSubjects(
       config: NatsConnectionConfig
   ): Promise<ActionResponse<string[]>> {
       return withNatsConnection(config, "listSubjects", async (nc) => {
           // … NATS operations
           return [];
       });
   }
   ```
4. **UI components** → `src/features/subjects/components/subject-list.tsx`:
   ```tsx
   "use client";
   import { useActiveConnection } from "@/features/connections/hooks";
   import { listSubjects } from "@/features/subjects/actions";
   // ...
   ```
5. **Route** → `src/app/(dashboard)/subjects/page.tsx` (renders components from `features/subjects/components/`).
6. **Sidebar entry** → extend `src/components/layout/app-sidebar.tsx`.
7. **Playwright test** → `tests/subjects.spec.ts`.

**Important**: Never create a `src/app/actions/` file — that directory no longer exists. Actions live per feature.

## Blueprint: add a new action to an existing feature

Example: a new KV operation `purgeKVKey`.

1. Open `src/features/kv/actions.ts`.
2. Append the function **at the end** (order: List → Create → Get → Mutate → Delete).
3. Do not create a new file — everything for one feature stays in `actions.ts`.
4. UI: add a new component or extend an existing one under `src/features/kv/components/`.

## Blueprint: new shadcn component

```bash
npx shadcn@latest add <component-name>
```
Lands automatically in `src/components/ui/`. **Do not edit manually** — it gets overwritten on the next `add`.

## Common "where does what live?" answers

| Question | Answer |
|---|---|
| Connection state / localStorage | `src/features/connections/store.ts` (Zustand + persist) |
| Get the active connection | `useActiveConnection()` from `@/features/connections/hooks` |
| Error wrapping for an action | `withJetStream(config, "opName", async ({js, jsm}) => {...})` |
| New NATS auth type | `NatsConnectionConfig` in `types/nats.ts` + `connect-dialog.tsx` |
| Color palette per domain | `.claude/project.md` → Color palette |
| Sidebar navigation | `src/components/layout/app-sidebar.tsx` |
| Open a confirm dialog | `useConfirm()` from `@/components/providers/confirm-provider` |
| Toast | `toast()` from `sonner` (provider in `root-provider.tsx`) |
| Register a keyboard shortcut | `useKeyboardShortcuts()` from `@/hooks/use-keyboard-shortcuts` or globally in `components/layout/global-shortcuts.tsx` |
| Auto-refresh a list | `useAutoRefresh()` from `@/hooks/use-auto-refresh` + `<AutoRefreshSelect />` |
| Keep filter/selection in URL | `useUrlState()` from `@/hooks/use-url-state` |
| Add a command palette entry | extend `src/components/layout/command-palette.tsx` |
