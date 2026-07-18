# Cobra NATS – Project context

**Owns**: product map (features, routes, NATS conventions, palette, setup).  
**Does not own**: code patterns (→ `rules.md`), folder ownership (→ `architecture.md`).

**Version**: 0.5.2 (see `package.json`)  
**Goal**: The fastest and most beautiful NATS/JetStream management UI.

## Features & routes

| Feature | Route | Feature folder | Short description |
|---|---|---|---|
| Dashboard | `/` | `features/dashboard/` | Server info, overview, quick stats (UI only; reuses other features’ actions) |
| Streams | `/streams`, `/streams/[name]` | `features/streams/` | JetStream streams + consumers + message browser |
| KV | `/kv`, `/kv/[bucket]` | `features/kv/` | Key-Value buckets, browse keys, put/delete |
| Object Store | `/os`, `/os/[bucket]` | `features/os/` | OS buckets; upload via `POST /api/os/upload`, download via `POST /api/os/download`, seal via actions |
| Publish | `/publish` | `features/publish/` | Publish + request-reply |
| Monitor | `/monitor` | `features/monitor/` + `api/monitor` SSE | Live subject monitor (`stream.ts`, dedicated connection) |
| Settings | `/settings` | `features/connections/` | Manage connections |

## NATS conventions

The server creates prefixed streams for KV and OS:

| NATS type | Stream prefix | Discovery |
|---|---|---|
| KV bucket `myBucket` | `KV_myBucket` | `listKVBuckets` filters streams on `KV_` |
| Object Store `myOs` | `OBJ_myOs` | `listOSBuckets` filters streams on `OBJ_` |

⚠️ **nats.js client bug workaround** in `features/os/actions.ts::createOSBucket`: `opts.replicas` must be set non-enumerable, otherwise the field ends up unmapped in the raw stream config and the server rejects it. Do not remove the code comment. (`@tag:os-replicas-bug`)

## Connection management

- **Store**: `src/features/connections/store.ts` (Zustand + `persist`, localStorage key **`cobra-nats-storage`** / `CONNECTIONS_STORAGE_KEY`).
- **Active connection**: `useActiveConnection()` hook.
- **Auth types**: `none` | `user_pass` | `token`.
- **Singleton pool**: `natsManager` in `src/lib/nats/manager.ts` — NC, JSM, and JS per connection ID.
- **Monitor connection**: dedicated ID `monitor-${id}-${ts}` so it does not collide with other ops.

## Color palette (design system)

| Domain | Tailwind color |
|---|---|
| General / Layout | `indigo` |
| Streams / Consumers | `amber` |
| Key-Value | `emerald` |
| Object Store | `cyan` |
| Destructive / Error | `red` (shadcn default) |

shadcn/ui **New York** + Tailwind v4 (tokens in `src/app/globals.css`).

## App-wide UI features

- **Command palette** — `components/layout/command-palette.tsx` (Cmd/Ctrl+K)
- **Global shortcuts** — `components/layout/global-shortcuts.tsx`
- **Auto-breadcrumbs** — `components/layout/auto-breadcrumbs.tsx`
- **Help dialog** — `components/layout/help-dialog.tsx` (`?`)
- **No-connection banner** — `components/layout/no-connection-banner.tsx`
- **Theme toggle** — `components/layout/theme-toggle.tsx`
- **Auto-refresh** — `hooks/use-auto-refresh.ts` + `components/ui/auto-refresh-select.tsx`
- **URL state** — `hooks/use-url-state.ts`

## Tech stack (majors — truth is `package.json`)

| Area | Major / pin |
|---|---|
| Next.js | 16 (App Router) |
| React | 19 |
| TypeScript | 6 (strict) |
| `nats` | 2.29 |
| Tailwind | 4 |
| Zustand | 5 |
| TanStack Query / Table | 5 / 8 |
| RHF + Zod | 7 / 4 |
| Playwright | 1.6x |
| shadcn CLI | 4 |
| Sonner / cmdk | 2 / 1 |

## Development setup

- NATS: `docker-compose up` or `devbox run nats:up` (port **4222**, HTTP monitor **8222**)
- UI: `npm run dev` (port **3000**)
- Devbox: `devbox shell` — scripts: `dev:full`, `test:e2e`, `test:e2e:headed`
- E2E expects a real NATS server; connection seed key is `cobra-nats-storage` (see Playwright agent / `rules.md`)

## External references

- NATS JetStream client: https://github.com/nats-io/nats.js
- shadcn/ui New York: https://ui.shadcn.com/docs
