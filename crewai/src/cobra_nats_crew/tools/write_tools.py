"""Write and patch tools confined to the cobra-nats checkout.

Never writes secrets, git metadata, or the crew Python package.
Never commits or pushes.
"""

from __future__ import annotations

from pathlib import Path

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from cobra_nats_crew.tools.repo_tools import SKIP_DIR_NAMES, resolve_inside_repo
from cobra_nats_crew.paths import repo_root

_MAX_WRITE_CHARS = 250_000

_PROTECTED_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    "uv.lock",
}

_CREW_WRITE_ALLOW = ("output", "knowledge")


def _deny_write(target: Path) -> str | None:
    root = repo_root().resolve()
    rel = target.relative_to(root)
    parts = rel.parts
    name = target.name

    if name in _PROTECTED_NAMES or name.startswith(".env") and name != ".env.example":
        return f"Refusing to write secret/env file: {rel.as_posix()}"
    if name == ".git" or ".git" in parts:
        return f"Refusing to write git metadata: {rel.as_posix()}"
    if any(p in SKIP_DIR_NAMES for p in parts):
        return f"Refusing to write generated/vendor path: {rel.as_posix()}"
    if parts and parts[0] == "crewai":
        if len(parts) >= 2 and parts[1] in _CREW_WRITE_ALLOW:
            return None
        return (
            f"Refusing to modify the crew package ({rel.as_posix()}). "
            "Write reports under crewai/output/ or notes under crewai/knowledge/."
        )
    if parts and parts[0] == "Volumes":
        return (
            f"Refusing nested Volumes/ path ({rel.as_posix()}). "
            "Pass a repo-relative path (src/..., tests/..., crewai/output/...) "
            "or an absolute path that already starts with the repo root."
        )
    return None


class WriteRepoFileInput(BaseModel):
    relative_path: str = Field(
        description="Path relative to the cobra-nats repo root, e.g. src/lib/nats/manager.ts",
    )
    content: str = Field(description="Full UTF-8 file contents to write.")


class WriteRepoFileTool(BaseTool):
    name: str = "write_repo_file"
    description: str = (
        "Create or overwrite a text file inside the cobra-nats checkout. "
        "Pass the COMPLETE file contents. Prefer search_replace_repo_file for "
        "small edits. Never write .env, .git, node_modules, or crewai/src. "
        "Never commit or push."
    )
    args_schema: type[BaseModel] = WriteRepoFileInput

    def _run(self, relative_path: str, content: str) -> str:
        if len(content) > _MAX_WRITE_CHARS:
            return f"Content too large ({len(content)} chars; max {_MAX_WRITE_CHARS})."
        target = resolve_inside_repo(relative_path)
        if isinstance(target, str):
            return target
        denied = _deny_write(target)
        if denied:
            return denied
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        except OSError as exc:
            return f"Failed to write {relative_path}: {exc}"
        rel = target.relative_to(repo_root().resolve()).as_posix()
        return f"Wrote {rel} ({len(content)} chars, {content.count(chr(10)) + 1} lines)."


class SearchReplaceRepoInput(BaseModel):
    relative_path: str = Field(description="Path relative to the repo root.")
    old_string: str = Field(description="Exact text to find. Must match uniquely unless replace_all.")
    new_string: str = Field(description="Replacement text.")
    replace_all: bool = Field(default=False, description="Replace every occurrence.")


class SearchReplaceRepoFileTool(BaseTool):
    name: str = "search_replace_repo_file"
    description: str = (
        "Surgically replace exact text in a checkout file. "
        "old_string must match uniquely unless replace_all is true. "
        "Prefer this over rewriting whole files."
    )
    args_schema: type[BaseModel] = SearchReplaceRepoInput

    def _run(
        self,
        relative_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> str:
        if old_string == new_string:
            return "old_string and new_string are identical; nothing to do."
        target = resolve_inside_repo(relative_path)
        if isinstance(target, str):
            return target
        denied = _deny_write(target)
        if denied:
            return denied
        if not target.is_file():
            return f"File not found: {relative_path}"
        try:
            text = target.read_text(encoding="utf-8")
        except OSError as exc:
            return f"Failed to read {relative_path}: {exc}"
        count = text.count(old_string)
        if count == 0:
            return (
                f"old_string not found in {relative_path}. "
                "Read the file again and copy the exact substring."
            )
        if count > 1 and not replace_all:
            return (
                f"old_string matched {count} times in {relative_path}. "
                "Pass a larger unique snippet or set replace_all=true."
            )
        updated = text.replace(old_string, new_string) if replace_all else text.replace(old_string, new_string, 1)
        try:
            target.write_text(updated, encoding="utf-8")
        except OSError as exc:
            return f"Failed to write {relative_path}: {exc}"
        n = count if replace_all else 1
        rel = target.relative_to(repo_root().resolve()).as_posix()
        return f"Updated {rel} ({n} replacement{'s' if n != 1 else ''})."
