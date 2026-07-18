# Sinnvolle Verbesserungen & Erweiterungen — Cobra NATS

**Stand:** Codebase v0.5.2 (Analyse gegen Tree nach Commit `8ed30f0`)  
**Art:** Priorisierte Empfehlung für spätere Umsetzung — **kein Implementierungsplan pro PR**  
**Methode:** Live-Tree unter `src/features/**`, `src/types/nats.ts`, `src/lib/nats/manager.ts`, Routes, README + Knowledge Base; Spot-Check der „fehlenden“ Ops gegen exportierte Server Actions.

> Bei Umsetzung: Architektur-Constraints aus `CLAUDE.md` / `docs/knowledge-base/` einhalten (NATS nur serverseitig; Server Actions + Wrapper; SSE/Multipart nur als bewusste Ausnahmen).

---

## 1. Baseline — was heute schon funktioniert

Cobra NATS ist bereits eine brauchbare Admin-UI für den Alltagsbetrieb, solange Auth einfach und Ops „create/list/delete“ genügen.

| Domain | Route(s) | Heutige Capabilities (Server Actions / UI) |
|---|---|---|
| **Connections** | `/settings` | Mehrere Connections in `localStorage` (`cobra-nats-storage`); Auth `none` \| `user_pass` \| `token` \| `nkey` \| `jwt` \| `creds`; optional TLS PEMs; Test-Connect, Ping/RTT, Edit/Delete |
| **Dashboard** | `/` | Server-Name/Version, JetStream-Flag, Stream-Count, KV-Bucket-Count, Auto-Refresh |
| **Streams** | `/streams`, `/streams/[name]` | List/Create/Delete, Info (Config+State), Message Browser (Seq-Range, Subject-Filter, Batch) |
| **Consumers** | (Stream-Detail) | List/Create (push/pull, durable, ack/deliver policy, ack_wait, max_deliver, filter_subject)/Delete; aggregierte Stats (pending/ack) |
| **KV** | `/kv`, `/kv/[bucket]` | List/Create/Delete Bucket; Keys list; Get/Put/Delete Entry; History-**Config** beim Create; Revision-Anzeige des aktuellen Entries |
| **Object Store** | `/os`, `/os/[bucket]` | List/Create/Delete Bucket; List/Upload/Download/Delete/Preview Objects; **Sealed-Status anzeigen** (Badge) |
| **Publish** | `/publish` | Publish + Request-Reply, Headers, Subject-History |
| **Monitor** | `/monitor` | SSE Live-Subscribe, Pause, Expand, Copy, JSON-Export (letzte 500 Msgs) |
| **UX** | global | Command Palette, Shortcuts, Breadcrumbs, Dark/Light, No-Connection Banner, Auto-Refresh, URL-State |

**Server-Boundary (Architektur, nicht ändern ohne bewusste Entscheidung):**

- NATS läuft nur serverseitig (`nats` nie im Browser).
- Default: Server Actions + `withNatsConnection` / `withJetStream`.
- Ausnahmen: `POST /api/monitor` (SSE, Config im Body), `POST /api/os/upload` (Multipart), `POST /api/os/download` (Streaming).

**Explizite Lücken (Spot-Check zum Analyse-Zeitpunkt):**

- Kein `updateStream` / `streams.update`, kein Stream-`purge`, kein Message-Delete by seq.
- Kein `updateConsumer` / Consumer-Detail-UI.
- Kein `kv.history` / History-Liste; UI-Copy spricht trotzdem von „revision history“.
- Kein `seal()`-Action für OS (README/KB behaupten Seal; Code zeigt nur Status).
- Auth nur `none|user_pass|token`; Manager setzt weder TLS-Client-Optionen noch nkey/JWT/creds.
- Monitor-SSE: `authType: "none"` hardcodiert; Credentials/Auth kommen nicht über die Query.

---

## 2. Priorisierungs-Legende

| Priorität | Bedeutung |
|---|---|
| **Hoch** | Admin-Alltag blockiert oder Produkt-Claim falsch; klarer JetStream-Ops-Gap |
| **Mittel** | Deutlich bessere Produktivität / Deploy-Realität; nicht blockierend |
| **Niedrig** | Nice-to-have / Produktwachstum |

