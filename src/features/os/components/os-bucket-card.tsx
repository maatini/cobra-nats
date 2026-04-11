"use client";

import type { OsBucketInfo } from "@/types/nats";
import {
    HardDrive,
    Trash2,
    MoreVertical,
    Eye,
    Package,
    Hash
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OSBucketCardProps {
    bucket: OsBucketInfo;
    onDelete: (name: string) => void;
}

/** Format bytes to human-readable string. */
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function OSBucketCard({ bucket, onDelete }: OSBucketCardProps) {
    const router = useRouter();
    return (
        <Card
            onClick={() => router.push(`/os/${bucket.bucket}`)}
            className="bg-card border-border hover:border-cyan-500/50 transition-colors group cursor-pointer"
        >
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="rounded-md bg-cyan-500/10 p-2 shrink-0">
                        <HardDrive className="size-5 text-cyan-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg text-foreground truncate" title={bucket.bucket}>
                            {bucket.bucket}
                        </CardTitle>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                            OBJ_{bucket.bucket}
                        </div>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border text-foreground" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem asChild className="focus:bg-cyan-600">
                            <Link href={`/os/${bucket.bucket}`} className="flex items-center gap-2 cursor-pointer">
                                <Eye className="size-4" />
                                View Objects
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDelete(bucket.bucket); }}
                            className="flex items-center gap-2 text-rose-500 focus:bg-rose-600 focus:text-white cursor-pointer"
                        >
                            <Trash2 className="size-4" />
                            Delete Bucket
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="size-3" />
                            Objects
                        </div>
                        <div className="text-lg font-semibold text-foreground tabular-nums">
                            {bucket.objectCount.toLocaleString()}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Package className="size-3" />
                            Size
                        </div>
                        <div className="text-lg font-semibold text-foreground tabular-nums">
                            {formatBytes(bucket.size)}
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Replicas: {bucket.replicas}</span>
                    <div className="flex items-center gap-2">
                        {bucket.sealed && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/5 px-1 py-0 h-4">
                                Sealed
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] border-border bg-background px-1 py-0 h-4">
                            {bucket.storage === "file" ? "File" : "Memory"}
                        </Badge>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="pt-0">
                <Button
                    variant="secondary"
                    className="w-full bg-muted hover:bg-muted text-foreground/80 text-xs h-8"
                    asChild
                >
                    <Link href={`/os/${bucket.bucket}`}>
                        Browse Objects
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
