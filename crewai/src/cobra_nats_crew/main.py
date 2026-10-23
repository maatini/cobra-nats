"""Entry point: kick off the cobra-nats crew or validate configuration."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from cobra_nats_crew.llm import apply_llm_env, describe_llm, model_name, using_openrouter
from cobra_nats_crew.paths import CREW_ROOT, OUTPUT_DIR, ensure_output_dir, repo_root, repo_url

ROADMAP_ITEMS = (
    "Live dashboard charts / time series; "
    "NATS Cluster topology view; "
    "Multi-tab message comparison"
)


def _load_env() -> None:
    load_dotenv(CREW_ROOT / ".env")
    load_dotenv(repo_root() / ".env", override=False)
    apply_llm_env()


def default_inputs(*, implement: bool = False, product: bool = False) -> dict[str, str]:
    inputs = {
        "repo_path": str(repo_root()),
        "repo_url": repo_url(),
        "current_version": os.getenv("COBRA_NATS_VERSION", "0.7.0"),
        "roadmap_items": ROADMAP_ITEMS,
        "skip_item": "2",
        "brief_path": "crewai/knowledge/project_brief.md",
    }
    if implement:
        inputs["mode"] = "implement"
        inputs["brief_path"] = "crewai/knowledge/implement_brief.md"
    if product:
        inputs["mode"] = "product"
        inputs["brief_path"] = "crewai/knowledge/product_hygiene_brief.md"
    return inputs


def _write_run_summary(raw: str, task_outputs: list[str]) -> Path:
    ensure_output_dir()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = OUTPUT_DIR / f"run-{stamp}.md"
    parts = [
        f"# cobra-nats crew run ({stamp})",
        "",
        f"- repo_path: `{repo_root()}`",
        f"- repo_url: `{repo_url()}`",
        f"- process: `{os.getenv('CREW_PROCESS', 'hierarchical')}`",
        "",
        "## Final output",
        "",
        raw.strip() or "_empty_",
        "",
    ]
    if task_outputs:
        parts.extend(["## Task outputs", ""])
        for item in task_outputs:
            parts.append(item)
            parts.append("")
    path.write_text("\n".join(parts), encoding="utf-8")
    return path


def _print_check(label: str, crew_app: object, built: object) -> None:
    agents = getattr(built, "agents", [])
    tasks = getattr(built, "tasks", [])
    agent_roles = [agent.role.strip().split("\n")[0] for agent in agents]
    task_names = [getattr(task, "name", None) or task.description[:48] for task in tasks]
    tools_fn = getattr(crew_app, "tools", lambda: [])
    tools = tools_fn()

    print(f"cobra-nats crew check OK ({label})")
    print(f"  crew root : {CREW_ROOT}")
    print(f"  repo root : {repo_root()}")
    print(f"  repo url  : {repo_url()}")
    print(f"  process   : {getattr(built, 'process', '?')}")
    print(f"  agents    : {len(agents)}")
    for role in agent_roles:
        print(f"    - {role}")
    print(f"  tasks     : {len(tasks)}")
    for name in task_names:
        print(f"    - {name}")
    print(f"  tools     : {len(tools)}")
    for tool in tools:
        print(f"    - {getattr(tool, 'name', type(tool).__name__)}")


def check(*, implement: bool = False, product: bool = False) -> int:
    """Load YAML, build the crew, and exit without calling an LLM."""
    _load_env()
    os.environ["CREW_CHECK"] = "true"
    os.environ.setdefault("CREW_MEMORY", "false")
    os.environ.setdefault("CREW_PLANNING", "false")

    if product:
        from cobra_nats_crew.product_crew import CobraNatsProductCrew

        crew_app = CobraNatsProductCrew()
        _print_check("product", crew_app, crew_app.crew())
        return 0

    if implement:
        from cobra_nats_crew.implement_crew import CobraNatsImplementCrew

        crew_app = CobraNatsImplementCrew()
        _print_check("implement", crew_app, crew_app.crew())
        return 0

    from cobra_nats_crew.crew import CobraNatsCrew

    crew_app = CobraNatsCrew()
    _print_check("analyze", crew_app, crew_app.crew())
    return 0


def run(*, implement: bool = False, product: bool = False) -> int:
    _load_env()
    ensure_output_dir()
    # FileReadTool / DirectoryReadTool sandbox against cwd unless base_dir is set.
    # Work from the cobra-nats checkout so relative paths like README.md resolve.
    os.chdir(repo_root())

    has_llm_key = any(
        os.getenv(name, "").strip()
        for name in (
            "OPENROUTER_API_KEY",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "GROQ_API_KEY",
        )
    )
    if not has_llm_key:
        print(
            "Set OPENROUTER_API_KEY in crewai/.env (or another provider key). "
            "See crewai/.env.example.",
            file=sys.stderr,
        )
        return 2

    if product:
        from cobra_nats_crew.product_crew import CobraNatsProductCrew

        crew_app = CobraNatsProductCrew()
        mode = "product (hygiene + visible features; skip credential trust)"
    elif implement:
        from cobra_nats_crew.implement_crew import CobraNatsImplementCrew

        crew_app = CobraNatsImplementCrew()
        mode = "implement (actions 1,3-10; skip 2)"
    else:
        from cobra_nats_crew.crew import CobraNatsCrew

        crew_app = CobraNatsCrew()
        mode = "analyze"

    inputs = default_inputs(implement=implement, product=product)
    provider = "openrouter" if using_openrouter() else "llm"
    print(
        f"Starting cobra-nats crew [{mode}] against {inputs['repo_path']} ({inputs['repo_url']})"
    )
    print(f"cwd: {Path.cwd()}")
    print(f"LLM: {describe_llm()} ({provider}, model={model_name()})")
    if implement or product:
        print("Skip: credential trust model. No git commit/push/PR.")
    result = crew_app.crew().kickoff(inputs=inputs)

    raw = getattr(result, "raw", None) or str(result)
    extras: list[str] = []
    for task_output in getattr(result, "tasks_output", []) or []:
        name = getattr(task_output, "name", None) or "task"
        summary = (getattr(task_output, "raw", None) or str(task_output)).strip()
        extras.append(f"### {name}\n\n{summary}")

    summary_path = _write_run_summary(raw, extras)
    print(f"Wrote {summary_path}")
    print(f"Per-task markdown also lands in {OUTPUT_DIR} via each task output_file.")
    return 0


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Run the cobra-nats CrewAI development crew."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate config and imports without calling an LLM.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--implement",
        action="store_true",
        help="Run the implementation crew (actions 1, 3–10; skip 2). Writes source, never git commit/push.",
    )
    mode.add_argument(
        "--product",
        action="store_true",
        help=(
            "Run the product+hygiene crew (visible features and maintenance). "
            "Writes source, never git commit/push."
        ),
    )
    args = parser.parse_args(argv)
    code = (
        check(implement=args.implement, product=args.product)
        if args.check
        else run(implement=args.implement, product=args.product)
    )
    raise SystemExit(code)


if __name__ == "__main__":
    main()
