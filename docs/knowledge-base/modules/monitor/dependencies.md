# Monitor — Dependencies

## Outbound

| Dependency | Type | Purpose |
|---|---|---|
| `lib/nats/manager.ts` (natsManager) | Internal | Create dedicated monitor connection |
| `lib/server-action.ts` (getErrorMessage) | Internal | User-friendly error messages in SSE error events |
| `nats` (NatsConnection) | External | NATS subscribe + message handling |
| `features/connections/hooks.ts` (useActiveConnection) | Internal | Get active connection servers/subject for the SSE URL |

## Inbound

| Dependent | What it uses | Purpose |
|---|---|---|
| `app/api/monitor/route.ts` | `createMonitorStream` | SSE endpoint |
| `app/(dashboard)/monitor/page.tsx` | `monitor-view.tsx` | Monitor page |
