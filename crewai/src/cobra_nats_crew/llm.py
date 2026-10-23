"""LLM wiring for OpenRouter (default) and leftover CrewAI OpenAI fallbacks."""

from __future__ import annotations

import os
from typing import Any

from crewai import LLM

OPENROUTER_DEFAULT_MODEL = "openrouter/openai/gpt-4o"
OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"


def using_openrouter() -> bool:
    return bool(os.getenv("OPENROUTER_API_KEY", "").strip())


def model_name() -> str:
    model = (
        os.getenv("MODEL")
        or os.getenv("OPENAI_MODEL")
        or os.getenv("OPENAI_MODEL_NAME")
        or ""
    ).strip()
    if not model:
        return OPENROUTER_DEFAULT_MODEL if using_openrouter() else "gpt-4o"
    if using_openrouter() and not model.startswith("openrouter/"):
        return f"openrouter/{model}"
    return model


def apply_llm_env() -> None:
    """Make CrewAI internals that still look at OPENAI_* use OpenRouter.

    CrewAI's planner defaults to a native OpenAI model when ``planning_llm`` is
    unset. Point those env vars at OpenRouter so leftover ``create_llm(None)``
    paths do not demand a real OpenAI key.
    """
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        return

    base = (
        os.getenv("OPENROUTER_API_BASE")
        or os.getenv("OPENROUTER_BASE_URL")
        or OPENROUTER_API_BASE
    ).strip()
    os.environ["OPENROUTER_API_KEY"] = key
    os.environ.setdefault("OPENROUTER_BASE_URL", base)
    os.environ.setdefault("OPENROUTER_API_BASE", base)

    model = model_name()
    os.environ["MODEL"] = model

    if not os.getenv("OPENAI_API_KEY", "").strip():
        os.environ["OPENAI_API_KEY"] = key
        os.environ["OPENAI_API_BASE"] = base
        os.environ["OPENAI_BASE_URL"] = base
        os.environ.setdefault("OPENAI_MODEL_NAME", model)


def build_llm() -> LLM:
    """Native CrewAI OpenRouter provider when OPENROUTER_API_KEY is set."""
    kwargs: dict[str, Any] = {"model": model_name()}
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if key:
        kwargs["api_key"] = key
        custom_base = (
            os.getenv("OPENROUTER_API_BASE") or os.getenv("OPENROUTER_BASE_URL") or ""
        ).strip()
        if custom_base and custom_base.rstrip("/") != OPENROUTER_API_BASE.rstrip("/"):
            kwargs["base_url"] = custom_base
    return LLM(**kwargs)


def describe_llm() -> str:
    llm = build_llm()
    provider = getattr(llm, "provider", None) or type(llm).__name__
    model = getattr(llm, "model", model_name())
    return f"{provider}:{model}"
