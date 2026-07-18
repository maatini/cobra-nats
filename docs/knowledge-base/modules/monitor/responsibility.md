# Monitor — Responsibilities

**Note**: The monitor does NOT use Server Actions. It uses a REST API route (`/api/monitor`) + SSE `ReadableStream`. There is no `actions.ts` — the server-side logic is in `stream.ts`. (Object Store multipart upload is a separate API route under `/api/os/upload`.)

## SSE Stream (`stream.ts`)

**What it owns**: The `createMonitorStream()` function that builds the SSE `ReadableStream` passed to the `/api/monitor` route.

**Invariants**:
- Uses a **dedicated** NATS connection (ID: `monitor-${config.id}-${Date.now()}`) — not the shared feature pool — to avoid conflicts with other operations.
- Full auth is taken from the `NatsConnectionConfig` (user/pass/token). **Never** hardcodes `authType: "none"`.
- Sends 15-second heartbeat `ping` events to keep the SSE connection alive.
- Subscribes with a wildcard subject (e.g., `orders.>`).
- Closes the NATS connection + subscription when the client aborts (`signal.addEventListener("abort", ...)`).
- Error messages use `getErrorMessage()` from `lib/server-action.ts` for user-friendly output.

**SSE Events**:
| Event | Data | Purpose |
|---|---|---|
| `connected` | `{subject}` | Confirms subscription started |
| `message` | `{timestamp, subject, data, size, headers}` | Incoming message |
| `ping` | `timestamp` | Keep-alive heartbeat (every 15s) |
| `error` | `errorMessage` | Connection/subscription failure |

## API Route (`src/app/api/monitor/route.ts`)

**What it owns**: The `POST /api/monitor` endpoint — the SSE entry point for live subject monitoring.

**Body (JSON)** — secrets never appear in the URL/query string:
| Field | Required | Purpose |
|---|---|---|
| `config` | yes | Full `NatsConnectionConfig` (servers + auth) |
| `subject` | no (default `>`) | Subject pattern to subscribe to |

**Invariants**: Uses `force-dynamic` to prevent static generation. Rejects missing/invalid config with 400.

## Monitor UI (`monitor-view.tsx`)

**What it owns**: The live message viewer client component.

**Features**:
- Subscribe to any subject pattern via `fetch` POST + streaming body (not `EventSource`, which cannot send a body).
- Real-time SSE parse of chunked response.
- **Pause / resume** without disconnecting (client-side pause via ref).
- **Expand** messages to inspect full payload and headers.
- **Copy** message payload to clipboard.
- **Export** captured messages as JSON.
- Keeps the last **500 messages** in memory (ring buffer).
- AbortController cleans up on stop/unmount.
