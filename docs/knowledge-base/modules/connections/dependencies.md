# Connections — Dependencies

## Outbound (what this module depends on)

| Dependency | Type | Purpose |
|---|---|---|
| `zustand` + `zustand/middleware` | External | State management + `persist` middleware |
| `types/nats.ts` (NatsConnectionConfig) | Internal | Store type, hook type, action params |
| `lib/server-action.ts` (withNatsConnection, getErrorMessage) | Internal | Action error wrapping |
| `lib/nats/manager.ts` (natsManager) | Internal | Connection pool for test/ping/getServerInfo |
| `nats` (connect, ServerInfo) | External | Direct connect for ping (not pooled), ServerInfo type |
| `react` (useState, useEffect, useRef) | External | Hook reactivity |

## Inbound (who depends on this module)

| Dependent | What it uses | Purpose |
|---|---|---|
| All feature components | `useActiveConnection()` | Get active config for Server Action calls |
| `topbar.tsx` | `useConnectionHealth()` | Health status indicator |
| `app-sidebar.tsx` | `useNatsStore().connections` | Connection switcher list |
| `dashboard-overview.tsx` | `useActiveConnection()`, `getServerInfo` | Dashboard stats |
| `no-connection-banner.tsx` | `useActiveConnection()` | Show/hide banner |
| All pages | `connect-dialog.tsx` | "New Connection" CTA |
| Playwright tests | `CONNECTIONS_STORAGE_KEY` | Seed connection state via `page.evaluate()` |
