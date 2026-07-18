# Architecture – Cobra NATS

**Owns**: “Where does what live?” + blueprints for common additions.  
**Does not own**: stack versions / feature catalog (→ `project.md`), code patterns (→ `rules.md`), deep ADRs (→ `docs/knowledge-base/`).

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

The client **never calls NATS directly**. It imports server actions (or hits a small set of API routes for SSE/large binaries); the server uses the singleton `natsManager` and returns serializable data.

**Exceptions to Server Actions** (intentional):

| Route | Why not an action |
|---|---|
| `POST /api/monitor` | Long-lived SSE stream (config in body) |
| `POST /api/os/upload` | Multipart binary; avoids RSC payload limits |

## Folder map (ownership)

| Path | Role | Agent |
|---|---|---|
| `src/app/(dashboard)/<route>/page.tsx` | Thin user pages | `@nextjs-frontend-agent` |
| `src/app/(dashboard)/layout.tsx` | Dashboard shell | `@nextjs-frontend-agent` |
| `src/app/api/monitor/route.ts` | SSE live monitor | `@server-actions-agent` |
| `src/app/api/os/upload/route.ts` | Multipart OS upload | `@server-actions-agent` |
| `src/features/<domain>/actions.ts` | Server actions per feature | `@server-actions-agent` |
| `src/features/<domain>/components/*.tsx` | Feature UI | `@nextjs-frontend-agent` (+ `@ui-shadcn-agent` for primitives) |
| `src/features/connections/store.ts` | Zustand + persist | `@nextjs-frontend-agent` |
| `src/features/connections/hooks.ts` | `useActiveConnection()` | `@nextjs-frontend-agent` |
| `src/features/dashboard/dashboard-overview.tsx` | Landing aggregation (no own actions) | `@nextjs-frontend-agent` |
| `src/features/monitor/{monitor-view.tsx,stream.ts}` | Live monitor UI + SSE stream builder | frontend / server-actions |
| `src/components/ui/*` | shadcn primitives (`shadcn add` only) | `@ui-shadcn-agent` |
| `src/components/layout/*` | App chrome | `@nextjs-frontend-agent` |
| `src/components/providers/*` | Root + confirm providers | `@nextjs-frontend-agent` |
| `src/hooks/*` | App-wide hooks | `@nextjs-frontend-agent` |
| `src/lib/nats/manager.ts` | Connection pool | `@nats-jetstream-expert` |
| `src/lib/server-action.ts` | Wrappers + `ActionResponse<T>` | `@server-actions-agent` |
| `src/types/nats.ts` | Shared domain types + enums | `@nats-jetstream-expert` |
| `tests/*.spec.ts` | Playwright E2E (flat) | `@playwright-testing-agent` |

## Blueprint: add a new feature

Example: **"Subjects"**.

1. **Types** (if new) → extend `src/types/nats.ts`.
2. **Folder** → `src/features/subjects/{actions.ts, components/}`.
3. **Action** → `actions.ts` with `"use server"` + `withNatsConnection` / `withJetStream` (pattern in `.claude/rules.md`).
4. **UI** → `src/features/subjects/components/…` using `useActiveConnection()`.
5. **Route** → `src/app/(dashboard)/subjects/page.tsx` (thin; render feature components).
6. **Sidebar** → `src/components/layout/app-sidebar.tsx`.
7. **Test** → `tests/subjects.spec.ts`.

Never create `src/app/actions/` — actions live per feature.

## Blueprint: add a new action to an existing feature

1. Open `src/features/<domain>/actions.ts`.
2. Append at the end (order: List → Create → Get → Mutate → Delete).
3. Do not split into extra action files for the same domain.
4. UI: new or extended component under `src/features/<domain>/components/`.

## Blueprint: new shadcn component

```bash
npx shadcn@latest add <component-name>
```

Lands in `src/components/ui/`. Prefer not to hand-edit generated files (overwritten on next `add`); project-wide variants only when necessary.

## Quick “where?” answers

| Question | Answer |
|---|---|
| Connection state / localStorage | `src/features/connections/store.ts` (key `cobra-nats-storage`) |
| Active connection | `useActiveConnection()` from `@/features/connections/hooks` |
| Error wrapping | `withJetStream` / `withNatsConnection` in `@/lib/server-action` |
| New auth type | `NatsConnectionConfig` in `types/nats.ts` + `connect-dialog.tsx` |
| Domain colors | `.claude/project.md` → Color palette |
| Sidebar | `src/components/layout/app-sidebar.tsx` |
| Confirm dialog | `useConfirm()` from `@/components/providers/confirm-provider` |
| Toast | `toast()` from `sonner` |
| Keyboard shortcut | `useKeyboardShortcuts()` or `global-shortcuts.tsx` |
| Auto-refresh | `useAutoRefresh()` + `<AutoRefreshSelect />` |
| URL filters | `useUrlState()` |
| Command palette entry | `command-palette.tsx` |
