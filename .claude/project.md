# Cobra NATS – Project context

**Version**: 0.5.2
**Goal**: The fastest and most beautiful NATS/JetStream management UI.

## Features & routes

| Feature | Route | Feature folder | Short description |
|---|---|---|---|
| Dashboard | `/` | `features/dashboard/` | Server info, connection overview, quick stats (UI only, consumes actions from other features) |
| Streams | `/streams`, `/streams/[name]` | `features/streams/` | JetStream streams + consumers + message browser |
| KV | `/kv`, `/kv/[bucket]` | `features/kv/` | Key-Value buckets, browse keys, put/delete |
| Object Store | `/os`, `/os/[bucket]` | `features/os/` | OS buckets, upload/download/seal |
| Publish | `/publish` | `features/publish/` | Publish + request-reply |
| Monitor | `/monitor` | `features/monitor/` + `api/monitor` SSE | Live subject monitor (dedicated connection, `stream.ts` instead of `actions.ts`) |
| Settings | `/settings` | `features/connections/` | Manage connections |

## NATS conventions

The server automatically creates prefixed streams for KV and OS:

| NATS type | Stream prefix | Discovery |
|---|---|---|
| KV bucket `myBucket` | `KV_myBucket` | `listKVBuckets` filters streams on `KV_` |
| Object Store `myOs` | `OBJ_myOs` | `listOSBuckets` filters streams on `OBJ_` |

⚠️ **nats.js client bug workaround** in `features/os/actions.ts::createOSBucket`: `opts.replicas` has to be set non-enumerable, otherwise the field ends up unmapped in the raw stream config (and the server rejects it). Do not remove the code comment.

## Connection management

- **Store**: `src/features/connections/store.ts` (Zustand + `persist`, localStorage key `cobra-nats-storage`).
- **Active connection**: `useActiveConnection()` hook.
- **Auth types**: `none` | `user_pass` | `token`.
- **Singleton pool**: `natsManager` in `src/lib/nats/manager.ts` — holds NC, JSM, and JS per connection ID.
- **Monitor connection**: uses a **dedicated** connection (`monitor-${id}-${ts}`) so it does not collide with other operations.

## Color palette (design system)

| Domain | Tailwind color |
|---|---|
| General / Layout | `indigo` |
| Streams / Consumers | `amber` |
| Key-Value | `emerald` |
| Object Store | `cyan` |
| Destructive / Error | `red` (shadcn default) |

shadcn/ui **New York style** with Tailwind v4. Tailwind config lives in `globals.css` (v4 inline).

## App-wide UI features (since v0.5.0)

- **Command palette** (`components/layout/command-palette.tsx`) — Cmd/Ctrl+K opens quick navigation.
- **Global shortcuts** (`components/layout/global-shortcuts.tsx`) — central keyboard shortcut registration.
- **Auto-breadcrumbs** (`components/layout/auto-breadcrumbs.tsx`) — derived from the Next.js path.
- **Help dialog** (`components/layout/help-dialog.tsx`) — `?` shortcut lists active hotkeys.
- **No-connection banner** (`components/layout/no-connection-banner.tsx`) — shown when there is no active connection.
- **Theme toggle** (`components/layout/theme-toggle.tsx`) — light/dark via semantic color tokens.
- **Auto-refresh** (`hooks/use-auto-refresh.ts` + `components/ui/auto-refresh-select.tsx`) — configurable intervals for list views.
- **URL state** (`hooks/use-url-state.ts`) — synchronizes filters/selection with the URL.

## Tech versions (as of v0.5.2)

- Next.js **16.2.3** (App Router)
- React **19.2.5**
- TypeScript **^5** (strict)
- `nats` **^2.29.3**
- Tailwind **v4**
- `zustand` **^5.0.12**
- `@tanstack/react-query` **^5.97**, `@tanstack/react-table` **^8.21**
- `react-hook-form` **^7.72** + `zod` **^4.3.6** + `@hookform/resolvers` **^5**
- Playwright **^1.59**

## Development setup

- NATS server: `docker-compose up` (port 4222, monitor 8222)
- Dev: `npm run dev` (port 3000)
- Devbox: `devbox shell` (Node and NATS CLI preinstalled)

## External references

- NATS JetStream client docs: https://github.com/nats-io/nats.js
- shadcn/ui New York: https://ui.shadcn.com/docs
