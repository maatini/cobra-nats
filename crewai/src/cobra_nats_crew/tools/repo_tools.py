"""Custom tools that stay inside the local cobra-nats checkout."""

from __future__ import annotations

from pathlib import Path

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from cobra_nats_crew.paths import OUTPUT_DIR, repo_root

SKIP_DIR_NAMES = {
    ".git",
    ".next",
    "node_modules",
    ".venv",
    "__pycache__",
    "coverage",
    "test-results",
    "playwright-report",
    "playwright",
    "dist",
    ".crewai",
}


class ListRepoTreeInput(BaseModel):
    relative_path: str = Field(
        default=".",
        description="Directory relative to the cobra-nats repo root.",
    )
    max_depth: int = Field(
        default=3,
        ge=1,
        le=8,
        description="How many directory levels to walk.",
    )
    max_entries: int = Field(
        default=400,
        ge=1,
        le=2000,
        description="Stop after this many listed paths.",
    )


class ListRepoTreeTool(BaseTool):
    name: str = "list_repo_tree"
    description: str = (
        "List files and directories in the local cobra-nats checkout. "
        "Use this before reading files so you know which paths exist. "
        "Skips node_modules, .git, .next, and similar generated folders."
    )
    args_schema: type[BaseModel] = ListRepoTreeInput

    def _run(
        self,
        relative_path: str = ".",
        max_depth: int = 3,
        max_entries: int = 400,
    ) -> str:
        root = repo_root()
        target = (root / relative_path).resolve()
        if not str(target).startswith(str(root)):
            return f"Refusing to list path outside repo root: {relative_path}"
        if not target.exists():
            return f"Path does not exist: {target}"
        if not target.is_dir():
            return f"Not a directory: {target}"

        listing = target.relative_to(root).as_posix() if target != root else "."
        lines: list[str] = [f"repo_root={root}", f"listing={listing}"]
        count = 0
        for path in sorted(target.rglob("*")):
            rel = path.relative_to(root)
            if any(part in SKIP_DIR_NAMES for part in rel.parts):
                continue
            depth = len(path.relative_to(target).parts)
            if depth > max_depth:
                continue
            suffix = "/" if path.is_dir() else ""
            lines.append(f"{rel.as_posix()}{suffix}")
            count += 1
            if count >= max_entries:
                lines.append(f"... truncated after {max_entries} entries")
                break
        if count == 0:
            lines.append("(empty)")
        return "\n".join(lines)


class WriteOutputInput(BaseModel):
    filename: str = Field(
        description="File name under crewai/output/, e.g. extra-notes.md. No directory traversal."
    )
    content: str = Field(description="Markdown content to write.")


class WriteOutputMarkdownTool(BaseTool):
    name: str = "write_output_markdown"
    description: str = (
        "Write a markdown file into crewai/output/. Use this for extra notes. "
        "Never write outside crewai/output/. Never commit, push, or open a pull request."
    )
    args_schema: type[BaseModel] = WriteOutputInput

    def _run(self, filename: str, content: str) -> str:
        name = Path(filename).name
        if not name.endswith((".md", ".txt", ".json")):
            return "Only .md, .txt, or .json files are allowed in output/."
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        target = (OUTPUT_DIR / name).resolve()
        if not str(target).startswith(str(OUTPUT_DIR.resolve())):
            return "Refusing to write outside crewai/output/."
        target.write_text(content, encoding="utf-8")
        return f"Wrote {target}"
