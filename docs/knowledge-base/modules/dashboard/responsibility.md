# Dashboard — Responsibilities

## `dashboard-overview.tsx`

**What it owns**: The landing page at `/`. Aggregates data from other features but owns NO actions. Time series live in React state (`sampler.ts`, max 60 samples).

**Invariants**:
- Fetches data from: `getServerInfo`, `listStreams`, `listKVBuckets`, `listOSBuckets`, `getJetStreamAccountInfo`, optional `fetchHttpMonitoring`.
- Uses `Promise.allSettled` — partial failures are tolerated. Unavailable metrics stay `null` (empty sparkline), not `0`.
- Auto-refresh via `useAutoRefresh` with persisted interval (storage key: `nats-ui:dashboard:refresh-interval`).
- Sample history is segmented by connection ID and monitoring endpoint; it resets when there is no active connection.
- Shows "No connection selected" empty state with `ConnectDialog` trigger when no active connection.

**Displayed stats**:
| Card | Data source | Color |
|---|---|---|
| Total Connections | `connections.length` from store | indigo |
| Active Server | `useActiveConnection()` | emerald |
| Streams | `listStreams` → `.length` | amber |
| KV Buckets | `listKVBuckets` → `.buckets.length` | rose |
| Object Stores | `listOSBuckets` | cyan |
| Time series | `recordDashboardSample` (in-memory, 60 samples) | — |
| Server Name | `getServerInfo` → `info.server_name` | from store |
| Version | `getServerInfo` → `info.version` | from server |
| JetStream | `getServerInfo` / account info | green/disabled |
| Server URLs | `activeConnection.servers` | from store |
| File / Memory storage | `getJetStreamAccountInfo` | cyan / violet |
| JS Streams / Consumers | `getJetStreamAccountInfo` limits | from account |

**Quick actions**: Links to `/publish`, `/streams`, `/monitor`, `/kv`.
