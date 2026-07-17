# Publish — Dependencies

## Outbound

| Dependency | Type | Purpose |
|---|---|---|
| `lib/server-action.ts` (withNatsConnection, ActionResponse) | Internal | Action wrapper |
| `types/nats.ts` (NatsConnectionConfig) | Internal | Action params |
| `nats` (headers, JSONCodec, PublishOptions) | External | NATS publish/request APIs |
| `features/connections/hooks.ts` (useActiveConnection) | Internal | Get active config |

## Inbound

| Dependent | What it uses | Purpose |
|---|---|---|
| `app/(dashboard)/publish/page.tsx` | `publishMessage`, `requestMessage`, UI components | Publish page |
