# AGENTS.md – Cobra NATS (Grok Build)

**What**: Web UI for NATS/JetStream (Streams, Consumers, KV, Object Store, Publish/Request, Live Monitor).
**Stack**: Next.js 16 App Router · React 19 · TypeScript 6 strict · Tailwind v4 · shadcn/ui (New York) · Zustand · Playwright · `nats` v2.29.

## Mental model

```text
Client → Server Action | intentional API → withJetStream / withNatsConnection → NatsManager → NATS
```

**Never:** `nats` in the browser · secrets in query strings · actions outside `src/features/<domain>/`.

## Product rules (always on)

1. **All NATS ops on the server** — Server Actions in `src/features/<domain>/actions.ts` (or dedicated API routes for SSE/binary). Never ship credentials or import `nats` on the client.
2. **Wrappers always** — `withNatsConnection` / `withJetStream` from `@/lib/server-action`; return `ActionResponse<T>`. First arg is always `NatsConnectionConfig`. Wrappers validate that config with Zod at runtime.
3. **Feature isolation** — UI + actions for a domain live under `src/features/<domain>/`. No cross-feature imports without a reason.
4. **Types stay central** — domain types in `src/types/nats.ts`, not scattered per feature.
5. **shadcn/ui only** — New York style; new primitives via `npx shadcn@latest add …`. No custom Button/Input variants.
6. **Forms** — React Hook Form + Zod next to the component; English UI strings.
7. **Tests** — Playwright under `tests/*.spec.ts` (flat) for new user-facing features. Unit tests (`vitest`, `src/**/*.test.ts`) cover pool lifecycle, schemas, and URL policy.

## Subagent routing

| `subagent_type` | Use when | Do not use when |
|---|---|---|
| `nats-jetstream-expert` | JetStream semantics, pool, `types/nats.ts` | UI, tests, writing `actions.ts` |
| `server-actions-agent` | `actions.ts`, wrappers, `app/api/**`, monitor SSE | Feature React UI |
| `nextjs-frontend-agent` | Pages, feature components, layout, store/hooks | Primitives in `components/ui`, actions |
| `ui-shadcn-agent` | `npx shadcn add` / `components/ui/*` | Feature-specific components |
| `playwright-testing-agent` | `tests/*.spec.ts`, flaky E2E | Implementing product features |

Built-ins still apply: `explore`, `plan`, `general-purpose`.

## Depth docs (open on demand)

| Need | Open |
|---|---|
| Mandatory code patterns | `.claude/rules.md` |
| Where does X live? (folder map, blueprints) | `.claude/architecture.md` |
| Routes / NATS conventions / palette | `.claude/project.md` |
| Architecture, ADRs, modules | `docs/knowledge-base/` (start: `index.md`) |
| Persona body | `.claude/agents/<name>.md` (also linked from `.grok/agents/`) |

Auto-scanned Grok rule stubs: `.grok/rules/*.md` (pointers only — no pattern dumps).  
Context compaction: `.grok/rules/00-context-management.md` (and global `~/.grok/AGENTS.md`).

## Project skills (`.grok/skills/`)

| Skill | Use when |
|---|---|
| `cobra-new-feature` | New domain/feature end-to-end (types → actions → UI → route → E2E) |
| `cobra-new-action` | New or refactored Server Action / API boundary work |
| `cobra-e2e` | Playwright specs, seed key, flaky E2E against real NATS |
| `cobra-verify-prompts` | Prompt/agent docs drift vs live tree |

## Server boundary (do not regress)

NATS never runs in the browser. Default: Server Actions + wrappers. Exceptions:

- `POST /api/monitor` — SSE (connection config in body; no secrets in query)
- `POST /api/kv/watch` — SSE for long-lived KV updates (config and bucket in JSON body; dedicated connection; no secrets in query)
- `POST /api/os/upload` — multipart binary
- `POST /api/os/download` — streaming binary

## Local commands

```bash
npm run dev                          # UI :3000
docker compose up                    # NATS :4222 (or: devbox run nats:up / dev:full)
npx playwright test                  # or: devbox run test:e2e
node scripts/verify-prompt-docs.mjs  # prompt/agent docs vs live tree
```

Connection seed key for tests: `cobra-nats-storage`.
