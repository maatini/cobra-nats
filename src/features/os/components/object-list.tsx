"use client";

import * as React from "react";
import type { OsObjectInfo } from "@/types/nats";
import { Download, Eye, Trash2, Copy, FileIcon, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface ObjectListProps {
    objects: OsObjectInfo[];
    /** Active prefix filter (e.g. "logs/"). Empty = root. */
    prefix?: string;
    /** Navigate into a folder prefix. */
    onEnterPrefix?: (prefix: string) => void;
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

/**
 * Split objects under `prefix` into immediate folders and leaf objects.
 */
function partitionByPrefix(objects: OsObjectInfo[], prefix: string) {
    const normalized = prefix.replace(/^\/+/, "");
    const folders = new Map<string, number>();
    const files: OsObjectInfo[] = [];

    for (const obj of objects) {
        if (normalized && !obj.name.startsWith(normalized)) continue;
        const rest = normalized ? obj.name.slice(normalized.length) : obj.name;
        if (!rest) continue;
        const slash = rest.indexOf("/");
        if (slash === -1) {
            files.push(obj);
        } else {
            const folderName = rest.slice(0, slash);
            const fullPrefix = `${normalized}${folderName}/`;
            folders.set(fullPrefix, (folders.get(fullPrefix) ?? 0) + 1);
        }
    }

    return {
        folders: [...folders.entries()]
            .map(([p, count]) => ({
                prefix: p,
                name: p.replace(normalized, "").replace(/\/$/, ""),
                count,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
    };
}

export function ObjectList({
    objects,
    prefix = "",
    onEnterPrefix,
    onDownload,
    onDelete,
    onPreview,
}: ObjectListProps) {
    const handleCopyDigest = (digest: string) => {
        navigator.clipboard.writeText(digest);
        toast.success("Digest copied to clipboard");
    };

    const { folders, files } = React.useMemo(
        () => partitionByPrefix(objects, prefix),
        [objects, prefix]
    );

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

    if (folders.length === 0 && files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-card/20">
                <Folder className="size-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-sm font-medium text-muted-foreground">
                    No objects under this prefix
                </h3>
                <p className="text-xs text-muted-foreground/70 mt-1 font-mono">{prefix || "/"}</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border border-border bg-card/50 overflow-hidden">
            <Table>
                <TableHeader className="bg-card">
                    <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-medium text-xs">Name</TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs">Meta</TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs text-right">
                            Size
                        </TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs text-right">
                            Chunks
                        </TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs">Digest</TableHead>
                        <TableHead className="text-muted-foreground font-medium text-xs text-right">
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {folders.map((folder) => (
                        <TableRow
                            key={folder.prefix}
                            className="border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => onEnterPrefix?.(folder.prefix)}
                        >
                            <TableCell className="py-2.5 px-4" colSpan={2}>
                                <div className="flex items-center gap-2">
                                    <Folder className="size-3.5 text-amber-500/80" />
                                    <span className="font-mono text-xs text-foreground/90">
                                        {folder.name}/
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="text-[9px] border-border bg-background tabular-nums"
                                    >
                                        {folder.count}
                                    </Badge>
                                </div>
                            </TableCell>
                            <TableCell colSpan={4} className="text-xs text-muted-foreground">
                                Prefix folder
                            </TableCell>
                        </TableRow>
                    ))}
                    {files.map((obj) => {
                        const displayName = prefix
                            ? obj.name.slice(prefix.replace(/^\/+/, "").length)
                            : obj.name;
                        const metaCount = obj.metadata ? Object.keys(obj.metadata).length : 0;
                        return (
                            <TableRow
                                key={obj.name}
                                className="border-border/50 hover:bg-muted/50 transition-colors"
                            >
                                <TableCell className="py-2.5 px-4">
                                    <div className="flex items-center gap-2">
                                        <FileIcon className="size-3.5 text-cyan-500/60" />
                                        <span
                                            className="font-mono text-xs text-foreground/80"
                                            title={obj.name}
                                        >
                                            {displayName}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-2.5 px-4">
                                    {metaCount > 0 ? (
                                        <Badge
                                            variant="outline"
                                            className="text-[9px] border-cyan-500/30 text-cyan-400"
                                            title={JSON.stringify(obj.metadata)}
                                        >
                                            {metaCount} key{metaCount === 1 ? "" : "s"}
                                        </Badge>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground/50">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="py-2.5 px-4 text-right">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {formatBytes(obj.size)}
                                    </span>
                                </TableCell>
                                <TableCell className="py-2.5 px-4 text-right">
                                    <Badge
                                        variant="outline"
                                        className="text-[9px] border-border bg-background tabular-nums"
                                    >
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
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
