"use client";

import * as React from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

/**
 * Map a file name (extension) to a shiki language identifier.
 * When the extension doesn't match, probes the content: JSON, XML, YAML, HTML.
 * Falls back to "text" for everything else.
 */
function detectLanguage(fileName: string, content: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const name = fileName.toLowerCase();

    const map: Record<string, string> = {
        // Markup / data
        json: "json",
        xml: "xml",
        html: "html",
        htm: "html",
        md: "markdown",
        markdown: "markdown",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        ini: "ini",
        cfg: "ini",
        conf: "ini",
        csv: "csv",
        bpmn: "xml",
        svg: "xml",

        // Scripting / programming
        js: "javascript",
        mjs: "javascript",
        cjs: "javascript",
        ts: "typescript",
        mts: "typescript",
        cts: "typescript",
        jsx: "javascript",
        tsx: "typescript",
        java: "java",
        py: "python",
        rb: "ruby",
        go: "go",
        rs: "rust",
        c: "c",
        h: "c",
        cpp: "cpp",
        hpp: "cpp",
        cc: "cpp",
        cxx: "cpp",
        cs: "csharp",
        swift: "swift",
        kt: "kotlin",
        scala: "scala",

        // Web
        css: "css",
        scss: "scss",
        less: "less",

        // Shell / config
        sh: "shellscript",
        bash: "shellscript",
        zsh: "shellscript",
        fish: "fish",
        ps1: "powershell",
        dockerfile: "dockerfile",
        makefile: "makefile",
        cmake: "cmake",

        // Data / query
        sql: "sql",
        graphql: "graphql",
        proto: "protobuf",

        // Other text
        txt: "text",
        log: "text",
        env: "text",
        editorconfig: "editorconfig",
    };

    if (map[ext]) return map[ext];
    // Dockerfile, Makefile etc. (no extension)
    if (map[name]) return map[name];

    // Content-based detection for key-value keys that lack a file extension
    const trimmed = content.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) return "xml";
    if (/^---\s*\n/.test(trimmed)) return "yaml";
    if (/^<!DOCTYPE\s+html/i.test(trimmed)) return "html";

    return "text";
}

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: ["github-dark-default"],
            langs: [
                "javascript",
                "typescript",
                "json",
                "html",
                "css",
                "xml",
                "markdown",
                "yaml",
                "python",
                "java",
                "go",
                "rust",
                "c",
                "cpp",
                "csharp",
                "sql",
                "shellscript",
                "toml",
                "ini",
                "dockerfile",
                "graphql",
                "protobuf",
                "text",
            ],
        });
    }
    return highlighterPromise;
}

interface CodeViewerProps {
    value: string;
    fileName?: string;
    className?: string;
    /** Max height of the scroll area. Default: "500px". */
    maxHeight?: string;
}

export function CodeViewer({ value, fileName, className, maxHeight = "500px" }: CodeViewerProps) {
    const [html, setHtml] = React.useState<string | null>(null);
    const lang = React.useMemo(
        () => detectLanguage(fileName || "unknown.txt", value),
        [fileName, value]
    );

    React.useEffect(() => {
        let cancelled = false;
        getHighlighter().then((highlighter) => {
            if (cancelled) return;
            const result = highlighter.codeToHtml(value, {
                lang,
                theme: "github-dark-default",
            });
            setHtml(result);
        });
        return () => {
            cancelled = true;
        };
    }, [value, lang]);

    const lineCount = value.split("\n").length;

    // While highlighting, show raw text
    if (html === null) {
        return (
            <div className={cn("relative rounded-md border border-border bg-[#0d1117]", className)}>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-[#161b22]">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        {lang}
                    </span>
                    <CopyButton value={value} silent />
                </div>
                <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all overflow-auto"
                    style={{ maxHeight }}
                >
                    {value}
                </pre>
            </div>
        );
    }

    return (
        <div className={cn("relative rounded-md border border-border bg-[#0d1117]", className)}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-[#161b22]">
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                    {lang} · {lineCount} {lineCount === 1 ? "line" : "lines"}
                </span>
                <CopyButton value={value} silent />
            </div>
            <ScrollArea style={{ maxHeight }} className="overflow-auto">
                <div
                    className="shiki-wrapper text-xs [&>pre]:!bg-transparent [&>pre]:p-4 [&>pre]:font-mono [&_code]:!bg-transparent [&_code]:font-mono [&_.line]:min-w-fit"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </ScrollArea>
        </div>
    );
}
