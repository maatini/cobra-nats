# Context Management Rules

Überwache regelmäßig die Kontext-Nutzung.

Wenn die Auslastung **über 25%** liegt (sichtbar über `/context` oder `/session-info`), schlage proaktiv eine `/compact`-Aktion vor.

Gib dabei immer einen sinnvollen Hint mit, z. B.:

- „Wichtige Architektur-Entscheidungen, aktuelle TODOs und offene Tasks behalten“
- „Fokus auf aktuelle Feature-Implementierung und Code-Änderungen der letzten Turns“
- „Alle kritischen Entscheidungen und Datei-Änderungen der Session zusammenfassen“

**Sparsam:** maximal alle 8–12 Turns oder wenn wirklich nötig. Nicht vorher fragen — direkt vorschlagen.

`/compact` ist TUI-only; dem User den Befehl inkl. Hint anbieten, z. B.:

```text
/compact Wichtige Architektur-Entscheidungen, aktuelle TODOs und offene Tasks behalten
```

(Global mirror: `~/.grok/AGENTS.md` — gilt sessionübergreifend in allen Projekten.)