| Effort | Grober Umfang |
|---|---|
| **S** | ≤ ~1–2 Tage (1 Action + dünne UI, Bugfix) |
| **M** | ~3–7 Tage (mehrere Actions, Formulare, Detail-Views) |
| **L** | > 1 Woche (neues Subsystem, Auth-Modelle, Monitoring-Surface) |

Unterscheidung:

- **Must-have Admin-Gaps** — ohne die bleibt die UI hinter `nats`-CLI / echten Ops zurück.
- **Nice-to-have Growth** — differenzieren oder skalieren, nicht kritisch für v0.x.

---

## 3. Empfehlungen nach Domain

### 3.1 Streams / Consumers — Must-have Admin

#### S1 · Stream-Konfiguration bearbeiten (`updateStream`)

| | |
|---|---|
| **Problem** | Heute nur Create + Delete + Read-only Info. Limits (max_msgs/bytes/age), Subjects, Discard usw. lassen sich nach dem Anlegen nicht ändern. |
| **Warum** | Production-Admin ändert Limits und Subjects ständig; Delete+Recreate vernichtet Daten. JetStream unterstützt `jsm.streams.update`. |
| **Priorität** | **Hoch** · Effort **M** |
| **Hinweis** | Edit-Dialog aus Create-Dialog ableiten; Name immutable; Replica-Änderungen serverseitig restriktiv behandeln. |

#### S2 · Stream purge (optional subject/seq)

| | |
|---|---|
| **Problem** | Kein Purge — nur volles Stream-Delete. |
| **Warum** | Klassische Ops: Queue leeren, Test-Daten wischen, Workqueue abarbeiten ohne Stream-Lifecycle. |
| **Priorität** | **Hoch** · Effort **S** |
| **Hinweis** | Starke Confirm-UX (wie Delete); optional Subject-Filter und `seq`/`keep`. |

#### S3 · Einzelne Messages löschen (by sequence)

| | |
|---|---|
| **Problem** | Message Browser ist read-only; keine `deleteMessage`. |
| **Warum** | Gezielte Bereinigung (Poison-Messages, Compliance) ohne Purge des ganzen Streams. |
| **Priorität** | **Mittel** · Effort **S** |

#### S4 · Consumer-Detail + Update

| | |
|---|---|
| **Problem** | Consumers: List-Zeile + Create + Delete. Kein Detail-Sheet (filter, ack_wait, max_deliver, delivered/ack floor, redelivered) und kein Update. „Last Active“ zeigt faktisch `created` (irreführend). |
| **Warum** | Debugging von Backlog/Ack-Lag ist Kernaufgabe einer JetStream-UI. |
| **Priorität** | **Hoch** · Effort **M** |

#### S5 · Create-Formulare: fortgeschrittene Stream/Consumer-Felder

| | |
|---|---|
| **Problem** | Stream-Create deckt Basics ab, nicht: compression, duplicate_window, deny_delete/purge, allow_rollup, mirror/sources, placement, republish, max_msg_size, discard_new_per_subject. Consumer: keine filter_subjects[], backoff, max_ack_pending, inactive_threshold, headers_only, sample_freq, flow_control, idle_heartbeat. |
| **Warum** | Ohne das ist Create unvollständig für fortgeschrittene Deployments; Update (S1/S4) sollte dieselben Felder teilen. |
| **Priorität** | **Mittel** · Effort **M–L** (gestaffelt: zuerst „Advanced“-Accordion mit 5–8 häufigsten Feldern) |

#### S6 · Mirror / Source Streams (Anzeigen + Create)

| | |
|---|---|
| **Problem** | Keine UI für Mirror/Sources — in Multi-Cluster/Leaf-Szenarien zentral. |
| **Warum** | Replication-Topologie ohne CLI schwer zu verstehen. |
| **Priorität** | **Niedrig–Mittel** · Effort **L** (Growth, aber echtes JetStream-Feature) |

---

### 3.2 Key-Value — Must-have Admin

#### K1 · Revision History pro Key (`kv.history`)

| | |
|---|---|
| **Problem** | Bucket kann `history > 1` haben; Detail zeigt nur aktuellen Entry. Empty-State-Text verspricht „revision history“, es gibt aber keine Action. |
| **Warum** | History ist der Hauptgrund für KV-Revisions; Rollback/Audit sonst nur per CLI. |
| **Priorität** | **Hoch** · Effort **S–M** |
| **Hinweis** | Liste Revisionen + Wert-Diff/View; optional „Restore this revision“ via Put. |

