# AGENTS.md – Cobra NATS (Grok Build)

Grok-native project entry. **Product rules** (stack, layout, hard coding laws) live in `CLAUDE.md` and are loaded with this file — do not restate them here.

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
| Where does X live? | `.claude/architecture.md` |
| Routes / NATS conventions / palette | `.claude/project.md` |
| Architecture, ADRs, modules | `docs/knowledge-base/` (start: `index.md`) |
| Persona body | `.claude/agents/<name>.md` (also linked from `.grok/agents/`) |

Auto-scanned Grok rule stubs: `.grok/rules/*.md` (pointers only — no pattern dumps).

## Server boundary (do not regress)

NATS never runs in the browser. Default: Server Actions + wrappers. Exceptions:

- `GET /api/monitor` — SSE
- `POST /api/os/upload` — multipart binary

## Local commands

```bash
npm run dev                          # UI :3000
docker compose up                    # NATS :4222 (or: devbox run nats:up / dev:full)
npx playwright test                  # or: devbox run test:e2e
node scripts/verify-prompt-docs.mjs  # prompt/agent docs vs live tree
```

Connection seed key for tests: `cobra-nats-storage`.
