"""Assemble CrewAI tools for local checkout analysis and optional GitHub search."""

from __future__ import annotations

import os
from typing import Any

from cobra_nats_crew.paths import repo_root, repo_url
from cobra_nats_crew.tools.repo_tools import ListRepoTreeTool, WriteOutputMarkdownTool


def _safe_tool(factory, label: str) -> Any | None:
    try:
        return factory()
    except Exception as exc:  # noqa: BLE001 — tools may need extra deps/keys
        print(f"[cobra-nats-crew] Skipping {label}: {exc}")
        return None


def build_github_search_tool() -> Any | None:
    """GithubSearchTool talks to the remote repo. Needs GITHUB_TOKEN."""
    token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    if not token:
        print("[cobra-nats-crew] GITHUB_TOKEN unset — GithubSearchTool disabled.")
        return None

    try:
        from crewai_tools import GithubSearchTool
    except ImportError as exc:
        print(f"[cobra-nats-crew] crewai_tools.GithubSearchTool unavailable: {exc}")
        return None

    return _safe_tool(
        lambda: GithubSearchTool(
            github_repo=repo_url(),
            gh_token=token,
            content_types=["code", "issue", "pr"],
        ),
        "GithubSearchTool",
    )


def build_agent_tools() -> list[Any]:
    """File tools for the local checkout plus optional GitHub search."""
    from crewai_tools import DirectoryReadTool, DirectorySearchTool, FileReadTool

    root = repo_root()
    tools: list[Any] = [
        ListRepoTreeTool(),
        FileReadTool(),
        DirectoryReadTool(directory=str(root)),
        WriteOutputMarkdownTool(),
    ]

    # Semantic search over application source only (skip node_modules / .next).
    search_root = str(root / "src") if (root / "src").is_dir() else str(root)
    search = _safe_tool(
        lambda: DirectorySearchTool(directory=search_root),
        "DirectorySearchTool",
    )
    if search is not None:
        tools.append(search)

    github = build_github_search_tool()
    if github is not None:
        tools.append(github)

    return tools
