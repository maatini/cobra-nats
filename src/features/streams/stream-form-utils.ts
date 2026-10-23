/**
 * Shared helpers for stream create/edit forms (max age, advanced fields, export/import).
 * Client-safe — no nats package imports.
 */

import { z } from "zod";

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

/** Supported configuration fields for JSON import. This is configuration only, not message backup. */
export const StreamConfigImportSchema = z.object({
    name: z.string().trim().min(1).max(255),
    subjects: z.array(z.string()).optional(),
    retention: z.enum(["limits", "interest", "workqueue"]).optional(),
    storage: z.enum(["file", "memory"]).optional(),
    max_consumers: z.number().int().optional(),
    max_msgs: z.number().int().optional(),
    max_bytes: z.number().int().optional(),
    max_age: z.number().nonnegative().optional(),
    max_msgs_per_subject: z.number().int().optional(),
    max_msg_size: z.number().int().optional(),
    discard: z.enum(["old", "new"]).optional(),
    discard_new_per_subject: z.boolean().optional(),
    num_replicas: z.number().int().min(1).max(5).optional(),
    description: z.string().optional(),
    duplicate_window: z.number().nonnegative().optional(),
    compression: z.enum(["none", "s2"]).optional(),
    allow_rollup_hdrs: z.boolean().optional(),
    deny_delete: z.boolean().optional(),
    deny_purge: z.boolean().optional(),
    allow_direct: z.boolean().optional(),
    mirror_direct: z.boolean().optional(),
    mirror: z.record(z.string(), z.unknown()).optional(),
    sources: z.array(z.record(z.string(), z.unknown())).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
});

export type StreamConfigImport = z.infer<typeof StreamConfigImportSchema>;
