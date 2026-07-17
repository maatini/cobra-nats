# Publish — Responsibilities

## Actions (`actions.ts`)

Uses `withNatsConnection` (not `withJetStream`) — publish and request are core NATS operations.

| Action | Returns | Purpose |
|---|---|---|
| `publishMessage(config, subject, payload, msgHeaders?)` | `ActionResponse<void>` | Publish to subject; auto-detects JSON vs string payload |
| `requestMessage(config, subject, payload, timeout?)` | `ActionResponse<{reply}>` | Send request + wait for reply (default 5s timeout) |

**Payload handling**:
- Both actions try `JSON.parse(payload)` first. If it parses, the payload is encoded with `JSONCodec`. If it fails, the raw string is sent.
- For `requestMessage`, the reply is always decoded as string.

**Headers**: Optional `msgHeaders: Record<string, string>` map; converted to `MsgHdrs` using `nats.headers()`.

**Gotcha**: The publish action returns `void` on success — the client just shows a toast. No confirmation from the server.

## UI Components (`components/`)

| Component | Purpose |
|---|---|
| `subject-combobox.tsx` | Subject input with autocomplete (popular subjects) |
| `reply-output.tsx` | Display area for request-reply response (subject, payload, headers) |
