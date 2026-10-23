# cobra-nats CrewAI crew

Analysis-only crew for [cobra-nats](https://github.com/maatini/cobra-nats): architecture, docs, Playwright coverage, performance, and roadmap planning.

The crew **does not** commit, push, or open pull requests. The default analysis
run writes markdown into `crewai/output/`. Implementation mode
(`mise run crew:implement`) may also edit application source; git writes stay
off.

## What it does

| Agent | Focus |
|-------|--------|
| `repo_analyst` | Next.js / NATS architecture, `NatsManager`, Server Actions, `src/features/` |
| `docs_writer` | README, ADRs, knowledge-base and inline docs |
| `test_engineer` | Playwright gaps (Streams, KV, Object Store, Monitor, errors) |
| `performance_optimizer` | Bundle, rendering, connection pool, Docker, memory |
| `feature_planner` | Live charts, cluster topology, multi-tab comparison |
| `manager` | Hierarchical coordination + consolidated report |

Default process is `Process.hierarchical` (set `CREW_PROCESS=sequential` to fall back). Memory and planning are on unless you disable them.

The crew works against the **local checkout** (file tools sandboxed to `REPO_PATH`, default: parent of `crewai/`) and, when `GITHUB_TOKEN` is set, the **remote repo** (`GithubSearchTool`). Use `read_repo_file` with paths like `src/lib/nats/manager.ts`.

## Setup

From the cobra-nats repo root (mise recommended):

```bash
mise install
eval "$(mise activate zsh)"   # once per shell; or: mise activate
mise run setup
```

Python-only (inside `crewai/`):

```bash
cd crewai
uv sync --all-extras
cp .env.example .env          # then fill in keys
```

Python **≥ 3.10 and < 3.14** is required (CrewAI). mise pins 3.12.

## Configure

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` ([openrouter.ai/keys](https://openrouter.ai/keys)):

```bash
cp crewai/.env.example crewai/.env
```

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Default LLM via [OpenRouter](https://openrouter.ai) |
| `OPENROUTER_API_BASE` | `https://openrouter.ai/api/v1` |
| `MODEL` | LiteLLM id, e.g. `openrouter/openai/gpt-4o` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / … | Direct providers (optional) |
| `GITHUB_TOKEN` | Enables `GithubSearchTool` against `GITHUB_REPO` |
| `REPO_PATH` | Checkout the file tools may read (defaults to parent of `crewai/`) |
| `CREW_PROCESS` | `hierarchical` (default) or `sequential` |
| `CREW_MEMORY` / `CREW_PLANNING` | `true` / `false` |

Memory uses OpenAI embeddings. Leave `CREW_MEMORY=false` on OpenRouter-only setups.

Do not set `OPENAI_API_KEY` for OpenRouter. The crew points CrewAI's leftover OpenAI defaults (planning agent) at OpenRouter automatically.

## Run

From the repo root:

```bash
mise run crew:check              # syntax / wiring, no LLM
mise run crew                    # analysis run (needs API keys)
mise run crew:implement-check    # implementation crew wiring
mise run crew:implement          # apply ranked actions 1, 3–10 (skip 2)
```

From `crewai/`:

```bash
uv run python -m cobra_nats_crew.main --check
uv run python -m cobra_nats_crew.main
```

Outputs:

| File | Source |
|------|--------|
| `output/00-consolidated-report.md` | Manager |
| `output/01-architecture.md` | Architect |
| `output/02-documentation.md` | Writer |
| `output/03-tests.md` | QA |
| `output/04-performance.md` | Performance |
| `output/05-feature-plan.md` | Tech lead |
| `output/run-*.md` | Combined kickoff log |

`output/` is gitignored except `.gitkeep`.
