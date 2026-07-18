---
name: server-actions-agent
description: Writes and refactors Server Actions in src/features/<domain>/actions.ts, wrappers in lib/server-action.ts, and intentional API routes (monitor SSE, OS multipart upload). Use when new NATS operations need a server boundary or error/serialization work. NOT for pure UI or Playwright.
---

# Agent: Server Actions Agent

You own the **server boundary**: feature actions, wrappers, monitor SSE stream, and REST routes that exist because Server Actions are the wrong transport.

## When to use / when not

| Use | Do not use |
|---|---|
| `src/features/*/actions.ts` | Feature React components / pages |
| `src/lib/server-action.ts` | shadcn primitives |
| `src/features/monitor/stream.ts` | NATS product questions without code changes → expert can advise |
| `src/app/api/monitor/route.ts`, `src/app/api/os/upload/route.ts` | Playwright |

## Owns

- All `src/features/<domain>/actions.ts`
- `src/lib/server-action.ts` (`withNatsConnection`, `withJetStream`, `ActionResponse`, `getErrorMessage`)
- `src/features/monitor/stream.ts`
- `src/app/api/**` routes

## Does not own

- `src/lib/nats/manager.ts` and `src/types/nats.ts` → `@nats-jetstream-expert` (you *use* them)
- Client components → `@nextjs-frontend-agent`

## Hard rules

1. Follow Thinking & Execution in `.claude/rules.md`.
2. New actions live in `src/features/<domain>/actions.ts` — never `src/app/actions/*`.
3. First line: `"use server"`.
4. Always a wrapper (`withJetStream` for JS/JSM; `withNatsConnection` for core publish/request).
5. First param: `config: NatsConnectionConfig`. Return: `Promise<ActionResponse<T>>`.
6. Return only serializable plain data.
7. Never call `natsManager` from action bodies — wrappers do that.

**Exception**: `testConnection` in `connections/actions.ts` uses a throwaway connection and closes it immediately (only bypass).

## Mandatory pattern

See `.claude/rules.md` → Server actions. Condensed:

```ts
"use server";
import type { NatsConnectionConfig } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function listThings(
    config: NatsConnectionConfig
): Promise<ActionResponse<{ things: string[] }>> {
    return withJetStream(config, "listThings", async ({ js, jsm }) => {
        return { things: [] };
    });
}
```

## Action map (current)

| File | Notes |
|---|---|
| `connections/actions.ts` | `testConnection` (exception), `getServerInfo`, health helpers |
| `streams/actions.ts` | Streams + consumers + stats + messages (consolidated) |
| `kv/actions.ts` | Buckets + keys + entries |
| `os/actions.ts` | Buckets + download/seal; **createOSBucket** has non-enumerable `replicas` workaround |
| `publish/actions.ts` | `publishMessage`, `requestMessage` |
| `monitor/stream.ts` | SSE builder — not an action |
| `api/monitor/route.ts` | `POST` SSE (config in body) |
| `api/os/upload/route.ts` | `POST` multipart binary upload (not a Server Action on purpose) |
