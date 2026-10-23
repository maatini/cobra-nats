# cobra-nats CrewAI crew

Analysis-only crew for [cobra-nats](https://github.com/maatini/cobra-nats): architecture, docs, Playwright coverage, performance, and roadmap planning.

The crew **does not** commit, push, or open pull requests. It writes markdown into `crewai/output/`.

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

The crew works against the **local checkout** (file tools) and, when `GITHUB_TOKEN` is set, the **remote repo** (`GithubSearchTool`).

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

Copy `.env.example` to `.env` and set at least one LLM key:

```bash
cp crewai/.env.example crewai/.env
```

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Default LLM |
| `MODEL` | LiteLLM id (`anthropic/…`, `groq/…`, `ollama/…`) |
| `GITHUB_TOKEN` | Enables `GithubSearchTool` against `GITHUB_REPO` |
| `REPO_PATH` | Override local checkout (defaults to repo root) |
| `CREW_PROCESS` | `hierarchical` (default) or `sequential` |
| `CREW_MEMORY` / `CREW_PLANNING` | `true` / `false` |

Memory uses OpenAI embeddings by default. If you only have a non-OpenAI LLM, set `CREW_MEMORY=false`.

## Run

From the repo root:

```bash
mise run crew:check    # syntax / wiring, no LLM
mise run crew          # full run (needs API keys)
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