#### K2 · Purge Key (vs soft delete) + optional Bucket-Purge-Keys

| | |
|---|---|
| **Problem** | Nur `kv.delete` (Tombstone); kein `purge` (History hart entfernen). |
| **Warum** | Ops/Compliance: History und Platz freigeben. |
| **Priorität** | **Mittel** · Effort **S** |

#### K3 · Watch / Live-Updates im Bucket

| | |
|---|---|
| **Problem** | Keys nur per manuellem Refresh. |
| **Warum** | Nützlich, aber Monitor + Auto-Refresh decken viel ab. |
| **Priorität** | **Niedrig** · Effort **M** (SSE ähnlich Monitor; Architektur-Ausnahme nötig) |

#### K4 · Binary / non-UTF8 KV Values

| | |
|---|---|
| **Problem** | `entry.string()` — Binary/Base64 unhandlich. |
| **Warum** | Manche Apps speichern Protobuf/Bytes in KV. |
| **Priorität** | **Niedrig** · Effort **S** (Hex/Base64-Toggle analog OS-Preview) |

---

### 3.3 Object Store

#### O1 · Seal Bucket als echte Action

| | |
|---|---|
| **Problem** | README und KB behaupten Seal; Code hat nur `sealed`-Status-Badge, **keine** `seal`-Action/Button. |
| **Warum** | Produkt-Claim falsch; Seal ist irreversibler OS-Lifecycle-Schritt. |
| **Priorität** | **Hoch** (Claim-Korrektheit) · Effort **S** |
| **Hinweis** | Entweder implementieren **oder** Docs/README ehrlich machen — beides besser als Status quo. |

#### O2 · Object-Metadaten setzen / umbenennen / Prefix-Browse

| | |
|---|---|
| **Problem** | Upload speichert Name+Blob; wenig Metadaten-UX, keine Folder/Prefix-Navigation. |
| **Warum** | Bei vielen Objects wird flache Liste unbrauchbar. |
| **Priorität** | **Mittel** · Effort **M** |

#### O3 · Große Downloads / Streaming

| | |
|---|---|
| **Problem** | Download via Action + Base64 im Memory — skaliert schlecht. Upload hat bereits Multipart-Route. |
| **Warum** | Große Artefakte (Logs, Snapshots) sprengen RSC/Action-Payloads. |
| **Priorität** | **Mittel** · Effort **M** (eigene Download-Route analog Upload) |

---

### 3.4 Auth / Connections — Must-have für echte Deployments

#### A1 · TLS-Verbindungen sauber unterstützen

| | |
|---|---|
| **Problem** | Manager übergibt nur `servers/user/pass/token`. Error-Mapping erwähnt TLS, aber es gibt keine Client-TLS-Optionen (CA, cert, key, `tls://` mit trust). |
| **Warum** | Fast jede Production-NATS ist TLS; ohne das bleibt die UI Dev-Tool. |
| **Priorität** | **Hoch** · Effort **M** |
| **Hinweis** | Server-seitig Dateipfade oder PEM in Connection-Config; **niemals** private keys unnötig ins Browser-Bundle — Config darf in localStorage liegen, muss aber bewusst behandelt werden (siehe A3). |

#### A2 · NKey / JWT / `.creds`-Datei

| | |
|---|---|
| **Problem** | Auth-Enum endet bei Token; decentralized Auth (Synadia Cloud, Operator-Modelle) unmöglich. |
| **Warum** | Moderne NATS-Deployments nutzen oft nkey/JWT/creds statt User/Pass. |
| **Priorität** | **Mittel–Hoch** (je nach Zielgruppe) · Effort **M–L** |
| **Hinweis** | Creds-Inhalt nur serverseitig parsen; Upload in Settings → serverseitiger Temp-Store **oder** verschlüsselte Persistenz — nicht als Query-Param. |

#### A3 · Credentials-Hygiene (localStorage + Monitor-URL)

| | |
|---|---|
| **Problem** | Passwords/Tokens liegen im Klartext in `localStorage`. Monitor baut SSE-URL mit `servers` in Query; Auth wird verworfen (`authType: "none"`). |
| **Warum** | Security + **funktionaler Bug**: Monitor funktioniert nicht gegen auth-pflichtige Server. |
| **Priorität** | **Hoch** · Effort **S–M** |
| **Hinweis** | Monitor: Connection aus Server-Pool anhand `connectionId` auflösen (wie andere Actions), **keine** Secrets in Query. Langfristig: optional session-side encrypted vault oder server-held connection profiles. |

