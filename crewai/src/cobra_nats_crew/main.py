"""Entry point: kick off the cobra-nats crew or validate configuration."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from cobra_nats_crew.paths import CREW_ROOT, OUTPUT_DIR, ensure_output_dir, repo_root, repo_url

ROADMAP_ITEMS = (
    "Live dashboard charts / time series; "
    "NATS Cluster topology view; "
    "Multi-tab message comparison"
)


def _load_env() -> None:
    load_dotenv(CREW_ROOT / ".env")
    load_dotenv(repo_root() / ".env", override=False)


def default_inputs() -> dict[str, str]:
    return {
        "repo_path": str(repo_root()),
        "repo_url": repo_url(),
        "current_version": os.getenv("COBRA_NATS_VERSION", "0.6.0"),
        "roadmap_items": ROADMAP_ITEMS,
    }


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


def check() -> int:
    """Load YAML, build the crew, and exit without calling an LLM."""
    _load_env()
    os.environ["CREW_CHECK"] = "true"
    os.environ.setdefault("CREW_MEMORY", "false")
    os.environ.setdefault("CREW_PLANNING", "false")

    from cobra_nats_crew.crew import CobraNatsCrew

    crew_app = CobraNatsCrew()
    built = crew_app.crew()
    agent_roles = [agent.role.strip().split("\n")[0] for agent in built.agents]
    task_names = [getattr(task, "name", None) or task.description[:48] for task in built.tasks]

    print("cobra-nats crew check OK")
    print(f"  crew root : {CREW_ROOT}")
    print(f"  repo root : {repo_root()}")
    print(f"  repo url  : {repo_url()}")
    print(f"  process   : {built.process}")
    print(f"  agents    : {len(built.agents)}")
    for role in agent_roles:
        print(f"    - {role}")
    print(f"  tasks     : {len(built.tasks)}")
    for name in task_names:
        print(f"    - {name}")
    print(f"  tools     : {len(crew_app.tools())}")
    for tool in crew_app.tools():
        print(f"    - {getattr(tool, 'name', type(tool).__name__)}")
    return 0


def run() -> int:
    _load_env()
    ensure_output_dir()
    os.chdir(CREW_ROOT)

    if not os.getenv("OPENAI_API_KEY") and not os.getenv("MODEL"):
        print(
            "Set OPENAI_API_KEY (or MODEL plus the matching provider key) in crewai/.env. "
            "See crewai/.env.example.",
            file=sys.stderr,
        )
        return 2

    from cobra_nats_crew.crew import CobraNatsCrew

    inputs = default_inputs()
    print(f"Starting cobra-nats crew against {inputs['repo_path']} ({inputs['repo_url']})")
    result = CobraNatsCrew().crew().kickoff(inputs=inputs)

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
        description="Run the cobra-nats CrewAI development crew (analysis only)."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate config and imports without calling an LLM.",
    )
    args = parser.parse_args(argv)
    code = check() if args.check else run()
    raise SystemExit(code)


if __name__ == "__main__":
    main()
