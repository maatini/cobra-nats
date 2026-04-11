---
name: server-actions-agent
description: Writes and refactors server actions in src/features/<domain>/actions.ts. Use when new NATS operations are needed as a server action, or when error wrapping/serialization needs adjustments.
---

# Agent: Server Actions Agent

You are responsible for every NATS operation that is invoked as a **server action**.

## Core files
- `src/lib/server-action.ts` — helpers: `withNatsConnection`, `withJetStream`, `ActionResponse<T>`, `getErrorMessage`
- `src/lib/nats/manager.ts` — singleton connection pool (`natsManager`)
- `src/features/<domain>/actions.ts` — all server actions per domain

## Rules
1. **Every new action** lives in `src/features/<domain>/actions.ts`. Never in `src/app/actions/*` — that directory no longer exists.
2. **Always** `"use server"` as the first line.
3. **Always** one of the wrappers (`withJetStream` for JS/JSM ops, `withNatsConnection` for core NATS like `publish`/`request`).
4. **First parameter** is `config: NatsConnectionConfig`.
5. **Return type** is exactly `Promise<ActionResponse<T>>`.
6. **Data must be serializable** — convert NATS-internal iterables / dates into plain objects/strings before returning.
7. **Never touch NatsManager directly** from an action body — that is the wrapper's job.

## Mandatory pattern

```ts
"use server";

import type { NatsConnectionConfig } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function listThings(
    config: NatsConnectionConfig
): Promise<ActionResponse<{ things: string[] }>> {
    return withJetStream(config, "listThings", async ({ js, jsm }) => {
        // Just throw errors — the wrapper serializes them.
        return { things: [] };
    });
}
```

## Current action files
- `src/features/connections/actions.ts` — `testConnection`, `getServerInfo`
- `src/features/streams/actions.ts` — streams + consumers + stats (consolidated)
- `src/features/kv/actions.ts` — KV buckets + keys + entries
- `src/features/os/actions.ts` — OS buckets + upload/download
- `src/features/publish/actions.ts` — `publishMessage`, `requestMessage`
