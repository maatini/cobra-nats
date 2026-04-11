# Cobra NATS – Coding Rules

Du bist ein präziser Senior Fullstack-Entwickler mit tiefem NATS/JetStream-Wissen. Halte dich strikt an diese Regeln.

## Grundprinzipien

- **TypeScript strict** — keine `any`, keine `@ts-ignore`. Bei Drittbibliothek-Untypisierung: `unknown` + Narrowing.
- **Server-first** — NATS-Credentials und -Connections verlassen niemals den Server.
- **Feature-Isolation** — Code eines Domains lebt in `src/features/<domain>/`.
- **shadcn/ui strikt** — keine eigenen Button-/Input-Varianten. Add per CLI.

## Server Actions — Pflicht-Pattern

Jede Server Action folgt diesem Schema:

```ts
"use server";

import type { NatsConnectionConfig } from "@/types/nats";
import { withJetStream, type ActionResponse } from "@/lib/server-action";

export async function doSomething(
    config: NatsConnectionConfig,
    arg: string
): Promise<ActionResponse<{ result: string }>> {
    return withJetStream(config, "doSomething", async ({ js, jsm }) => {
        // Business Logic hier. Wirf Errors einfach — der Wrapper fängt sie ab.
        return { result: "ok" };
    });
}
```

**Regeln**:
- Erster Param ist **immer** `NatsConnectionConfig`.
- Rückgabe **immer** `ActionResponse<T>` (via Wrapper).
- `operationName` (String) wird für Fehler-Logging genutzt — sprechend benennen.
- Für reine Core-NATS-Operationen (publish, request): `withNatsConnection` statt `withJetStream`.

## Client-Komponenten — Pflicht-Pattern

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useActiveConnection } from "@/features/connections/hooks";
import { listStreams } from "@/features/streams/actions";
import { Button } from "@/components/ui/button";

export function StreamList() {
    const connection = useActiveConnection();
    const [loading, setLoading] = useState(false);

    async function refresh() {
        if (!connection) return;
        setLoading(true);
        const res = await listStreams(connection);
        if (!res.success) {
            toast.error(res.error);
            return;
        }
        // res.data ist typsicher
        setLoading(false);
    }
    // ...
}
```

**Regeln**:
- **Immer** `"use client"` bei Client-Components mit State/Effects/Handlers.
- **Immer** `useActiveConnection()` für den Zugriff auf die aktive Connection, nie direkt aus dem Store.
- **ActionResponse-Narrowing pflicht**: `if (!res.success) { toast.error(res.error); return; }` vor Zugriff auf `res.data`.
- **Toast auf Fehler**, nicht stillschweigend ignorieren.

## Import-Reihenfolge

```ts
// 1. React / Next
import { useState } from "react";
import Link from "next/link";

// 2. Drittbibliotheken
import { toast } from "sonner";

// 3. Types (mit `import type`)
import type { NatsConnectionConfig } from "@/types/nats";

// 4. Lib / Feature-Code
import { withJetStream } from "@/lib/server-action";
import { listStreams } from "@/features/streams/actions";
import { useActiveConnection } from "@/features/connections/hooks";

// 5. UI-Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
```

## Formulare

- **Immer** React Hook Form + Zod-Schema + `zodResolver`.
- Schema **neben der Komponente** definieren (nicht in extra Datei — bleibt zusammen).
- Shadcn-Form-Primitives (`FormField`, `FormItem`, `FormLabel`, `FormMessage`) verwenden.

## Do's & Don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Action pro Feature in `features/<d>/actions.ts` | Neue Datei `src/app/actions/*` anlegen |
| `import type { ... } from "@/types/nats"` | `nats-types` oder `NatsManager` Pfad |
| `withJetStream` / `withNatsConnection` | NatsManager direkt in einer Action aufrufen |
| Farbpalette pro Domain (amber/emerald/cyan) | Zufällige Farben, eigene CSS-Klassen |
| Fehler-Toast + `return` bei `!res.success` | `res.data!` (Non-null assertion) |
| `shadcn add ...` für neue Primitives | Button/Input selber schreiben |
| Playwright-Test für neue Features | Nur manuell klicken |
| Deutsche User-Texte / Labels | Englische Labels (Projekt ist DE) |

## Playwright

- Real NATS-Server auf `localhost:4222` (via `docker-compose up`).
- Connection-Setup via `page.evaluate()` → `localStorage.setItem("cobra-nats-storage", ...)`.
- Toast und Confirm-Dialog per `page.getByRole("dialog")` / `page.getByText(...)` handlen.
- Tests liegen flach in `tests/*.spec.ts`, **nicht** unter `tests/features/`.

## Kommentierung

- JSDoc auf **exportierten Server Actions** mit Zweck und ggf. Quirks (z. B. OS-Bucket-Workaround).
- **Kein** Was-Code-Tut-Kommentar bei selbst-sprechenden Funktionen.
- **Warum**-Kommentare bei NATS-spezifischen Workarounds pflicht (künftige Agenten verstehen sonst nicht, warum der Code so ist).
