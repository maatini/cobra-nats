"""Custom tools that stay inside the local cobra-nats checkout."""

from __future__ import annotations

import re
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

_MAX_FILE_CHARS = 80_000


def resolve_inside_repo(relative_or_absolute: str) -> Path | str:
    """Resolve a path inside the cobra-nats checkout. Returns an error string on failure."""
    root = repo_root().resolve()
    raw = Path(relative_or_absolute).expanduser()
    target = raw.resolve() if raw.is_absolute() else (root / raw).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        return f"Refusing path outside repo root ({root}): {relative_or_absolute}"
    return target


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
        root = repo_root().resolve()
        target = resolve_inside_repo(relative_path)
        if isinstance(target, str):
            return target
        if not target.exists():
            return f"Path does not exist: {target.relative_to(root)}"
        if not target.is_dir():
            return f"Not a directory: {target.relative_to(root)}"

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


class ReadRepoFileInput(BaseModel):
    relative_path: str = Field(
        description=(
            "Path relative to the cobra-nats repo root, e.g. "
            "README.md or src/lib/nats/manager.ts. Absolute paths inside "
            "the repo are also accepted."
        ),
    )
    start_line: int = Field(
        default=1,
        ge=1,
        description="1-indexed line to start reading from.",
    )
    line_count: int | None = Field(
        default=None,
        description="Max lines to return. Omit to read until the size cap.",
    )


class ReadRepoFileTool(BaseTool):
    name: str = "read_repo_file"
    description: str = (
        "Read a text file from the cobra-nats checkout. "
        "Prefer this over the generic file-read tool. "
        "Pass a path relative to the repo root "
        "(README.md, CLAUDE.md, src/lib/nats/manager.ts, tests/helpers.ts). "
        "Use start_line and line_count for large files. "
        "Never invent file contents — if this tool errors, say so."
    )
    args_schema: type[BaseModel] = ReadRepoFileInput

    def _run(
        self,
        relative_path: str,
        start_line: int = 1,
        line_count: int | None = None,
    ) -> str:
        root = repo_root().resolve()
        target = resolve_inside_repo(relative_path)
        if isinstance(target, str):
            return target
        if not target.exists():
            return f"File not found: {relative_path} (repo_root={root})"
        if not target.is_file():
            return f"Not a file: {relative_path}"
        try:
            text = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return f"Not a UTF-8 text file: {relative_path}"
        except OSError as exc:
            return f"Failed to read {relative_path}: {exc}"

        lines = text.splitlines(keepends=True)
        start_idx = max(start_line - 1, 0)
        if start_idx >= len(lines):
            return f"Start line {start_line} exceeds {len(lines)} lines in {relative_path}."
        stop_idx = None if line_count is None else start_idx + line_count
        chunk = "".join(lines[start_idx:stop_idx])
        if len(chunk) > _MAX_FILE_CHARS:
            chunk = chunk[:_MAX_FILE_CHARS]
            chunk += (
                f"\n\n... truncated at {_MAX_FILE_CHARS} characters. "
                f"Re-call read_repo_file with start_line={start_line + 200} "
                f"and line_count to continue."
            )
        rel = target.relative_to(root).as_posix()
        header = f"# file: {rel} (lines {start_line}+, {len(lines)} total)\n"
        return header + chunk


class GrepRepoInput(BaseModel):
    pattern: str = Field(description="Python regular expression to search for.")
    relative_path: str = Field(
        default=".",
        description="Directory or file relative to the repo root.",
    )
    glob: str = Field(
        default="*.{ts,tsx,js,jsx,md,json,yml,yaml}",
        description="fnmatch filter applied to file names, e.g. *.ts or *.md.",
    )
    max_matches: int = Field(default=40, ge=1, le=200)


class GrepRepoTool(BaseTool):
    name: str = "grep_repo"
    description: str = (
        "Search file contents in the cobra-nats checkout with a regular "
        "expression. Skips node_modules, .git, and .next. "
        "Use this when DirectorySearchTool is unavailable."
    )
    args_schema: type[BaseModel] = GrepRepoInput

    def _run(
        self,
        pattern: str,
        relative_path: str = ".",
        glob: str = "*.{ts,tsx,js,jsx,md,json,yml,yaml}",
        max_matches: int = 40,
    ) -> str:
        root = repo_root().resolve()
        target = resolve_inside_repo(relative_path)
        if isinstance(target, str):
            return target
        if not target.exists():
            return f"Path does not exist: {relative_path}"

        try:
            compiled = re.compile(pattern)
        except re.error as exc:
            return f"Invalid regex: {exc}"

        files: list[Path]
        if target.is_file():
            files = [target]
        else:
            files = [p for p in target.rglob("*") if p.is_file()]

        hits: list[str] = []
        scanned = 0
        for path in files:
            rel = path.relative_to(root)
            if any(part in SKIP_DIR_NAMES for part in rel.parts):
                continue
            if not (
                _matches_glob(path.name, glob) or _matches_glob(rel.as_posix(), glob)
            ):
                continue
            scanned += 1
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            for idx, line in enumerate(text.splitlines(), start=1):
                if compiled.search(line):
                    snippet = line.strip()
                    if len(snippet) > 240:
                        snippet = snippet[:240] + "…"
                    hits.append(f"{rel.as_posix()}:{idx}: {snippet}")
                    if len(hits) >= max_matches:
                        hits.append(f"... truncated after {max_matches} matches ({scanned} files scanned)")
                        return "\n".join(hits)
        if not hits:
            return f"No matches for {pattern!r} under {relative_path} (scanned {scanned} files)."
        return "\n".join(hits)


def _matches_glob(name: str, glob: str) -> bool:
    import fnmatch

    if "{" in glob and "}" in glob:
        prefix, rest = glob.split("{", 1)
        inner, suffix = rest.split("}", 1)
        return any(fnmatch.fnmatch(name, f"{prefix}{alt}{suffix}") for alt in inner.split(","))
    return fnmatch.fnmatch(name, glob)


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
