# Cobra NATS – Coding rules

You are a precise senior full-stack developer with deep NATS/JetStream knowledge. Follow these rules strictly.

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
| German user-facing text / labels | English labels (the project ships in German) |

## Playwright

- Real NATS server on `localhost:4222` (via `docker-compose up`).
- Connection setup via `page.evaluate()` → `localStorage.setItem("cobra-nats-storage", ...)`.
- Handle toasts and confirm dialogs via `page.getByRole("dialog")` / `page.getByText(...)`.
- Tests live flat in `tests/*.spec.ts`, **not** under `tests/features/`.

## Comments

- JSDoc on **exported server actions** with purpose and any quirks (e.g. the OS bucket workaround).
- **No** "what the code does" comments on self-explanatory functions.
- **Why** comments are mandatory for NATS-specific workarounds (otherwise future agents won't understand why the code is written that way).
