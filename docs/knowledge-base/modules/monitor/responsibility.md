# Monitor — Responsibilities

**Note**: The monitor does NOT use Server Actions. It uses a REST API route (`/api/monitor`) + SSE `ReadableStream`. There is no `actions.ts` — the server-side logic is in `stream.ts`. (Object Store multipart upload is a separate API route under `/api/os/upload`.)

## SSE Stream (`stream.ts`)

**What it owns**: The `createMonitorStream()` function that builds the SSE `ReadableStream` passed to the `/api/monitor` route.

**Invariants**:
- Uses a **dedicated** NATS connection (ID: `monitor-${connectionId}-${Date.now()}`) — not the shared pool — to avoid conflicts with other operations.
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

**What it owns**: The `GET /api/monitor` endpoint — the SSE entry point for live subject monitoring.

**Query params**:
| Param | Default | Purpose |
|---|---|---|
| `connectionId` | (required) | Which connection to subscribe from |
| `subject` | `>` | Subject pattern to subscribe to |
| `servers` | `nats://localhost:4222` | Comma-separated server URLs |

**Invariants**: Uses `force-dynamic` to prevent static generation.

## Monitor UI (`monitor-view.tsx`)

**What it owns**: The live message viewer client component.

**Features**:
- Subscribe to any subject pattern.
- Real-time message stream via `EventSource` API.
- **Pause / resume** without disconnecting.
- **Expand** messages to inspect full payload and headers.
- **Copy** message payload to clipboard.
- **Export** captured messages as JSON.
- Keeps the last **500 messages** in memory (ring buffer).
