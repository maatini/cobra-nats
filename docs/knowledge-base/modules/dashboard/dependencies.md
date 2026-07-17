# Dashboard — Dependencies

## Outbound

| Dependency | Type | Purpose |
|---|---|---|
| `features/connections/hooks.ts` (useActiveConnection) | Internal | Check active connection, display name/servers |
| `features/connections/store.ts` (useNatsStore) | Internal | Total connections count |
| `features/connections/actions.ts` (getServerInfo) | Internal | Server name, version, JetStream status |
| `features/streams/actions.ts` (listStreams) | Internal | Stream count |
| `features/kv/actions.ts` (listKVBuckets) | Internal | KV bucket count |
| `features/connections/components/connect-dialog.tsx` | Internal | Empty state "Create New Connection" button |
| `hooks/use-auto-refresh.ts` | Internal | Auto-refresh with persisted interval |
| `components/ui/auto-refresh-select.tsx` | Internal | Interval selector dropdown |
| `components/ui/*` (Card, Badge, Button) | Internal | UI rendering |
| `lucide-react` (icons) | External | Card icons |

## Inbound

- Only used by `app/(dashboard)/page.tsx`
