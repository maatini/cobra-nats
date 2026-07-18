# CLAUDE.md – Cobra NATS

**What**: Web UI for NATS/JetStream (Streams, Consumers, KV, Object Store, Publish/Request, Live Monitor).
**Stack**: Next.js 16 App Router · React 19 · TypeScript 6 strict · Tailwind v4 · shadcn/ui (New York) · Zustand · Playwright · `nats` v2.29.

## Layout (where code lives)

| Path | Role |
|---|---|
| `src/app/(dashboard)/` | Routes only — thin pages that render feature UI |
| `src/app/api/` | REST/SSE routes when Server Actions are insufficient (`monitor` SSE, `os/upload` multipart) |
| `src/features/<domain>/` | Domain module: `actions.ts` (or `stream.ts`), `components/`, optional store/hooks |
| `src/components/ui/` | shadcn primitives — add via CLI, do not hand-author replacements |
| `src/components/layout/` | App chrome (sidebar, topbar, command palette, shortcuts, …) |
| `src/lib/` | `nats/manager.ts` pool + `server-action.ts` wrappers |
| `src/types/nats.ts` | Shared domain types (keep NATS enums browser-safe) |
| `src/hooks/` | App-wide hooks |
| `tests/*.spec.ts` | Flat Playwright E2E |

Feature folders today: `connections`, `dashboard`, `streams`, `kv`, `os`, `publish`, `monitor`.

## Core rules (mandatory)

1. **All NATS ops on the server** — Server Actions in `src/features/<domain>/actions.ts` (or dedicated API routes for SSE/binary). Never ship credentials or import `nats` on the client.
2. **Wrappers always** — `withNatsConnection` / `withJetStream` from `@/lib/server-action`; return `ActionResponse<T>`. First arg is always `NatsConnectionConfig`.
3. **Feature isolation** — UI + actions for a domain live under `src/features/<domain>/`. No cross-feature imports without a reason.
4. **Types stay central** — domain types in `src/types/nats.ts`, not scattered per feature.
5. **shadcn/ui only** — New York style; new primitives via `npx shadcn@latest add …`. No custom Button/Input variants.
6. **Forms** — React Hook Form + Zod next to the component; English UI strings.
7. **Tests** — Playwright under `tests/*.spec.ts` (flat) for new user-facing features.

## Doc map (read by need)

| Doc | Owns |
|---|---|
| **`AGENTS.md`** | Grok Build entry: subagent routing, local commands (loaded with this file) |
| **`docs/knowledge-base/`** | **Primary deep reference** — architecture, data flows, ADRs, module ownership. Start at `index.md`. |
| `.claude/architecture.md` | “Where does what live?” + blueprints for new feature / action / shadcn component |
| `.claude/project.md` | Feature ↔ route map, NATS conventions, palette, localStorage key, dev setup |
| `.claude/rules.md` | How to work + mandatory code patterns (actions, client, forms, Playwright) |
| `.claude/agents/*.md` | Specialized personas (ownership + deltas only); mirrored for Grok via `.grok/agents/` symlinks |
| `.grok/rules/*.md` | Short auto-scanned pointers into the files above (no pattern dumps) |

Do **not** paste full patterns into this file — they live once in `.claude/rules.md`.
