# Layout — Dependencies

## Outbound

| Dependency | Type | Purpose |
|---|---|---|
| `components/ui/*` (sidebar, breadcrumb, command, dialog, button, etc.) | Internal | All shadcn primitives for UI |
| `features/connections/store.ts` (useNatsStore) | Internal | Sidebar connection switcher |
| `features/connections/hooks.ts` (useActiveConnection, useConnectionHealth) | Internal | Topbar health, no-connection detection |
| `features/connections/components/connect-dialog.tsx` | Internal | Sidebar "New Connection" button |
| `hooks/use-keyboard-shortcuts.ts` | Internal | Global + help dialog shortcuts |
| `hooks/use-mobile.ts` | Internal | Sidebar responsive behavior |
| `next-themes` (useTheme) | External | Theme toggle |
| `next/navigation` (usePathname, useRouter) | External | Breadcrumbs, command palette navigation |
| `cmdk` | External | Command palette |
| `lucide-react` | External | Icons |
| `sonner` | External | Toaster in root provider |

## Inbound

| Dependent | What it uses | Purpose |
|---|---|---|
| `app/layout.tsx` | `root-provider.tsx` | Root layout wrapping |
| `app/(dashboard)/layout.tsx` | All layout components | Dashboard shell |
| All feature components | `useConfirm()` | Destructive action confirmation |
| All client components | `toast()` (via Sonner Toaster in root provider) | Error/success notifications |
