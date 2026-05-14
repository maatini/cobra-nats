"use client";

import * as React from "react";
import type { OsObjectInfo } from "@/types/nats";
import { Download, Eye, Trash2, Copy, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { toast } from "sonner";

interface ObjectListProps {
    objects: OsObjectInfo[];
    onDownload: (name: string) => void;
    onDelete: (name: string) => void;
    onPreview: (name: string) => void;
}

/** Format bytes to human-readable string. */
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ObjectList({ objects, onDownload, onDelete, onPreview }: ObjectListProps) {
    const handleCopyDigest = (digest: string) => {
        navigator.clipboard.writeText(digest);
        toast.success("Digest copied to clipboard");
    };

    if (objects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl bg-card/20">
                <FileIcon className="size-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No objects found</h3>
                <p className="text-sm text-muted-foreground/70 mt-2 max-w-sm">
                    Upload your first object to start storing files in this bucket.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-md border border-border bg-card/50 overflow-hidden">
            <Table>
                <TableHeader className="bg-card">
                    <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-medium text-xs">Name</TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs text-right">Size</TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs text-right">Chunks</TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs">Digest</TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {objects.map((obj) => (
                        <TableRow key={obj.name} className="border-border/50 hover:bg-muted/50 transition-colors">
                            <TableCell className="py-2.5 px-4">
                                <div className="flex items-center gap-2">
                                    <FileIcon className="size-3.5 text-cyan-500/60" />
                                    <span className="font-mono text-xs text-foreground/80">{obj.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-2.5 px-4 text-right">
                                <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(obj.size)}</span>
                            </TableCell>
                            <TableCell className="py-2.5 px-4 text-right">
                                <Badge variant="outline" className="text-[9px] border-border bg-background tabular-nums">
                                    {obj.chunks}
                                </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 px-4">
                                <button
                                    onClick={() => handleCopyDigest(obj.digest)}
                                    className="text-[10px] font-mono text-muted-foreground/70 hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Click to copy digest"
                                >
                                    {obj.digest.substring(0, 24)}…
                                    <Copy className="size-3" />
                                </button>
                            </TableCell>
                            <TableCell className="py-2.5 px-4 text-right">
                                <div className="flex items-center gap-1 justify-end">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-cyan-400"
                                        onClick={() => onPreview(obj.name)}
                                        title="Preview"
                                    >
                                        <Eye className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-cyan-400"
                                        onClick={() => onDownload(obj.name)}
                                        title="Download"
                                    >
                                        <Download className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                                        onClick={() => onDelete(obj.name)}
                                        title="Delete"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
