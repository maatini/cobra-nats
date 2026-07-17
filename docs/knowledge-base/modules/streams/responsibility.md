# Streams — Responsibilities

## Actions (`actions.ts`)

All Stream + Consumer operations via `withJetStream`. This is the largest consolidated actions file — stream CRUD, consumer CRUD, message browsing, and aggregated stats.

### Streams

| Action | Returns | Purpose | Route(s) |
|---|---|---|---|
| `listStreams(config)` | `StreamInfo[]` | List all JetStream streams | `/streams` |
| `createStream(config, streamConfig)` | `StreamInfo` | Create a stream; fails on name collision | `/streams` (create dialog) |
| `deleteStream(config, streamName)` | `boolean` | Delete stream + all messages; irreversible | `/streams` (confirm) |
| `getStreamInfo(config, streamName)` | `StreamInfo` | Fetch config + state (messages, bytes, seq range) | `/streams/[name]` |

### Messages

| Action | Returns | Purpose | Route(s) |
|---|---|---|---|
| `getStreamMessages(config, streamName, opts)` | `{messages, hasMore}` | Paginated message fetch by seq range with subject filter | `/streams/[name]` (message browser) |

**Invariants**:
- `batchSize` defaults to 25, configurable via `opts.batchSize`.
- Subject filter uses `*` and `>` NATS wildcards (implemented in the `subjectMatches` helper, not the server).
- Missing sequences (deleted/missing messages) are silently skipped; other errors are thrown.

### Consumers

| Action | Returns | Purpose | Route(s) |
|---|---|---|---|
| `listConsumers(config, stream)` | `{consumers}` | List all consumers on a stream | `/streams/[name]` |
| `createConsumer(config, stream, consumerConfig)` | `{info}` | Create durable/ephemeral consumer | `/streams/[name]` (dialog) |
| `deleteConsumer(config, stream, consumer)` | `void` | Delete consumer; pending messages lost | `/streams/[name]` (confirm) |

### Stats

| Action | Returns | Purpose | Route(s) |
|---|---|---|---|
| `getStreamConsumerStats(config, streamNames[])` | `Record<string, ConsumerStats>` | Aggregated consumer count + pending + ack-pending per stream | `/` (dashboard) |

**Invariants**: Stream names that fail to list consumers (e.g., deleted between list and fetch) are silently ignored.

## UI Components (`components/`)

| Component | Purpose | Key state |
|---|---|---|
| `stream-table.tsx` | Sortable/filterable stream list with TanStack Table | URL-synced filter via `useUrlState`, auto-refresh |
| `stream-info-view.tsx` | Stream detail: config, state, consumer list, message browser | Fetches `getStreamInfo` + renders consumer list |
| `create-stream-dialog.tsx` | Form for new stream (retention, storage, limits, replicas) | React Hook Form + Zod |
| `consumer-list.tsx` | Table of consumers on a stream with delete action | Calls `listConsumers` |
| `create-consumer-dialog.tsx` | Form for new consumer (push/pull, durable, ack policy) | React Hook Form + Zod |
| `message-browser.tsx` | Paginated message viewer with payload + header expansion | Calls `getStreamMessages`, pagination via seq range |
