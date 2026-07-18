# Dashboard — Responsibilities

## `dashboard-overview.tsx`

**What it owns**: The landing page at `/`. Aggregates data from other features but owns NO actions.

**Invariants**:
- Fetches data from: `getServerInfo`, `listStreams`, `listKVBuckets`, `getJetStreamAccountInfo`.
- Uses `Promise.allSettled` — partial failures are tolerated (e.g., JetStream disabled → streams/KV count shows 0).
- Auto-refresh via `useAutoRefresh` with persisted interval (storage key: `nats-ui:dashboard:refresh-interval`).
- Shows "No connection selected" empty state with `ConnectDialog` trigger when no active connection.

**Displayed stats**:
| Card | Data source | Color |
|---|---|---|
| Total Connections | `connections.length` from store | indigo |
| Active Server | `useActiveConnection()` | emerald |
| Streams | `listStreams` → `.length` | amber |
| KV Buckets | `listKVBuckets` → `.buckets.length` | rose |
| Server Name | `getServerInfo` → `info.server_name` | from store |
| Version | `getServerInfo` → `info.version` | from server |
| JetStream | `getServerInfo` / account info | green/disabled |
| Server URLs | `activeConnection.servers` | from store |
| File / Memory storage | `getJetStreamAccountInfo` | cyan / violet |
| JS Streams / Consumers | `getJetStreamAccountInfo` limits | from account |

**Quick actions**: Links to `/publish`, `/streams`, `/monitor`, `/kv`.