#### A4 · Multi-Server / Cluster-URLs UX

| | |
|---|---|
| **Problem** | Servers als comma-string — ok, aber wenig Validierung/Feedback welches Node antwortet. |
| **Warum** | Kleiner UX-Gewinn. |
| **Priorität** | **Niedrig** · Effort **S** |

---

### 3.5 Ops / Observability

#### M1 · Monitor-Auth fix (Teil von A3)

| | |
|---|---|
| **Problem** | Hardcoded `authType: "none"` in `createMonitorStream`. |
| **Warum** | Feature ist auf offenen Dev-Servern begrenzt. |
| **Priorität** | **Hoch** · Effort **S** |

#### M2 · JetStream Account / Storage Overview

| | |
|---|---|
| **Problem** | Dashboard: nur Stream-Count + KV-Count; kein Account-Info (Speicher, Streams-Limit, API-Level, HA). |
| **Warum** | Erste Frage im Incident: „Wie voll ist JetStream?“ |
| **Priorität** | **Hoch** · Effort **S–M** (`jsm.getAccountInfo()` o.ä.) |

#### M3 · HTTP Monitoring Port (varz/jsz/connz) — optional

| | |
|---|---|
| **Problem** | Compose exponiert `:8222`, UI nutzt es nicht. |
| **Warum** | Server-CPU, Connections, Leafnodes, Gateway — jenseits JetStream-CRUD. |
| **Priorität** | **Mittel** · Effort **L** (neues Feature-Modul; **kein** Browser-NATS nötig — serverseitiges `fetch` auf Monitoring-URL) |
| **Hinweis** | Separate „Monitoring endpoint“ URL pro Connection; Auth für HTTP-Monitor oft anders als Client-Auth. |

#### M4 · System-Subjects / `$JS.EVENT` / Advisories

| | |
|---|---|
| **Problem** | Monitor kann `>` subscriben, aber keine vorgefertigten Advisory-Views. |
| **Warum** | Nützlich für Power-User; CLI deckt das ab. |
| **Priorität** | **Niedrig** · Effort **M** |

#### M5 · Consumer/Stream Metrics Charts

| | |
|---|---|
| **Problem** | Keine Zeitreihen; nur Punkt-in-Zeit-Zahlen. |
| **Warum** | Schön, aber speicher-/architekturlastig (Client-side samples oder Backend). |
| **Priorität** | **Niedrig** · Effort **L** |

---

### 3.6 Publish / Monitor UX

#### P1 · Publish aus Message Browser / Monitor („Replay“)

| | |
|---|---|
| **Problem** | Gesehene Messages manuell nach Publish kopieren. |
| **Warum** | Hoher Produktivitätshebel, wenig Backend. |
| **Priorität** | **Mittel** · Effort **S** |

#### P2 · Binary/JSON Schema hints, multipart headers UX

| | |
|---|---|
| **Problem** | Payload-Textarea + Header-KV ok, aber rohe UX. |
| **Warum** | Polish. |
| **Priorität** | **Niedrig** · Effort **S** |

#### P3 · Monitor: Filter, Rate-Limit, Backpressure UI

| | |
|---|---|
| **Problem** | Bei `>` und hohem Traffic: 500 Msgs Cap, Client kann überfluten. |
| **Warum** | Stabilität der UI. |
| **Priorität** | **Mittel** · Effort **S–M** |

---

### 3.7 Dashboard / UX / Productivity

#### U1 · Dashboard: OS-Count, Consumer-Totals, Account-Bytes

| | |
|---|---|
| **Problem** | OS fehlt in Overview; Stats dünn. |
| **Warum** | Ein-Blick-Lagebild. |
| **Priorität** | **Mittel** · Effort **S** |

#### U2 · Config Export/Import (Stream/Consumer/KV JSON)

| | |
|---|---|
| **Problem** | Keine Infra-as-Code-Brücke. |
| **Warum** | Drift zwischen Umgebungen; nats-CLI-kompatible JSON wäre stark. |
| **Priorität** | **Mittel** · Effort **M** |

#### U3 · Bessere Empty/Error-States & Claim-Sync (Docs)

