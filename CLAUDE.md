# CLAUDE.md – Cobra NATS

**What**: Web UI for NATS/JetStream (Streams, Consumers, KV, Object Store, Publish/Request, Live Monitor).
**Stack**: Next.js 16 App Router · React 19 · TypeScript 5 strict · Tailwind v4 · shadcn/ui (New York) · Zustand · Playwright · `nats` v2.29.

## Project structure (short version)

```
src/
├── app/                    # Next.js routing + layouts. Nothing else goes here!
│   ├── (dashboard)/        # All user-facing pages (/, streams, kv, os, publish, monitor, settings)
│   └── api/monitor/        # The only REST endpoint (SSE for the live monitor)
│
├── features/               # Domain modules — EVERYTHING for one feature in ONE place
│   ├── connections/        # NATS connection store, hook, actions, connect dialog
│   ├── dashboard/          # Dashboard overview (component only, no actions)
│   ├── streams/            # Streams + consumers + stats (actions.ts is consolidated)
│   ├── kv/                 # Key-Value buckets
│   ├── os/                 # Object Store buckets + upload/download
│   ├── publish/            # Publish + request-reply actions
│   └── monitor/            # Live subject monitor (stream.ts instead of actions.ts, uses SSE)
│
├── components/
│   ├── ui/                 # shadcn primitives — NEVER edit directly, use `shadcn add`
│   ├── layout/             # app-sidebar, topbar, theme-toggle, auto-breadcrumbs,
│   │                       # command-palette, global-shortcuts, help-dialog,
│   │                       # no-connection-banner
│   └── providers/          # Root provider, confirm provider
│
├── lib/
│   ├── nats/manager.ts     # Singleton connection pool (NatsManager)
│   ├── server-action.ts    # withNatsConnection / withJetStream / ActionResponse
│   └── utils.ts            # cn() and generic helpers
│
├── hooks/                  # App-wide hooks
│   ├── use-mobile.ts
│   ├── use-keyboard-shortcuts.ts
│   ├── use-local-storage.ts
│   ├── use-auto-refresh.ts
│   └── use-url-state.ts
└── types/nats.ts           # All shared domain types (NatsConnectionConfig, StreamMessage, ...)
```

## Core rules (mandatory)

1. **All NATS operations go through Server Actions** in `src/features/<domain>/actions.ts`. Never ship credentials to the client.
2. **Every action uses `withNatsConnection` or `withJetStream`** from `@/lib/server-action` and returns `ActionResponse<T>`.
3. **Feature isolation**: UI, actions, store, and types for a feature live in `src/features/<domain>/`. No cross-feature imports without a reason.
4. **Types stay central**: domain types belong in `src/types/nats.ts`, not scattered per feature.
5. **Strict shadcn/ui**: new UI only with shadcn components (New York style). No custom button variants.
6. **TypeScript strict + Zod**: all forms use React Hook Form + a Zod schema.
7. **Playwright tests** for new features under `tests/`.

## Standard imports (cheat sheet)

```ts
import type { NatsConnectionConfig, StreamMessage } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";
import { useActiveConnection } from "@/features/connections/hooks";
import { useNatsStore } from "@/features/connections/store";
import { Button } from "@/components/ui/button";
```

## Further documentation

- **`.claude/architecture.md`** — "Where does what live?" + blueprint for adding a new feature
- **`.claude/project.md`** — Feature map, routes, color palette, NATS conventions
- **`.claude/rules.md`** — Do's & don'ts with code examples
- **`.claude/agents/*.md`** — Specialized agent profiles
