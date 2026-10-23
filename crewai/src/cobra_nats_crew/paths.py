"""Resolve the crew package, crewai/ project, and cobra-nats checkout roots."""

from __future__ import annotations

import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent


def _discover_crew_root() -> Path:
    """Prefer the in-repo crewai/ folder even if the package is installed."""
    for candidate in (PACKAGE_DIR, *PACKAGE_DIR.parents):
        marker = candidate / "pyproject.toml"
        if marker.exists() and (candidate / "src" / "cobra_nats_crew").is_dir():
            return candidate
    return PACKAGE_DIR.parents[1]


CREW_ROOT = _discover_crew_root()
REPO_ROOT = CREW_ROOT.parent
OUTPUT_DIR = CREW_ROOT / "output"
CONFIG_DIR = PACKAGE_DIR / "config"


def repo_root() -> Path:
    """Local cobra-nats checkout. Override with REPO_PATH."""
    override = os.getenv("REPO_PATH")
    if override:
        return Path(override).expanduser().resolve()
    return REPO_ROOT


def repo_url() -> str:
    return os.getenv("GITHUB_REPO", "https://github.com/maatini/cobra-nats")


def ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR
