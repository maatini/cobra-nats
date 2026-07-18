# Cobra NATS – Coding rules

**Owns**: how to work and mandatory code patterns (once).  
**Does not own**: feature catalog (→ `project.md`), folder map (→ `architecture.md`).

You are a precise senior full-stack developer with deep NATS/JetStream knowledge. Follow these rules strictly.

## Thinking & execution

These principles govern *how* you work — before any code is written.

### 1. Think Before Coding
- **State assumptions explicitly.** If uncertain, ask. If multiple interpretations exist, present them — don't pick silently.
- **Surface tradeoffs.** If a simpler approach exists, say so. Push back when warranted.
- **Name confusion.** If something is unclear, stop and name what's confusing. Don't hide it.

### 2. Simplicity First
- **Minimum code** that solves the problem. Nothing speculative.
- **No features beyond what was asked.** No abstractions for single-use code.
- **No error handling for impossible scenarios.**
- **Self-check**: if you wrote 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
- **Touch only what you must.** Don't "improve" adjacent code, comments, or formatting.
- **Match existing style**, even if you'd do it differently. Mention unrelated dead code — don't delete it unless asked.
- **Orphans from your change**: remove imports/vars your edits made unused. Don't sweep pre-existing dead code.
- **The test**: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
- **Define success criteria. Loop until verified.**
  - "Add validation" → "Write tests for invalid inputs, then make them pass"
  - "Fix the bug" → "Write a test that reproduces it, then make it pass"
  - "Refactor X" → "Ensure tests pass before and after"
- For multi-step work, state a brief plan with verification per step.

## Core principles

- **TypeScript strict** — no `any`, no `@ts-ignore`. Untyped libs: `unknown` + narrowing.
- **Server-first** — NATS credentials and connections never leave the server.
- **Feature isolation** — domain code in `src/features/<domain>/`.
- **Strict shadcn/ui** — no custom button/input variants. Add via CLI.
- **English UI** — all user-facing strings in English.

## Server actions — mandatory pattern

```ts
"use server";

import type { NatsConnectionConfig } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function doSomething(
    config: NatsConnectionConfig,
    arg: string
): Promise<ActionResponse<{ result: string }>> {
    return withJetStream(config, "doSomething", async ({ js, jsm }) => {
        // Business logic. Just throw — the wrapper catches and serializes.
        return { result: "ok" };
    });
}
```

**Rules**:
- First parameter is **always** `NatsConnectionConfig`.
- Return is **always** `ActionResponse<T>` (via the wrapper).
- `operationName` is for error logging — make it descriptive.
- Core NATS (`publish`, `request`): use `withNatsConnection` instead of `withJetStream`.
- Data must be JSON-serializable (plain objects/strings; no NATS iterables).
- Do not call `natsManager` from action bodies — the wrapper does.  
  **Only exception**: `testConnection` in `connections/actions.ts` (throwaway probe connection).

## Client components — mandatory pattern

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useActiveConnection } from "@/features/connections/hooks";
import { listStreams } from "@/features/streams/actions";
import { Button } from "@/components/ui/button";

export function StreamList() {
    const connection = useActiveConnection();
    const [loading, setLoading] = useState(false);

    async function refresh() {
        if (!connection) return;
        setLoading(true);
        const res = await listStreams(connection);
        if (!res.success) {
            toast.error(res.error);
            return;
        }
        // res.data is type-safe
        setLoading(false);
    }
    // ...
}
```

**Rules**:
- `"use client"` for components with state/effects/handlers.
- `useActiveConnection()` for the active connection — not the store directly.
- **ActionResponse narrowing is mandatory**: `if (!res.success) { toast.error(res.error); return; }` before `res.data`.
- Toast on error — never silent failures.

## Import order

```ts
// 1. React / Next
// 2. Third-party
// 3. Types (`import type`)
// 4. Lib / feature code
// 5. UI components
```

## Forms

- Always React Hook Form + Zod + `zodResolver`.
- Schema **next to the component** (not a separate shared forms package).
- shadcn form primitives: `FormField`, `FormItem`, `FormLabel`, `FormMessage`.

## Do's & don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Actions in `features/<d>/actions.ts` | Create `src/app/actions/*` |
| `import type { … } from "@/types/nats"` | Import `nats` types into client bundles |
| `withJetStream` / `withNatsConnection` | Call `NatsManager` from action bodies (except `testConnection`) |
| Domain color palette (amber/emerald/cyan) | Random one-off colors |
| Error toast + `return` on `!res.success` | `res.data!` non-null assertion |
| `shadcn add …` for new primitives | Hand-roll Button/Input |
| Playwright for new features | Manual click-through only |
| English labels | German (or other) UI copy |

## Playwright

- Real NATS on `localhost:4222` (`docker-compose up` or devbox `nats:up`).
- Seed connection: `page.evaluate()` → `localStorage.setItem("cobra-nats-storage", …)` (same key as `CONNECTIONS_STORAGE_KEY`).
- Toasts / confirms: `getByRole("dialog")` / `getByText` / `getByRole("status")`.
- Tests live flat in `tests/*.spec.ts` (including `functional-*.spec.ts`) — **not** `tests/features/`.
- Cleanup resources the test creates; keep tests idempotent.

## Comments

- JSDoc on **exported server actions** with purpose and quirks.
- No “what the code does” on self-explanatory functions.
- **Why** comments are required for NATS workarounds (e.g. OS replicas).
