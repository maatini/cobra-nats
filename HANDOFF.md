# HANDOFF — Cobra NATS Altlasten-Cleanup

**Stand:** 2026-10-24 (Cleanup, Lint-Sanierung und Warnungsbereinigung)
**Branch:** `main`
**Commits:** `dac07db` (Cleanup) · `ce8125d` (Lint/Typecheck) · `4d3fb5d` (HANDOFF)
**Working tree:** 18 Dateien geändert, Warnungsbereinigung **nicht committet**
**Produkt:** cobra-nats **0.7.0**

---

## Nächste Aufgabe

Entscheiden, ob die Warnungsbereinigung committet wird (Vorschlag: `refactor: clear all lint warnings`). Kein Commit ohne User-Freigabe.

Danach optional:

- CI-Job `npm run lint` + `npm run typecheck` neben `docker.yml` und `e2e.yml`.
- Unit-Test für den neuen `useLocalStorage`-Snapshot-Cache (bräuchte `@testing-library/react` + jsdom als neue Dev-Dependency).

---

## Umgesetzt (Wellen 1–3)

### Welle 1 — CrewAI entfernt
- `crewai/` komplett weg: `git rm -r crewai` (29 tracked) + `rm -rf` (~768 MB inkl. `.venv`/`output`).
- `mise.toml`: nur noch Node 22; `setup` = `npm install`; alle `crew*` Tasks und `CREWAI_*` raus; Kommentar Dockerfile → `node:22-alpine`.
- `.gitignore`: Python/CrewAI-Block raus. `.dockerignore`: `crewai` raus.
- `README.md`: CrewAI-Sektion, Python/uv, Tree-Eintrag entfernt.

### Welle 2 — Node 22 vereinheitlicht
- `devbox.json`: `nodejs_22@latest`; `devbox.lock` refresht (`devbox update nodejs_22@latest --no-install`; `devbox update nodejs` scheitert an der Paket-Key-Syntax).
- `.github/workflows/e2e.yml`: `node-version: "22"`.
- `@types/node`: `^22.20.5` (vorher `^26.6.5`), Lock aktualisiert.
- `README.md`: Prerequisites 22, Devbox-Skripte `nats:up` / `nats:info` / `ui:dev` / `ui:build` / `ui:start`.

### Welle 3 — tote Artefakte
- `src/components/ui/pagination.tsx` gelöscht (keine Imports); KB-Primitive-Liste und `.claude/agents/ui-shadcn-agent.md` angepasst. `modules/streams/responsibility.md` unverändert.
- `cobra_nats.png`: 8.983.701 → **374.503 Bytes**, 1600×873 (Pillow, LANCZOS + Blur/Unsharp + 88-Farben-Palette). Pfad/Name unverändert.
- Smoke-Specs `kv`/`os`/`streams`/`messaging` gelöscht; Checks nach `functional-kv` (Empty-Filter), `functional-streams` (Dialog-Defaults) und `functional-monitor` (Idle-Empty-State) portiert.
- `docs/knowledge-base/modules/testing/responsibility.md`: Smoke-Tabelle bereinigt, `devbox run nats:up`.
- `docs/knowledge-base/architecture/dependencies.md`: `tailwind-merge ^3.7.0`, `marked ^18.1.1` (OS-Preview), `shiki ^4.5.0`, `cmdk`-Nutzung auf `components/ui/command.tsx`.

**Abweichung zum alten Plan:** Der Create-Stream-Dialog defaultet auf Max Age `0` / `Hours` (nicht `7` / `Days`). Der Test prüft die echten Defaults und wechselt danach auf `7` / `Days`. `0` ist der NATS-Default (unbegrenzt) und bleibt so.

### Nachzug — Lint und Typecheck (`ce8125d`)

- `eslint.config.mjs`: `react-hooks/set-state-in-effect` auf `warn` (React-Compiler-Performance-Heuristik; die Hydration- und Connection-Reset-Muster sind bewusst).
- `src/features/monitor/monitor-view.tsx`: Rate-Window-Ref startet als `null` und wird beim ersten Gebrauch erzeugt; kein `Date.now()` mehr im Render.
- `src/hooks/use-server-action-query.ts`: `deps` werden zu `depsKey` serialisiert, Abhängigkeiten `[connection, enabled, depsKey]`. Caller übergeben aktuell keine `deps`.
- `scripts/verify-gha-security.mjs`: toter `USES_RE` entfernt; Parser liest `uses:` weiterhin über `mappingChildren`.
- `package.json`: `"typecheck": "tsc --noEmit"` — löst die lokale TypeScript-Version auf.

