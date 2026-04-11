# Architektur – Cobra NATS

Dieses Dokument ist die **"Wo liegt was?"-Karte** für KI-Agenten. Lies das zuerst, bevor du Code schreibst.

## Data-Flow

```
┌──────────────┐   import    ┌──────────────────┐   call    ┌──────────────────┐
│ UI Component │ ──────────> │ Server Action    │ ────────> │ NatsManager      │
│ (.tsx)       │             │ features/…/      │           │ lib/nats/        │
│              │  <───────── │  actions.ts      │ <──────── │  manager.ts      │
└──────────────┘  Action      └──────────────────┘ NATS conn └──────────────────┘
                  Response           │
                  <T>                │ wraps via
                                     ▼
                           ┌──────────────────────┐
                           │ withJetStream /      │
                           │ withNatsConnection   │
                           │ lib/server-action.ts │
                           └──────────────────────┘
```

Der Client **ruft niemals NATS direkt** auf. Er importiert Server Actions; Next.js marshalt den Aufruf, die Action nutzt den Singleton `natsManager`, und gibt ein serialisierbares `ActionResponse<T>` zurück.

## Vollständige Ordner-Map

| Pfad | Rolle | Wer bearbeitet? |
|---|---|---|
| `src/app/(dashboard)/<route>/page.tsx` | User-Seiten | `@nextjs-frontend-agent` |
| `src/app/(dashboard)/layout.tsx` | Dashboard-Layout (Sidebar + Topbar) | `@nextjs-frontend-agent` |
| `src/app/api/monitor/route.ts` | SSE-Endpoint für Live-Subject-Monitor (einziger REST-Endpoint) | `@server-actions-agent` |
| `src/features/<domain>/actions.ts` | Alle Server Actions des Features | `@server-actions-agent` |
| `src/features/<domain>/components/*.tsx` | Feature-spezifische UI | `@nextjs-frontend-agent` / `@ui-shadcn-agent` |
| `src/features/connections/store.ts` | Zustand-Store für Connections (persist) | `@nextjs-frontend-agent` |
| `src/features/connections/hooks.ts` | `useActiveConnection()` | `@nextjs-frontend-agent` |
| `src/components/ui/*` | shadcn Primitives — nur via `shadcn add` | – |
| `src/components/layout/*` | App-weite Sidebar/Topbar | `@nextjs-frontend-agent` |
| `src/components/providers/*` | Root-Provider + Confirm-Dialog-Provider | `@nextjs-frontend-agent` |
| `src/lib/nats/manager.ts` | Singleton `NatsManager` — Connection-Pool | `@nats-jetstream-expert` |
| `src/lib/server-action.ts` | `withNatsConnection`, `withJetStream`, `ActionResponse<T>` | `@server-actions-agent` |
| `src/types/nats.ts` | Alle geteilten Domain-Types + Enums | `@nats-jetstream-expert` |
| `tests/*.spec.ts` | Playwright E2E | `@playwright-testing-agent` |

## Blaupause: Neues Feature hinzufügen

Beispiel: Du willst ein **"Subjects"**-Feature hinzufügen.

1. **Types** (falls neu) → `src/types/nats.ts` erweitern.
2. **Ordner anlegen** → `src/features/subjects/{actions.ts, components/}`
3. **Action schreiben** → `src/features/subjects/actions.ts`:
   ```ts
   "use server";
   import type { NatsConnectionConfig } from "@/types/nats";
   import { withNatsConnection, type ActionResponse } from "@/lib/server-action";

   export async function listSubjects(
       config: NatsConnectionConfig
   ): Promise<ActionResponse<string[]>> {
       return withNatsConnection(config, "listSubjects", async (nc) => {
           // … NATS-Operationen
           return [];
       });
   }
   ```
4. **UI-Komponenten** → `src/features/subjects/components/subject-list.tsx`:
   ```tsx
   "use client";
   import { useActiveConnection } from "@/features/connections/hooks";
   import { listSubjects } from "@/features/subjects/actions";
   // ...
   ```
5. **Route** → `src/app/(dashboard)/subjects/page.tsx` (rendert Komponenten aus `features/subjects/components/`).
6. **Sidebar-Eintrag** → `src/components/layout/app-sidebar.tsx` erweitern.
7. **Playwright-Test** → `tests/subjects.spec.ts`.

**Wichtig**: Niemals eine `src/app/actions/` Datei anlegen — das Verzeichnis existiert nicht mehr. Actions leben pro Feature.

## Blaupause: Neue Action zu bestehendem Feature

Beispiel: Neue KV-Operation `purgeKVKey`.

1. Öffne `src/features/kv/actions.ts`.
2. Füge die Funktion **am Ende** hinzu (Reihenfolge: List → Create → Get → Mutate → Delete).
3. Keine neue Datei anlegen — alles zu einem Feature bleibt in `actions.ts`.
4. UI: Neue Komponente oder bestehende erweitern unter `src/features/kv/components/`.

## Blaupause: Neue shadcn-Komponente

```bash
npx shadcn@latest add <component-name>
```
Landet automatisch in `src/components/ui/`. **Nicht manuell** editieren — bei nächstem `add` überschrieben.

## Häufige "Wo liegt was?"-Antworten

| Frage | Antwort |
|---|---|
| Connection-State / localStorage | `src/features/connections/store.ts` (Zustand + persist) |
| Active Connection holen | `useActiveConnection()` aus `@/features/connections/hooks` |
| Fehler-Wrapping einer Action | `withJetStream(config, "opName", async ({js, jsm}) => {...})` |
| Neue NATS Auth-Art | `NatsConnectionConfig` in `types/nats.ts` + `connect-dialog.tsx` |
| Farbpalette pro Domain | `.claude/project.md` → Farbpalette |
| Sidebar-Navigation | `src/components/layout/app-sidebar.tsx` |
| Confirm-Dialog öffnen | `useConfirm()` aus `@/components/providers/confirm-provider` |
| Toast | `toast()` aus `sonner` (Provider in `root-provider.tsx`) |
