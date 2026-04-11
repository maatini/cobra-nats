"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Try to parse `value` as JSON. Returns the pretty-printed string and the
 * parsed value on success, or null when the input is not valid JSON.
 */
export function tryParseJson(value: string): { pretty: string; parsed: unknown } | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const first = trimmed[0];
    if (first !== "{" && first !== "[" && first !== '"') return null;
    try {
        const parsed: unknown = JSON.parse(trimmed);
        return { pretty: JSON.stringify(parsed, null, 2), parsed };
    } catch {
        return null;
    }
}

// Escape HTML-unsafe characters before wrapping tokens with <span>.
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Lightweight JSON syntax highlighter. Operates on an already pretty-printed
 * JSON string and wraps tokens in <span> elements with Tailwind color classes.
 * Intentionally simple — avoids a heavyweight dependency.
 */
function highlightJson(pretty: string): string {
    const escaped = escapeHtml(pretty);
    return escaped.replace(
        /("(\\.|[^"\\])*"\s*:)|("(\\.|[^"\\])*")|(\b-?\d+(\.\d+)?([eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g,
        match => {
            if (/^".*":$/.test(match)) {
                return `<span class="text-cyan-400">${match.slice(0, -1)}</span><span class="text-slate-500">:</span>`;
            }
            if (/^"/.test(match)) return `<span class="text-emerald-300">${match}</span>`;
            if (/true|false/.test(match)) return `<span class="text-amber-400">${match}</span>`;
            if (/null/.test(match)) return `<span class="text-rose-400">${match}</span>`;
            return `<span class="text-indigo-300">${match}</span>`;
        }
    );
}

interface JsonViewerProps {
    value: string;
    className?: string;
    /** Show a small "JSON" badge when the value is valid JSON. */
    showBadge?: boolean;
    /** Fallback class applied to non-JSON raw text rendering. */
    rawClassName?: string;
}

/**
 * Renders `value` as syntax-highlighted JSON when parseable; otherwise shows
 * the raw string verbatim. Safe to drop into any payload/value display.
 */
export function JsonViewer({ value, className, showBadge = false, rawClassName }: JsonViewerProps) {
    const result = React.useMemo(() => tryParseJson(value), [value]);
    const html = React.useMemo(
        () => (result ? highlightJson(result.pretty) : ""),
        [result]
    );

    if (!result) {
        return (
            <pre className={cn("font-mono text-xs whitespace-pre-wrap break-all", rawClassName ?? className)}>
                {value || <span className="text-slate-600 italic">(empty)</span>}
            </pre>
        );
    }

    return (
        <div className="space-y-2">
            {showBadge && (
                <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0 px-1.5"
                >
                    JSON
                </Badge>
            )}
            <pre
                className={cn("font-mono text-xs whitespace-pre-wrap break-words leading-relaxed", className)}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}
