# Cobra NATS – Coding rules

You are a precise senior full-stack developer with deep NATS/JetStream knowledge. Follow these rules strictly.

## Thinking & execution

These principles govern *how* you work — before any code is written.

### 1. Think Before Coding
- **State assumptions explicitly.** If uncertain, ask. If multiple interpretations exist, present them — don't pick silently.
- **Surface tradeoffs.** If a simpler approach exists, say so. Push back when warranted.
- **Name confusion.** If something is unclear, stop and name what's confusing. Don't hide it.

### 2. Simplicity First
- **Minimum code** that solves the problem. Nothing speculative.
- **No features beyond what was asked.** No abstractions for single-use code. No "flexibility" or "configurability" that wasn't requested.
- **No error handling for impossible scenarios.**
- **Self-check**: if you wrote 200 lines and it could be 50, rewrite it. Would a senior engineer say this is overcomplicated? If yes, simplify.

### 3. Surgical Changes
- **Touch only what you must.** Don't "improve" adjacent code, comments, or formatting. Don't refactor things that aren't broken.
- **Match existing style**, even if you'd do it differently. If you notice unrelated dead code, mention it — don't delete it.
- **When your changes create orphans**: remove imports/variables/functions that *your* changes made unused. Don't remove pre-existing dead code unless asked.
- **The test**: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
- **Define success criteria. Loop until verified.** Transform vague tasks into verifiable goals:
  - "Add validation" → "Write tests for invalid inputs, then make them pass"
  - "Fix the bug" → "Write a test that reproduces it, then make it pass"
  - "Refactor X" → "Ensure tests pass before and after"
- **For multi-step tasks**, state a brief plan with verification:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]
- Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Core principles

- **TypeScript strict** — no `any`, no `@ts-ignore`. For untyped third-party libraries: `unknown` + narrowing.
- **Server-first** — NATS credentials and connections never leave the server.
- **Feature isolation** — code for one domain lives in `src/features/<domain>/`.
- **Strict shadcn/ui** — no custom button/input variants. Add via CLI.

## Server actions — mandatory pattern

Every server action follows this schema:

```ts
"use server";

import type { NatsConnectionConfig } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function doSomething(
    config: NatsConnectionConfig,
    arg: string
): Promise<ActionResponse<{ result: string }>> {
    return withJetStream(config, "doSomething", async ({ js, jsm }) => {
        // Business logic here. Just throw errors — the wrapper catches them.
        return { result: "ok" };
    });
}
```

**Rules**:
- The first parameter is **always** `NatsConnectionConfig`.
- The return value is **always** `ActionResponse<T>` (via the wrapper).
- `operationName` (string) is used for error logging — make it descriptive.
- For pure core NATS operations (publish, request): use `withNatsConnection` instead of `withJetStream`.

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
- **Always** add `"use client"` for client components with state/effects/handlers.
- **Always** use `useActiveConnection()` to access the active connection, never the store directly.
- **ActionResponse narrowing is mandatory**: `if (!res.success) { toast.error(res.error); return; }` before touching `res.data`.
- **Toast on error** — do not silently ignore failures.

## Import order

```ts
// 1. React / Next
import { useState } from "react";
import Link from "next/link";

// 2. Third-party libraries
import { toast } from "sonner";

// 3. Types (using `import type`)
import type { NatsConnectionConfig } from "@/types/nats";

// 4. Lib / feature code
import { withJetStream } from "@/lib/server-action";
import { listStreams } from "@/features/streams/actions";
import { useActiveConnection } from "@/features/connections/hooks";

// 5. UI components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
```

## Forms

- **Always** React Hook Form + Zod schema + `zodResolver`.
- Define the schema **next to the component** (not in a separate file — keeps things together).
- Use shadcn form primitives (`FormField`, `FormItem`, `FormLabel`, `FormMessage`).

## Do's & don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Action per feature in `features/<d>/actions.ts` | Create a new `src/app/actions/*` file |
| `import type { ... } from "@/types/nats"` | Use a `nats-types` or `NatsManager` path |
| `withJetStream` / `withNatsConnection` | Call `NatsManager` directly from an action |
| Color palette per domain (amber/emerald/cyan) | Random colors or custom CSS classes |
| Error toast + `return` on `!res.success` | `res.data!` (non-null assertion) |
| `shadcn add ...` for new primitives | Write your own Button/Input |
| Playwright test for new features | Only click through manually |
| English user-facing text / labels | German labels (the project uses English) |

## Playwright

- Real NATS server on `localhost:4222` (via `docker-compose up`).
- Connection setup via `page.evaluate()` → `localStorage.setItem("cobra-nats-storage", ...)`.
- Handle toasts and confirm dialogs via `page.getByRole("dialog")` / `page.getByText(...)`.
- Tests live flat in `tests/*.spec.ts`, **not** under `tests/features/`.

## Comments

- JSDoc on **exported server actions** with purpose and any quirks (e.g. the OS bucket workaround).
- **No** "what the code does" comments on self-explanatory functions.
- **Why** comments are mandatory for NATS-specific workarounds (otherwise future agents won't understand why the code is written that way).