### Warnungsbereinigung (uncommitted, 18 Dateien)

Alle 21 Warnungen sind beseitigt (`eslint .` → 0 Probleme). Muster:

- **Hooks:** `useLocalStorage` und `useIsMobile` nutzen `useSyncExternalStore`. Der Snapshot-Cache ist pro Key am rohen localStorage-String verankert, damit `getSnapshot` referenzstabil bleibt. `theme-toggle` nutzt denselben Mechanismus für den Mounted-Flag.
- **React Hook Form:** `form.watch(...)` in vier Komponenten durch `useWatch({ control, name })` ersetzt. Dadurch kompiliert der React Compiler diese Komponenten wieder; zwei latent vorhandene Verstöße (impure ID-Erzeugung in `connect-dialog`, `setReplayBanner` im Effekt) mussten mitbehoben werden.
- **Datenansichten:** Loader sind in reinen Fetch (Rückgabe eines Snapshots) und `apply*`-Callback getrennt; der Effekt committet über `.then(apply*)`. Loading wird aus dem Scope abgeleitet, für den Daten vorliegen (`loadedFor`/`loadedScope`), statt im Effekt gesetzt. Das Plugin verfolgt `setState` durch `await` hindurch, akzeptiert Promise-Callbacks.
- **Abgeleiteter State:** `message-browser` leitet den Fokus aus der Nachrichtenliste ab, `dashboard-overview` Stats/History/Error aus einem connection-getaggten Snapshot, `http-monitoring-card` Data/Loading aus dem Request-Key, `connections/hooks` den Health-Status aus `connectionId`, `object-preview-sheet` `tooLarge` aus der Größe.
- **Monitor:** Das Trimmen des Buffers passiert im `onChange` des Buffer-Selects.
- **Preview-Sheet:** Der Inhalt ist als `PreviewBody` mit `key` extrahiert; Blob-URLs werden pro Effektlauf erzeugt und exakt so wieder freigegeben (vorher Leak durch stale Closure). Ein dokumentierter `no-img-element`-Disable bleibt für Blob-URLs.

Bewusste Verhaltensänderungen: kein Spinner-Flackern bei Hintergrund-Polls; Fehler und Daten sind pro Connection getrennt; ohne aktive Connection zeigt der Health-Badge `Disconnected` statt dauerhaft `Checking`; der manuelle Refresh der Monitoring-Karte zeigt weiterhin Spinner und deaktivierten Button (eigener `manualRefresh`-Flag).

---

## Verifikation (ausgeführt)

```text
npm run lint                                  → 0 Fehler, 0 Warnungen
npm run typecheck                             → 0 Fehler
./node_modules/.bin/vitest run                → 6 Dateien / 26 Tests grün
node scripts/verify-prompt-docs.mjs           → PASS: 80, FAIL: 0
node scripts/verify-gha-security.mjs          → PASS: 44, FAIL: 0
npm run build                                 → 15 Routen, erfolgreich
nats-server -js -p 4222 + Playwright chromium → 26/26 Tests grün (gesamte Suite)
Temporärer Browser-Spec (6 Checks, gelöscht)  → Monitor-Buffer-Trim + Dropped-Badge,
                                                Bild-Preview über blob:-URL, Theme-Toggle,
                                                mobiler Sidebar-Sheet, Topbar "Connected",
                                                varz-Metriken der Monitoring-Karte
```

Hinweise:
- `npx tsc` löst in dieser Umgebung den globalen TypeScript 4.6.3 auf und produziert falsche Parse-Fehler. `npm run typecheck` oder `./node_modules/.bin/tsc` benutzen.
- Playwright-Browser `chromium_headless_shell-1248` wurde lokal nachinstalliert.
- `rg` ist in dieser Shell ein grep-Wrapper; für `--glob` das grep-Tool nutzen.

---

## Bewusst behalten

- `.grok/` + `.claude/` Prompt-Stack (`.grok/agents` bleiben Symlinks)
- `docs/knowledge-base/` als Deep-Reference
- nats.js **v2.29** (v3 ist NO-GO)
- Credential-Trust / `localStorage` key `cobra-nats-storage`
- Cluster-Topology-Backlog, optionale Items in `docs/recommendations.md`
- `json-viewer` + `payload-viewer`, `NoConnectionAlert` + `NoConnectionBanner`
- `tests/connections.spec.ts`, `tests/settings.spec.ts`
