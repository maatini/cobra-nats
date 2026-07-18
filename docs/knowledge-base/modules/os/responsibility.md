# OS — Responsibilities

## Actions (`actions.ts`)

All Object Store operations via `withJetStream`. Uses `js.views.os(bucket)` to get an OS client.

**Discovery**: OS buckets are found by filtering JetStream streams on the `OBJ_` prefix.

| Action | Returns | Purpose | Route(s) |
|---|---|---|---|
| `listOSBuckets(config)` | `{buckets: OsBucketInfo[]}` | Discover OS buckets via `OBJ_` prefixed streams | `/os` |
| `createOSBucket(config, name, opts)` | `OsBucketInfo` | Create OS bucket | `/os` (create dialog) |
| `getOSBucket(config, name)` | `OsBucketInfo` | Status for a single bucket (incl. sealed) | `/os/[bucket]` |
| `deleteOSBucket(config, name)` | `void` | Destroy bucket + all objects | `/os` (confirm) |
| `sealOSBucket(config, name)` | `OsBucketInfo` | Seal bucket (irreversible read-only) | `/os/[bucket]` |
| `listObjects(config, bucket)` | `{objects: OsObjectInfo[]}` | List all non-deleted objects with metadata | `/os/[bucket]` |
| `getObjectInfo(config, bucket, name)` | `OsObjectInfo` | Metadata for single object | `/os/[bucket]` |
| `uploadObject(config, bucket, name, base64Data)` | `OsObjectInfo` | Upload file (client encodes to base64, server decodes) | `/os/[bucket]` (upload dialog) |
| `downloadObject(config, bucket, name)` | `{data, name}` | Download file as base64 (client decodes to Blob for browser download) | `/os/[bucket]` |
| `getObjectContent(config, bucket, name)` | `{text, binary, size}` | Preview content; tries UTF-8, falls back to hex dump | `/os/[bucket]` (preview sheet) |
| `deleteObject(config, bucket, name)` | `void` | Delete single object | `/os/[bucket]` (confirm) |

**Critical workaround in `createOSBucket`**:
The nats.js `ObjectStoreImpl.init()` uses `Object.assign({}, opts)` to build the raw stream config. The `replicas` property maps to `num_replicas` in the NATS protocol, but `replicas` is also an enumerable property on the opts object, so `Object.assign` copies it — and the server rejects the unknown `replicas` field. **Fix**: `replicas` is set as non-enumerable via `Object.defineProperty` before passing to `js.views.os()`. Do NOT remove or refactor this.

## UI Components (`components/`)

| Component | Purpose |
|---|---|
| `os-list-view.tsx` | List page: search, create, delete buckets (`/os`) |
| `os-detail-view.tsx` | Bucket detail: object list + upload/preview (`/os/[bucket]`) |
| `os-bucket-card.tsx` | Card showing bucket info (size, object count, replicas, sealed status) |
| `create-os-dialog.tsx` | Form for new OS bucket (name, replicas, description) |
| `object-list.tsx` | Table of objects with download/delete/preview actions |
| `upload-object-dialog.tsx` | File upload with progress (client-side base64 encoding) |
| `object-preview-sheet.tsx` | Slide-over sheet for object content preview (text or hex for binary) |

## API Route — OS Upload (`src/app/api/os/upload/`)

An API route exists for OS upload (in addition to the `uploadObject` Server Action). This handles multipart file uploads from the browser, streaming the body to NATS.

**Note**: This is a REST endpoint, not a Server Action. It exists because file uploads as Server Actions have size limitations.

## API Route — OS Download (`src/app/api/os/download/`)

Streams an Object Store object to the client without base64-encoding the entire payload in memory.

Body JSON: `{ config: NatsConnectionConfig, bucket: string, name: string }`.

Used by the detail-view download button; prefer this path over the `downloadObject` Server Action for large objects.
