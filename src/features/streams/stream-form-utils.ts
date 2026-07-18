/**
 * Shared helpers for stream create/edit forms (max age, advanced fields, export).
 * Client-safe — no nats package imports.
 */

export const MAX_AGE_UNITS = {
    s: { label: "Seconds", ns: 1_000_000_000 },
    m: { label: "Minutes", ns: 60 * 1_000_000_000 },
    h: { label: "Hours", ns: 3600 * 1_000_000_000 },
    d: { label: "Days", ns: 86400 * 1_000_000_000 },
} as const;

export type MaxAgeUnit = keyof typeof MAX_AGE_UNITS;

export function nsToAgeFields(ns: number): { value: number; unit: MaxAgeUnit } {
    if (!ns || ns <= 0) return { value: 0, unit: "h" };
    for (const unit of ["d", "h", "m", "s"] as MaxAgeUnit[]) {
        const factor = MAX_AGE_UNITS[unit].ns;
        if (ns % factor === 0) {
            return { value: ns / factor, unit };
        }
    }
    return { value: Math.round(ns / MAX_AGE_UNITS.h.ns), unit: "h" };
}

export function ageToNs(value: number, unit: MaxAgeUnit): number {
    return value > 0 ? value * MAX_AGE_UNITS[unit].ns : 0;
}

/** Download a JSON blob in the browser. */
export function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
    }, 100);
}

/** Pick a stable, serializable stream config for export (nats-cli-ish). */
export function exportStreamConfig(config: Record<string, unknown>): Record<string, unknown> {
    const skip = new Set(["sealed"]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config)) {
        if (skip.has(k)) continue;
        if (v === undefined || v === null) continue;
        out[k] = v;
    }
    return out;
}
