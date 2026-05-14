"use client";

import * as React from "react";
import { Eye, Loader2, AlertTriangle, FileIcon, ImageIcon } from "lucide-react";
import { marked } from "marked";

import type { OsObjectInfo } from "@/types/nats";
import { useActiveConnection } from "@/features/connections/hooks";
import { getObjectContent, downloadObject } from "@/features/os/actions";
import { CodeViewer } from "@/components/ui/code-viewer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface ObjectPreviewSheetProps {
    bucket: string;
    object: OsObjectInfo | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkd"]);

function detectType(fileName: string): "image" | "markdown" | "code" {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (IMAGE_EXTENSIONS.has(ext)) return "image";
    if (MARKDOWN_EXTENSIONS.has(ext)) return "markdown";
    return "code";
}

function base64ToBlobUrl(base64: string, mime: string): string {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

const MIME_MAP: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    bmp: "image/bmp",
};

export function ObjectPreviewSheet({ bucket, object, open, onOpenChange }: ObjectPreviewSheetProps) {
    const activeConnection = useActiveConnection();
    const [content, setContent] = React.useState<{ text: string; binary: boolean } | null>(null);
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const fileType = object ? detectType(object.name) : "code";

    React.useEffect(() => {
        if (!open || !object || !activeConnection) {
            setContent(null);
            setImageUrl(null);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setContent(null);
        setImageUrl(null);

        if (fileType === "image") {
            // Fetch as base64 → blob URL for <img>
            downloadObject(activeConnection, bucket, object.name)
                .then((result) => {
                    if (cancelled) return;
                    if (result.success) {
                        const ext = object.name.split(".").pop()?.toLowerCase() ?? "png";
                        const mime = MIME_MAP[ext] || "image/png";
                        setImageUrl(base64ToBlobUrl(result.data.data, mime));
                    } else {
                        setError(result.error || "Failed to load image");
                    }
                    setLoading(false);
                })
                .catch((err) => {
                    if (cancelled) return;
                    setError(err instanceof Error ? err.message : "Unknown error");
                    setLoading(false);
                });
        } else {
            // Text-based: use getObjectContent
            getObjectContent(activeConnection, bucket, object.name)
                .then((result) => {
                    if (cancelled) return;
                    if (result.success) {
                        setContent({ text: result.data.text, binary: result.data.binary });
                    } else {
                        setError(result.error || "Failed to load content");
                    }
                    setLoading(false);
                })
                .catch((err) => {
                    if (cancelled) return;
                    setError(err instanceof Error ? err.message : "Unknown error");
                    setLoading(false);
                });
        }

        return () => {
            cancelled = true;
            // Revoke blob URL on cleanup
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [open, object?.name, bucket, activeConnection, fileType]);

    if (!object) return null;

    const ext = object.name.split(".").pop()?.toLowerCase() ?? "";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl lg:max-w-3xl flex flex-col p-0 gap-0 bg-background border-l border-border"
            >
                {/* Header */}
                <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <SheetTitle className="flex items-center gap-2 text-base">
                                {fileType === "image" ? (
                                    <ImageIcon className="size-4 text-cyan-500/60 shrink-0" />
                                ) : (
                                    <FileIcon className="size-4 text-cyan-500/60 shrink-0" />
                                )}
                                <span className="font-mono truncate">{object.name}</span>
                            </SheetTitle>
                            <SheetDescription className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{formatBytes(object.size)}</span>
                                <Badge variant="outline" className="text-[9px] border-border">
                                    {object.chunks} chunk{object.chunks !== 1 ? "s" : ""}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] border-cyan-500/20 text-cyan-500 bg-cyan-500/5">
                                    {fileType === "image" ? ext.toUpperCase() : fileType === "markdown" ? "MD" : "CODE"}
                                </Badge>
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {/* Content area */}
                <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                            <Loader2 className="size-8 animate-spin text-cyan-500/60" />
                            <span className="text-sm">Loading content…</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                            <AlertTriangle className="size-8 text-rose-400/60" />
                            <span className="text-sm">{error}</span>
                        </div>
                    ) : fileType === "image" && imageUrl ? (
                        <div className="flex items-center justify-center min-h-[300px] bg-[#0d1117] rounded-md border border-border">
                            <img
                                src={imageUrl}
                                alt={object.name}
                                className="max-w-full max-h-[calc(100vh-200px)] object-contain"
                            />
                        </div>
                    ) : content?.binary ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                                <AlertTriangle className="size-3.5 shrink-0" />
                                <span>Binary content — showing hex dump (first 4 KB)</span>
                            </div>
                            <CodeViewer
                                value={content.text}
                                fileName="hex.txt"
                                maxHeight="calc(100vh - 200px)"
                            />
                        </div>
                    ) : content && fileType === "markdown" ? (
                        <ScrollArea className="flex-1" style={{ maxHeight: "calc(100vh - 160px)" }}>
                            <div
                                className="prose prose-sm prose-invert max-w-none dark:prose-invert
                                    prose-headings:text-foreground prose-p:text-foreground/80
                                    prose-a:text-cyan-400 prose-strong:text-foreground
                                    prose-code:text-amber-400 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                                    prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-border
                                    prose-li:text-foreground/80
                                    prose-table:border prose-table:border-border
                                    prose-th:bg-muted prose-th:text-foreground prose-th:p-2
                                    prose-td:border-border prose-td:p-2"
                                dangerouslySetInnerHTML={{
                                    __html: marked.parse(content.text, { async: false }) as string,
                                }}
                            />
                        </ScrollArea>
                    ) : content ? (
                        <CodeViewer
                            value={content.text}
                            fileName={object.name}
                            maxHeight="calc(100vh - 160px)"
                        />
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
}

/** Small trigger button that opens the sheet for a specific object. */
export function PreviewButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-cyan-400"
            onClick={onClick}
            title="Preview"
        >
            <Eye className="size-3.5" />
        </Button>
    );
}