| | |
|---|---|
| **Problem** | README ✓ Seal; KV „revision history“ ohne History; KB teils veraltet (z. B. React Query in Overview nach P0/P1-Refactor). |
| **Warum** | Vertrauen und Onboarding. |
| **Priorität** | **Mittel** · Effort **S** (reine Docs) |

#### U4 · Command Palette: Actions, nicht nur Navigation

| | |
|---|---|
| **Problem** | Palette navigiert; startet keine Ops (z. B. „Purge stream X“). |
| **Warum** | „Fastest UI“-Claim. |
| **Priorität** | **Niedrig–Mittel** · Effort **M** |

---

### 3.8 Platform / Quality

#### Q1 · DTO-Serialisierung für `nats`-Typen

| | |
|---|---|
| **Problem** | `StreamInfo`/`ConsumerInfo` fließen teils roh vom Server zum Client (Dates, enums). Funktioniert oft, ist aber fragil. |
| **Warum** | Stabilität, kleinere Payloads, klare Contract-Grenze. |
| **Priorität** | **Mittel** · Effort **M** (war P2 im Simplify-Audit) |

#### Q2 · date-fns footprint / native Intl

| | |
|---|---|
| **Problem** | `date-fns` nur für relative/absolute Times. |
| **Warum** | Bundle-Polish, nicht feature-kritisch. |
| **Priorität** | **Niedrig** · Effort **S** |

#### Q3 · ESLint-Setup reparieren

| | |
|---|---|
| **Problem** | `npm run lint` schlägt vorab fehl (eslint 10 / plugin-react). |
| **Warum** | CI-Qualität, Agent-Workflows. |
| **Priorität** | **Mittel** · Effort **S** |

#### Q4 · UI-Auth (Multi-User / Shared Deployment)

| | |
|---|---|
| **Problem** | App ist local-first; jeder Browser-User mit Netz-Zugriff auf den Next-Server kann Server Actions mit übergebenen Connection-Configs nutzen. |
| **Warum** | Shared Team-Deployment braucht Gate — **nicht** NATS im Browser, sondern App-Login vor Actions. |
| **Priorität** | **Niedrig** bis Bedarf · Effort **L** |

#### Q5 · Connection-Pool: Limits, Idle-Timeout, Reconnect-UX

| | |
|---|---|
| **Problem** | Singleton-Pool ohne sichtbare Lifecycle-Policy. |
| **Warum** | Long-running Server-Prozesse / viele Connections. |
| **Priorität** | **Niedrig–Mittel** · Effort **M** |

---

## 4. Empfohlene Reihenfolge (pragmatisch)

| Phase | Items | Ziel |
|---|---|---|
| **P0 — Fix & Trust** | M1 Monitor-Auth, O1 Seal (oder Docs ehrlich), U3 Claim-Sync, A3 Secrets-out-of-Query | Feature funktioniert + Claims stimmen |
| **P1 — Admin-Kern** | S2 Purge, S1 Stream-Update, K1 KV History, S4 Consumer-Detail, M2 Account-Info | Parität mit täglichen `nats`-CLI-Ops |
| **P2 — Deploy-Realität** | A1 TLS, A2 nkey/JWT/creds (gestaffelt), O3 Streaming-Download, S3 Msg-Delete, K2 Purge | Production-taugliche Connections |
| **P3 — Growth** | S5 Advanced fields, U2 Import/Export, M3 HTTP Monitoring, O2 Prefix-Browse, S6 Mirrors | Differenzierung vs. CLI |
| **P4 — Optional** | Charts, UI multi-user auth, Watch-SSE, Palette-Actions, Q1 DTOs | Skalierung / Polish |

### Umsetzungs-Checkliste (IDs)

Zum Abhaken bei späterer Arbeit:

**P0**

- [x] M1 — Monitor-Auth fix
- [x] A3 — Credentials-Hygiene (Monitor ohne Secrets in Query)
- [x] O1 — OS Seal Action **oder** Docs/README korrigieren
- [x] U3 — Claim-Sync Docs/README/KB

**P1**

- [x] S2 — Stream purge
- [x] S1 — Stream update
- [x] K1 — KV revision history
- [x] S4 — Consumer detail + update
- [x] M2 — JetStream account / storage overview

**P2**

- [x] A1 — TLS client support
- [x] A2 — NKey / JWT / creds
- [x] O3 — Streaming download route
- [x] S3 — Delete message by seq
- [x] K2 — KV purge key

