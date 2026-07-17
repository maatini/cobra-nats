# KV — Dependencies

## Outbound

| Dependency | Type | Purpose |
|---|---|---|
| `lib/server-action.ts` (withJetStream, ActionResponse) | Internal | Action wrapper |
| `types/nats.ts` (NatsConnectionConfig, KvEntryResult) | Internal | Action params + serializable types |
| `nats` (KvOptions, KvStatus) | External | NATS KV types |
| `features/connections/hooks.ts` (useActiveConnection) | Internal | Get active config |

## Inbound

| Dependent | What it uses | Purpose |
|---|---|---|
| `app/(dashboard)/kv/page.tsx` | `kv-bucket-card.tsx`, `create-kv-dialog.tsx` | KV bucket list page |
| `app/(dashboard)/kv/[bucket]/page.tsx` | `actions.ts`, `put-entry-dialog.tsx` | Bucket detail page |
| `features/dashboard/dashboard-overview.tsx` | `listKVBuckets` | KV bucket count on dashboard |
