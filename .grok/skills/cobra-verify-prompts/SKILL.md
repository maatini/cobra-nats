---
name: cobra-verify-prompts
description: >
  Verify Cobra NATS agent/prompt docs against the live repo tree. Use when editing
  AGENTS.md, CLAUDE.md, .claude/* agent docs, .grok rules, stack versions, or when
  the user runs /cobra-verify-prompts or asks if prompt docs are in sync.
---

# Cobra: verify prompt docs

## Run

```bash
node scripts/verify-prompt-docs.mjs
```

Exit `0` only when all structural checks pass. Fix every `FAIL` line before finishing.

## What it checks (high level)

- Stack majors in `CLAUDE.md` vs `package.json` (Next 16, React 19, TypeScript 6, nats ~2.29)
- Live API routes (`monitor`, `os/upload`, …) documented; no false “only REST / every op is a Server Action” slogans
- Feature folders + flat `tests/*.spec.ts`
- Storage key `cobra-nats-storage` in store + docs
- Five agent profiles with when-not boundaries; `.grok/agents` + short `.grok/rules` pointers
- `AGENTS.md` subagent routing + API exceptions

## When editing prompts

1. Keep **always-on** thin: `AGENTS.md` (routing/commands) + `CLAUDE.md` (invariants/layout/mental model).
2. Patterns once in **`.claude/rules.md`** — never dump into `.grok/rules/*` (must stay short pointers).
3. After any prompt/agent doc change, re-run the verifier.
4. Optional product map: `.claude/project.md` (version should match `package.json`).

## Related skills

- Scaffolding feature/action/tests: `cobra-new-feature`, `cobra-new-action`, `cobra-e2e`
