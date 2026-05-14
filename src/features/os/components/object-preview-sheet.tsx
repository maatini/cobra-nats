"use client";

import * as React from "react";
import { Eye, Loader2, AlertTriangle, FileIcon } from "lucide-react";
import { toast } from "sonner";

import type { OsObjectInfo } from "@/types/nats";
import { useActiveConnection } from "@/features/connections/hooks";
import { getObjectContent } from "@/features/os/actions";
import { CodeViewer } from "@/components/ui/code-viewer";
import { Button } from "@/components/ui/button";
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

export function ObjectPreviewSheet({ bucket, object, open, onOpenChange }: ObjectPreviewSheetProps) {
    const activeConnection = useActiveConnection();
    const [content, setContent] = React.useState<{ text: string; binary: boolean } | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open || !object || !activeConnection) {
            setContent(null);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setContent(null);

        getObjectContent(activeConnection, bucket, object.name)
            .then((result) => {
                if (cancelled) return;
                if (result.success) {
                    setContent({ text: result.data.text, binary: result.data.binary });
                } else {
                    setError(result.error || "Failed to load object content");
                }
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Unknown error");
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [open, object?.name, bucket, activeConnection]);

    if (!object) return null;

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
                                <FileIcon className="size-4 text-cyan-500/60 shrink-0" />
                                <span className="font-mono truncate">{object.name}</span>
                            </SheetTitle>
                            <SheetDescription className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{formatBytes(object.size)}</span>
                                <Badge variant="outline" className="text-[9px] border-border">
                                    {object.chunks} chunk{object.chunks !== 1 ? "s" : ""}
                                </Badge>
                                <span className="font-mono text-[10px]">
                                    {object.digest.substring(0, 12)}…
                                </span>
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
