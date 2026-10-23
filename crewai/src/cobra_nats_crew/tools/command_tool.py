"""Allowlisted local commands for the implementation crew.

No git writes, no GitHub mutations, no shell metacharacters.
"""

from __future__ import annotations

import os
import re
import subprocess

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from cobra_nats_crew.paths import repo_root

_FORBIDDEN = re.compile(
    r"(git\s+(commit|push|add|reset|rebase|tag|cherry-pick)|"
    r"\bgh\b|"
    r"rm\s+-rf|"
    r"\bsudo\b|"
    r"curl\b|"
    r"wget\b|"
    r"chmod\b|"
    r"mkfs|"
    r"dd\s+if=)",
    re.IGNORECASE,
)

_ALLOWED = [
    re.compile(r"^npx tsc --noEmit$"),
    re.compile(r"^npm run lint$"),
    re.compile(r"^npm run build$"),
    re.compile(r"^npm (install|ci)( --save-dev| -D)?( [@A-Za-z0-9/_.\-]+)*$"),
    re.compile(r"^npx playwright test( --project=chromium)?( [\w./\-]+)*$"),
    re.compile(r"^npx vitest( run)?( --reporter=dot)?( [\w./\-]+)*$"),
    re.compile(r"^npx vitest related( [\w./\-]+)*$"),
    re.compile(r"^git status( --short|--porcelain)?$"),
    re.compile(r"^git diff( --stat)?( -- [\w./\-]+)*$"),
    re.compile(r"^git log -5( --oneline)?$"),
    re.compile(r"^ls( -la)?( [\w./\-]+)*$"),
    re.compile(r"^wc -l( [\w./\-]+)+$"),
]

_LONG_TIMEOUT = re.compile(r"^(npm run build|npx playwright test)")


class RunAllowedCommandInput(BaseModel):
    command: str = Field(
        description=(
            "A single allowlisted command, e.g. 'npx tsc --noEmit', "
            "'npm run lint', 'npx vitest run src/lib/nats/manager.test.ts', "
            "'npx playwright test tests/functional-os.spec.ts --project=chromium', "
            "'git status --short'. No pipes, no &&, no git commit/push."
        ),
    )


class RunAllowedCommandTool(BaseTool):
    name: str = "run_allowed_command"
    description: str = (
        "Run one allowlisted verification command in the cobra-nats repo root: "
        "npx tsc --noEmit, npm run lint, npm run build, npx vitest, "
        "npx playwright test, npm install -D, git status/diff/log. "
        "Forbidden: git commit/push/add, gh, rm, curl, sudo, pipes, &&."
    )
    args_schema: type[BaseModel] = RunAllowedCommandInput

    def _run(self, command: str) -> str:
        cmd = " ".join(command.strip().split())
        if not cmd:
            return "Empty command."
        if any(ch in cmd for ch in [";", "|", "&", "`", "$(", "\n", ">", "<"]):
            return "Shell metacharacters are not allowed. Pass a single command."
        if _FORBIDDEN.search(cmd):
            return f"Forbidden command: {cmd}"
        if not any(pat.fullmatch(cmd) for pat in _ALLOWED):
            return (
                "Command not on the allowlist. Allowed families: "
                "npx tsc --noEmit, npm run lint, npm run build, npm install -D <pkg>, "
                "npx playwright test [files], npx vitest run [files], "
                "git status --short, git diff, git log -5, ls, wc -l."
            )

        timeout = 600 if _LONG_TIMEOUT.match(cmd) else 180
        env = os.environ.copy()
        env.setdefault("NEXT_TELEMETRY_DISABLED", "1")
        env.setdefault("CI", "1")
        try:
            completed = subprocess.run(
                cmd,
                shell=True,
                cwd=str(repo_root()),
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return f"Timed out after {timeout}s: {cmd}"
        except OSError as exc:
            return f"Failed to start command: {exc}"

        out = (completed.stdout or "") + (completed.stderr or "")
        if len(out) > 16_000:
            out = out[:8_000] + "\n...\n" + out[-6_000:]
        return (
            f"$ {cmd}\nexit={completed.returncode}\n{out}".rstrip()
            or f"$ {cmd}\nexit={completed.returncode} (no output)"
        )
