"""Assemble CrewAI tools for local checkout analysis and optional GitHub search."""

from __future__ import annotations

import os
from typing import Any

from cobra_nats_crew.paths import repo_root, repo_url
from cobra_nats_crew.tools.command_tool import RunAllowedCommandTool
from cobra_nats_crew.tools.repo_tools import (
    GrepRepoTool,
    ListRepoTreeTool,
    ReadRepoFileTool,
    WriteOutputMarkdownTool,
)
from cobra_nats_crew.tools.write_tools import SearchReplaceRepoFileTool, WriteRepoFileTool


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

    root = repo_root().resolve()
    print(f"[cobra-nats-crew] File tools sandbox: {root}")
    tools: list[Any] = [
        ListRepoTreeTool(),
        ReadRepoFileTool(),
        GrepRepoTool(),
        FileReadTool(base_dir=str(root)),
        DirectoryReadTool(directory=str(root / "src") if (root / "src").is_dir() else str(root)),
        WriteOutputMarkdownTool(),
    ]

    # Semantic search needs OpenAI embeddings, not an OpenRouter-aliased key.
    search_root = str(root / "src") if (root / "src").is_dir() else str(root)
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    openai_only = bool(openai_key) and openai_key != openrouter_key
    search = None
    if openai_only:
        search = _safe_tool(
            lambda: DirectorySearchTool(directory=search_root),
            "DirectorySearchTool",
        )
    else:
        print(
            "[cobra-nats-crew] DirectorySearchTool skipped "
            "(needs a real OPENAI_API_KEY for embeddings)."
        )
    if search is not None:
        tools.append(search)

    github = build_github_search_tool()
    if github is not None:
        tools.append(github)

    return tools


def build_implement_tools() -> list[Any]:
    """Read, write, and allowlisted-command tools for implementation mode."""
    tools = build_agent_tools()
    tools.extend(
        [
            WriteRepoFileTool(),
            SearchReplaceRepoFileTool(),
            RunAllowedCommandTool(),
        ]
    )
    print("[cobra-nats-crew] Implementation tools enabled (write + allowlisted commands).")
    return tools
