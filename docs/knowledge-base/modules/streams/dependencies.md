# Streams — Dependencies

## Outbound

| Dependency | Type | Purpose |
|---|---|---|
| `lib/server-action.ts` (withJetStream, ActionResponse) | Internal | Action wrapper |
| `types/nats.ts` (NatsConnectionConfig, StreamMessage, GetStreamMessagesOptions) | Internal | Action params + return types |
| `nats` (StreamConfig, StreamInfo, ConsumerConfig, ConsumerInfo) | External | NATS domain types |
| `features/connections/hooks.ts` (useActiveConnection) | Internal | Get active config for action calls |

## Inbound

| Dependent | What it uses | Purpose |
|---|---|---|
| `app/(dashboard)/streams/page.tsx` | `stream-table.tsx`, `create-stream-dialog.tsx` | Stream list page |
| `app/(dashboard)/streams/[name]/page.tsx` | `stream-info-view.tsx` | Stream detail page |
| `features/dashboard/dashboard-overview.tsx` | `listStreams` | Stream count on dashboard |
