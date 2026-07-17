# Connections — Responsibilities

## Zustand Store (`store.ts`)

**What it owns**: The canonical source of truth for all saved NATS connections. Persisted to `localStorage` under key `cobra-nats-storage`.

**Invariants**:
- `connections: NatsConnectionConfig[]` — list of all saved connections
- `activeConnectionId: string | null` — which connection is currently selected
- First connection added automatically becomes active if none is active.
- Removing the active connection sets `activeConnectionId` to `null`.
- Playwright tests reference `CONNECTIONS_STORAGE_KEY` to seed state.

**Entry points**:
| Method | Purpose |
|---|---|
| `addConnection(config)` | Append a new connection; auto-activate if none active |
| `removeConnection(id)` | Remove + clear active if removed |
| `setActiveConnection(id)` | Switch active connection |
| `updateConnection(id, partial)` | Merge partial config into existing |

## `useActiveConnection()` hook (`hooks.ts`)

**What it owns**: A selector hook that returns the currently active `NatsConnectionConfig | undefined`.

**Invariants**: Always derives from store; guaranteed to be reactive (store change → re-render).

**Why use this instead of the store directly**: It encapsulates the "find in array by active ID" pattern used everywhere.

## `useConnectionHealth()` hook (`hooks.ts`)

**What it owns**: Polls `pingConnection()` every 30s and returns `{ status: "checking" | "connected" | "disconnected", rttMs, error }`.

**Invariants**:
- Stops polling when component unmounts (via `mountedRef`).
- Polls immediately on mount, then every 30 seconds.

## Connection Actions (`actions.ts`)

**What it owns**: Server Actions for connection probing and server info retrieval.

| Action | Returns | Purpose |
|---|---|---|
| `testConnection(config)` | `ActionResponse<{serverInfo}>` | Throwaway connection probe (Connect Dialog "Test" button); opens + closes immediately |
| `pingConnection(config)` | `ActionResponse<{rttMs}>` | Lightweight health probe with fast-fail options (no reconnect, 5s timeout) |
| `getServerInfo(config)` | `ActionResponse<{info}>` | Get server info from an active pooled connection |

## Connect Dialog (`components/connect-dialog.tsx`)

**What it owns**: The UI for adding/editing/switching connections. Form with name, server URLs, auth type selector, and "Test Connection" button.

**Invariants**:
- Uses React Hook Form + Zod schema for validation.
- Reads/writes via `useNatsStore` (not direct localStorage).
- Calls `testConnection` for the "Test" button — does NOT persist on test.