**P3**

- [x] S5 — Advanced stream/consumer fields
- [x] U2 — Config import/export
- [x] M3 — HTTP monitoring (varz/jsz)
- [x] O2 — OS prefix browse / metadata
- [x] S6 — Mirror / source streams

**P3+ / P4 (optional)**

- [ ] U1 — Richer dashboard
- [ ] P1 — Replay publish
- [ ] P3 — Monitor backpressure
- [ ] Q1 — DTO serialization
- [ ] Q3 — ESLint fix
- [ ] U4 / M4 / M5 / K3 / K4 / A4 / Q2 / Q4 / Q5 — nach Bedarf

---

## 5. Explizite Non-Recommendations (bewusst aufschieben / vermeiden)

| Idee | Warum **nicht** (jetzt) |
|---|---|
| **`nats` im Browser / WebSocket-Client direkt aus der UI** | Verletzt ADR Server-Boundary; Credentials im Client; bricht Security-Modell. Nur als bewusste Architektur-Neuentwicklung. |
| **Credentials in SSE/Query-Strings erweitern** | Monitor macht `servers` schon falsch; Secrets in URLs (Logs, Referrer) sind Anti-Pattern. Stattdessen server-side Pool by `connectionId`. |
| **Vollständige Parität mit Synadia Control Plane / NATS Surveyor** | Scope-Explosion; Cobra gewinnt durch Fokus und Speed, nicht Feature-Checklisten-Parität. |
| **Stack-Rewrite** (anderes Framework, GraphQL-Gateway, Microservices) | Kein ROI bei v0.5; Architektur ist schlank und passt. |
| **Deutsche Product-UI** | Tooling/Admin-Englisch ist Standard; Lokalisierung erhöht Pflegekosten ohne Kernnutzen. |
| **React Query „zurückbringen“ ohne Bedarf** | Gerade bewusst entfernt; `useServerActionQuery` deckt List-Fetch ab. |
| **Eigene Button/Input-Primitives statt shadcn** | Projektregel; Design-Drift. |
| **Ephemeral Consumer-Management als erstes großes Feature** | Durable CRUD + Detail bringt mehr Ops-Wert. |
| **Vollständiges Cluster/Leafnode-Topologie-UI vor TLS/Auth** | Ohne sichere Connection ist Topologie-Show nutzlos für echte Server. |
| **Message-Schema-Registry / Kafka-ähnliche Features** | Außerhalb NATS-Kern; anderes Produkt. |

---

## 6. Kurzfazit

Cobra NATS ist **strukturell gesund** (Feature-Module, Server Actions, dünne Pages) und deckt den **Happy Path Create/Browse/Delete** gut ab. Die größten sinnvollen Schritte sind **nicht** neue Domains, sondern:

1. **Ops-Tiefe** auf bestehenden Domains (Stream update/purge, Consumer detail, KV history, OS seal),
2. **Auth/Monitor-Realität** (TLS, nkey/JWT, Monitor mit echter Connection-Auth),
3. **Ehrliche Surface** (Docs/README an Code angleichen),
4. danach **Growth** (Import/Export, HTTP-Monitor, Mirrors).

Das maximiert Nutzen pro Effort und respektiert die Architektur-Constraints (NATS bleibt serverseitig; SSE/Multipart nur als bewusste Ausnahmen).

---

## 7. Spot-Check-Nachweis (Analyse-Zeitpunkt)

| Claim „fehlt“ | Befund |
|---|---|
| `updateStream` / purge / deleteMessage | Keine entsprechenden Actions in `src/features/streams` |
| `updateConsumer` | Keine Action |
| `kv.history` / History-API | Nur `status.history` Config + UI-Copy; kein History-Fetch |
| OS `seal` Action | Nur `sealed` Status; README/KB behaupten Seal |
| Auth | `authType: "none" \| "user_pass" \| "token"` only |
| Monitor Auth | `authType: "none"` hardcodiert in `src/features/monitor/stream.ts` |

**Existierende Stream-Actions zum Analyse-Zeitpunkt:** `listStreams`, `createStream`, `deleteStream`, `getStreamInfo`, `getStreamMessages`, `listConsumers`, `createConsumer`, `deleteConsumer`, `getStreamConsumerStats`.

> Vor Umsetzung einer ID kurz gegen den aktuellen Tree re-checken — diese Datei altert, der Code nicht.
