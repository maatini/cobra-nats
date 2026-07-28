# Context management

When context use is **>25%** (`/context` or `/session-info`), proactively suggest:

```text
/compact Wichtige Architektur-Entscheidungen, aktuelle TODOs und offene Tasks behalten
```

Suggest at most every 8–12 turns (or on large diffs / compaction warnings). `/compact` is TUI-only — give the user the command; do not pretend to run it.

Product patterns stay under **`.claude/rules.md`**, **`architecture.md`**, **`project.md`**. Global mirror: `~/.grok/AGENTS.md`.
