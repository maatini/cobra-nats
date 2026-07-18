# Layout — Responsibilities

## Components (`src/components/layout/`)

| Component | Purpose | Routing-aware? |
|---|---|---|
| `app-sidebar.tsx` | Navigation links + connection switcher + "New Connection" footer | Yes (highlights active route) |
| `topbar.tsx` | Auto-breadcrumbs + health indicator + theme toggle | No |
| `auto-breadcrumbs.tsx` | Derives breadcrumb trail from Next.js pathname | Yes (reads `usePathname()`) |
| `command-palette.tsx` | `Cmd/Ctrl+K` quick navigation: search across all features + actions | Yes (navigates via `useRouter()`) |
| `global-shortcuts.tsx` | Central keyboard shortcut registration via `useKeyboardShortcuts` + help dialog (`?`) | No |
| `help-dialog.tsx` | Modal listing all active keyboard shortcuts (triggered by `?`) | No |
| `no-connection-banner.tsx` | Warning banner shown when no active connection; dismissible | No |
| `theme-toggle.tsx` | Light/dark toggle using `next-themes` `useTheme()` | No |

## Providers (`src/components/providers/`)

| Provider | Wraps | Purpose |
|---|---|---|
| `root-provider.tsx` | Entire app (in `app/layout.tsx`) | ThemeProvider + TooltipProvider + Toaster + ConfirmProvider |
| `confirm-provider.tsx` | Inside RootProvider | Promise-based confirmation dialog with type-to-confirm for destructive actions |

### ConfirmProvider invariants

- Exposes `useConfirm()` hook returning `(opts: ConfirmOptions) => Promise<boolean>`.
- Only one confirm dialog open at a time (single `request` state).
- Destructive variant uses rose color; default uses indigo.
- When `typedName` is provided, the confirm button is disabled until the user types the exact string (typo guard for delete operations).
- `useConfirm()` throws if used outside ConfirmProvider.

## Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

**What it owns**: The shared dashboard shell: SidebarProvider → AppSidebar + SidebarInset(Topbar, NoConnectionBanner, main content) + GlobalShortcuts.

**Invariants**: Sidebar defaults to open (`defaultOpen={true}`). All dashboard pages render inside this layout.
