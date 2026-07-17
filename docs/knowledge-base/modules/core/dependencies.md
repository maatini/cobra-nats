# Core — Dependencies

## Outbound (what this module depends on)

| Dependency | Type | Purpose |
|---|---|---|
| `nats` (npm) | External | Core NATS client library — `connect`, `NatsConnection`, `JetStreamManager`, `JetStreamClient` |
| `zustand` (npm) | External | Used by `useLocalStorage` (indirectly, via Zustand persist middleware in connection store) |
| `tailwind-merge` + `clsx` | External | `cn()` utility in `lib/utils.ts` |

## Inbound (who depends on this module)

| Dependent | Which part | Purpose |
|---|---|---|
| All `features/*/actions.ts` | `lib/server-action.ts`, `lib/nats/manager.ts`, `types/nats.ts` | Every Server Action uses the wrappers and types |
| All `features/*/components/*` | `types/nats.ts`, `components/ui/*` | Types for props, shadcn primitives for UI |
| `features/connections/store.ts` | `types/nats.ts` | `NatsConnectionConfig` type |
| `features/connections/hooks.ts` | `types/nats.ts`, `features/connections/store.ts` | Types + store access |
| `features/monitor/stream.ts` | `lib/nats/manager.ts`, `lib/server-action.ts` | Connection pool + error messages |
| `app/layout.tsx` | `components/providers/root-provider.tsx` | Root provider wraps the app |
| `app/(dashboard)/layout.tsx` | `components/layout/*`, `components/ui/sidebar` | Dashboard shell |
| `components/layout/*` | `components/ui/*`, `hooks/*`, `features/connections/*` | UI primitives + hooks + connection state |
| `components/providers/*` | `components/ui/*` | Dialog, button, input for confirm dialog |
| `tests/*.spec.ts` | `features/connections/store.ts` (CONNECTIONS_STORAGE_KEY) | Playwright seeds localStorage |
