# CLAUDE.md – Cobra NATS

**Was**: Web-UI für NATS/JetStream (Streams, Consumers, KV, Object Store, Publish/Request, Live-Monitor).
**Stack**: Next.js 16 App Router · React 19 · TypeScript 5 strict · Tailwind v4 · shadcn/ui (New York) · Zustand · Playwright · `nats` v2.29.

## Projektstruktur (Kurzfassung)

```
src/
├── app/                    # Next.js Routing + Layouts. Nichts anderes hier rein!
│   ├── (dashboard)/        # Alle User-Seiten (streams, kv, os, publish, monitor, settings)
│   └── api/monitor/        # Einziger REST-Endpoint (SSE für Live-Monitor)
│
├── features/               # Domain-Module — ALLES zu einem Feature an EINEM Ort
│   ├── connections/        # NATS-Verbindungs-Store, Hook, Actions, Connect-Dialog
│   ├── streams/            # Streams + Consumers + Stats (actions.ts ist konsolidiert)
│   ├── kv/                 # Key-Value Buckets
│   ├── os/                 # Object Store Buckets + Upload/Download
│   └── publish/            # Publish + Request-Reply Actions
│
├── components/
│   ├── ui/                 # shadcn primitives — NIE direkt editieren, per `shadcn add`
│   ├── layout/             # app-weite Layout-Komponenten (Sidebar, Topbar)
│   └── providers/          # Root-Provider, Confirm-Provider
│
├── lib/
│   ├── nats/manager.ts     # Singleton Connection-Pool (NatsManager)
│   ├── server-action.ts    # withNatsConnection / withJetStream / ActionResponse
│   └── utils.ts            # cn() und generische Helpers
│
├── hooks/use-mobile.ts     # Nur app-weite Hooks
└── types/nats.ts           # Alle geteilten Domain-Types (NatsConnectionConfig, StreamMessage, ...)
```

## Kernregeln (Pflicht)

1. **Alle NATS-Operationen laufen über Server Actions** in `src/features/<domain>/actions.ts`. Credentials niemals an den Client.
2. **Jede Action nutzt `withNatsConnection` oder `withJetStream`** aus `@/lib/server-action` und gibt `ActionResponse<T>` zurück.
3. **Feature-Isolation**: UI, Actions, Store und Types eines Features liegen in `src/features/<domain>/`. Kein Cross-Feature-Import ohne Grund.
4. **Types zentral**: Domain-Types gehören in `src/types/nats.ts`, nicht pro Feature verteilt.
5. **shadcn/ui strikt**: Neue UI nur mit shadcn-Komponenten (New York Style). Keine eigenen Button-Varianten.
6. **TypeScript strict + Zod**: Alle Formulare mit React Hook Form + Zod-Schema.
7. **Playwright-Tests** für neue Features unter `tests/`.

## Standard-Imports (cheat-sheet)

```ts
import type { NatsConnectionConfig, StreamMessage } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";
import { useActiveConnection } from "@/features/connections/hooks";
import { useNatsStore } from "@/features/connections/store";
import { Button } from "@/components/ui/button";
```

## Weiterführende Doku

- **`.claude/architecture.md`** — "Wo liegt was?" + Feature-Blaupause für neue Features
- **`.claude/project.md`** — Feature-Map, Routen, Farbpalette, NATS-Konventionen
- **`.claude/rules.md`** — Do's & Don'ts mit Code-Beispielen
- **`.claude/agents/*.md`** — Spezialisierte Agent-Profile
