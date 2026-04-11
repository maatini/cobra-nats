# Cobra NATS – Projekt-Kontext

**Version**: 0.2.0
**Ziel**: Die schnellste und schönste NATS/JetStream Verwaltungsoberfläche.

## Features & Routen

| Feature | Route | Feature-Ordner | Kurzbeschreibung |
|---|---|---|---|
| Dashboard | `/` | – | Server-Info, Connection-Übersicht, Quick-Stats |
| Streams | `/streams`, `/streams/[name]` | `features/streams/` | JetStream Streams + Consumers + Message-Browser |
| KV | `/kv`, `/kv/[bucket]` | `features/kv/` | Key-Value Buckets, Keys browsen, Put/Delete |
| Object Store | `/os`, `/os/[bucket]` | `features/os/` | OS-Buckets, Upload/Download/Seal |
| Publish | `/publish` | `features/publish/` | Publish + Request-Reply |
| Monitor | `/monitor` | – (UI nutzt `api/monitor` SSE) | Live-Subject-Monitor |
| Settings | `/settings` | `features/connections/` | Connections verwalten |

## NATS-Konventionen

Der Server legt für KV und OS automatisch Streams mit Prefix an:

| NATS-Typ | Stream-Prefix | Discovery |
|---|---|---|
| KV-Bucket `myBucket` | `KV_myBucket` | `listKVBuckets` filtert Streams auf `KV_` |
| Object Store `myOs` | `OBJ_myOs` | `listOSBuckets` filtert Streams auf `OBJ_` |

⚠️ **Nats.js Client-Bug Workaround** in `features/os/actions.ts::createOSBucket`: `opts.replicas` muss non-enumerable gesetzt werden, sonst landet das Feld ungemappt im Raw-Stream-Config (Server rejektet). Kommentar im Code nicht entfernen.

## Connection-Management

- **Store**: `src/features/connections/store.ts` (Zustand + `persist`, localStorage-Key `cobra-nats-storage`).
- **Aktive Connection**: `useActiveConnection()` Hook.
- **Auth-Arten**: `none` | `user_pass` | `token`.
- **Singleton Pool**: `natsManager` in `src/lib/nats/manager.ts` — hält NC, JSM und JS pro Connection-ID.
- **Monitor-Connection**: Nutzt eine **eigene** Connection (`monitor-${id}-${ts}`), um nicht mit anderen Operations zu kollidieren.

## Farbpalette (Design-System)

| Domain | Tailwind-Farbe |
|---|---|
| Allgemein / Layout | `indigo` |
| Streams / Consumers | `amber` |
| Key-Value | `emerald` |
| Object Store | `cyan` |
| Destruktiv / Fehler | `red` (shadcn default) |

shadcn/ui **New York Style** mit Tailwind v4. Tailwind-Config in `globals.css` (v4 inline).

## Tech-Versionen (Stand v0.2.0)

- Next.js **16.1.6** (App Router)
- React **19.2.3**
- TypeScript **^5** (strict)
- `nats` **^2.29.3**
- Tailwind **v4**
- `zustand` **^5**
- `@tanstack/react-query` **^5.90**, `@tanstack/react-table` **^8.21**
- `react-hook-form` **^7.71** + `zod` **^4.3** + `@hookform/resolvers` **^5**
- Playwright **^1.58**

## Entwicklungs-Setup

- NATS-Server: `docker-compose up` (Port 4222, monitor 8222)
- Dev: `npm run dev` (Port 3000)
- Devbox: `devbox shell` (Node, NATS CLI vorinstalliert)

## Externe Referenzen

- NATS JetStream Client Docs: https://github.com/nats-io/nats.js
- shadcn/ui New York: https://ui.shadcn.com/docs
