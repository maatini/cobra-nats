# HANDOFF — Cobra NATS Altlasten-Cleanup

**Stand:** 2026-10-24 (Cleanup + Lint-Sanierung committet)
**Branch:** `main`
**Commits:** `dac07db` (Cleanup) · `ce8125d` (Lint/Typecheck)
**Working tree:** sauber; nur `HANDOFF.md` ist untracked
**Produkt:** cobra-nats **0.7.0**

---

## Nächste Aufgabe

Keine offene Pflicht. Optionale Kandidaten:

- Die 14 verbliebenen `react-hooks/set-state-in-effect`-Warnungen sauber lösen (`useSyncExternalStore` für `useLocalStorage`/`useIsMobile`, `key`-Remount statt Reset-Effekte). Aufwand 3–5 h mit E2E.
- Die zwei `exhaustive-deps`-Warnungen prüfen (`dashboard-overview.tsx:187`, `object-preview-sheet.tsx:139`).
- CI-Job `npm run lint` + `npm run typecheck` neben `docker.yml` und `e2e.yml`.
- `HANDOFF.md` ins Repo aufnehmen, falls Session-Kontinuität versioniert werden soll.

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

Restwarnungen (21, 0 Fehler): 14× `set-state-in-effect`, 4× `incompatible-library` (React Hook Form), 2× `exhaustive-deps`, 1× `no-img-element` (Blob-Preview).

---

## Verifikation (ausgeführt)

```text
npm run lint                                  → 0 Fehler, 21 Warnungen
npm run typecheck                             → 0 Fehler
./node_modules/.bin/vitest run                → 6 Dateien / 26 Tests grün
node scripts/verify-prompt-docs.mjs           → PASS: 80, FAIL: 0
node scripts/verify-gha-security.mjs          → PASS: 44, FAIL: 0
npm run build                                 → 15 Routen, erfolgreich
nats-server -js -p 4222 + Playwright chromium → 26/26 Tests grün (gesamte Suite)
Zusatzcheck Rate-Limit (temporärer Spec)      → 200 Nachrichten @ 10/s,
                                                "rate-limited"-Badge sichtbar
```

Hinweise:
- `npx tsc` löst in dieser Umgebung den globalen TypeScript 4.6.3 auf und produziert falsche Parse-Fehler. `npm run typecheck` oder `./node_modules/.bin/tsc` benutzen.
- `npm run lint` endet mit Exit 0; die 21 Warnungen sind bekannte React-Compiler- und RHF-Hinweise.
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
