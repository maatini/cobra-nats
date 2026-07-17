# OS — Dependencies

## Outbound

| Dependency | Type | Purpose |
|---|---|---|
| `lib/server-action.ts` (withJetStream, ActionResponse) | Internal | Action wrapper |
| `types/nats.ts` (NatsConnectionConfig, OsBucketInfo, OsObjectInfo) | Internal | Action params + serializable types |
| `nats` (ObjectStoreOptions, ObjectInfo) | External | NATS OS types |
| `features/connections/hooks.ts` (useActiveConnection) | Internal | Get active config |

## Inbound

| Dependent | What it uses | Purpose |
|---|---|---|
| `app/(dashboard)/os/page.tsx` | `os-bucket-card.tsx`, `create-os-dialog.tsx` | OS bucket list page |
| `app/(dashboard)/os/[bucket]/page.tsx` | `object-list.tsx`, `upload-object-dialog.tsx`, `object-preview-sheet.tsx` | Object list + operations |
