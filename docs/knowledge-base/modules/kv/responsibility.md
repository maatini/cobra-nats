# KV — Responsibilities

## Actions (`actions.ts`)

All KV operations via `withJetStream`. Uses `js.views.kv(bucket)` to get a KV client.

**Discovery**: KV buckets are found by filtering JetStream streams on the `KV_` prefix.

| Action | Returns | Purpose | Route(s) |
|---|---|---|---|
| `listKVBuckets(config)` | `{buckets: KvStatus[]}` | Discover KV buckets via `KV_` prefixed streams | `/kv` |
| `createKVBucket(config, kvConfig)` | `{status: KvStatus}` | Create a KV bucket; `bucket` field is required | `/kv` (create dialog) |
| `deleteKVBucket(config, bucket)` | `void` | Destroy bucket + all keys; irreversible | `/kv` (confirm) |
| `getKVKeys(config, bucket)` | `{keys: string[]}` | List all keys (excludes deleted) | `/kv/[bucket]` |
| `getKVEntry(config, bucket, key)` | `{entry: KvEntryResult}` | Fetch single entry serialized to client-safe format | `/kv/[bucket]` |
| `getKVHistory(config, bucket, key)` | `{entries: KvEntryResult[]}` | Revision history for a key (newest first) | `/kv/[bucket]` |
| `putKVEntry(config, bucket, key, value)` | `{revision: number}` | Upsert a key; returns new revision | `/kv/[bucket]` (dialog / restore) |
| `deleteKVEntry(config, bucket, key)` | `void` | Delete single entry by key | `/kv/[bucket]` (confirm) |

**Gotcha**: `createKVBucket` destructures `bucket` from `kvConfig` and passes the rest as `KvOptions`. The `bucket` name is required.

## UI Components (`components/`)

| Component | Purpose |
|---|---|
| `kv-list-view.tsx` | List page: search, create, delete buckets (`/kv`) |
| `kv-detail-view.tsx` | Bucket detail: key list + value inspector + revision history/restore (`/kv/[bucket]`) |
| `kv-bucket-card.tsx` | Card showing bucket status (values, history, TTL, size); links to bucket detail |
| `create-kv-dialog.tsx` | Form for new KV bucket (name, TTL, history, replicas, max_bytes) |
| `put-entry-dialog.tsx` | Form for adding/editing a key-value entry |
