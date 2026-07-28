---
name: cobra-new-action
description: >
  Add or refactor a Cobra NATS Server Action (or intentional API route) with the
  mandatory wrappers and ActionResponse shape. Use when the user asks for a new
  action, server operation, API route for NATS, or runs /cobra-new-action.
---

# Cobra: new Server Action

Canonical pattern: **`.claude/rules.md`** → “Server actions”. Prefer subagent **`server-actions-agent`**.

## Steps

1. Open existing `src/features/<domain>/actions.ts` (do **not** create `src/app/actions/*`).
2. Append at end in order: **List → Create → Get → Mutate → Delete**.
3. Implement with the wrapper:

```ts
"use server";

import type { NatsConnectionConfig } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function doSomething(
    config: NatsConnectionConfig,
    arg: string
): Promise<ActionResponse<{ result: string }>> {
    return withJetStream(config, "doSomething", async ({ js, jsm }) => {
        // throw on failure — wrapper serializes errors
        return { result: "ok" };
    });
}
```

4. **Core NATS** (`publish` / `request`): use `withNatsConnection` instead of `withJetStream`.
5. Return only **JSON-serializable** plain data (no NATS iterables / class instances).
6. Do **not** call `natsManager` from the action body (exception: `testConnection` only).
7. Wire the client: `useActiveConnection()` + mandatory narrowing:

```ts
const res = await doSomething(connection, arg);
if (!res.success) {
    toast.error(res.error);
    return;
}
// res.data is safe
```

8. JSDoc on the exported action (purpose + quirks). Tag known workarounds (e.g. `@tag:os-replicas-bug`).

## When Server Actions are wrong

Use intentional API routes instead (still `server-actions-agent` ownership):

| Route | Why |
|---|---|
| `POST /api/monitor` | SSE; config in body, not query |
| `POST /api/os/upload` | Multipart binary |
| `POST /api/os/download` | Streaming binary |

## Out of scope for this skill

- Pure UI/layout → `nextjs-frontend-agent` / `cobra-new-feature`
- JetStream policy design without code → `nats-jetstream-expert`
- Playwright only → `cobra-e2e`
