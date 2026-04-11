"use client";

import type { KvStatus } from "nats";
import { StorageType } from "@/types/nats";
import {
    Database,
    Trash2,
    MoreVertical,
    Eye,
    Clock,
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

interface KVBucketCardProps {
    status: KvStatus;
    onDelete: (name: string) => void;
}

export function KVBucketCard({ status, onDelete }: KVBucketCardProps) {
    const router = useRouter();
    return (
        <Card
            onClick={() => router.push(`/kv/${status.bucket}`)}
            className="bg-card border-border hover:border-emerald-500/50 transition-colors group cursor-pointer"
        >
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="rounded-md bg-emerald-500/10 p-2 shrink-0">
                        <Database className="size-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg text-foreground truncate" title={status.bucket}>
                            {status.bucket}
                        </CardTitle>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                            KV_{status.bucket}
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
                        <DropdownMenuItem asChild className="focus:bg-emerald-600">
                            <Link href={`/kv/${status.bucket}`} className="flex items-center gap-2 cursor-pointer">
                                <Eye className="size-4" />
                                View Keys
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDelete(status.bucket); }}
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
                            Values
                        </div>
                        <div className="text-lg font-semibold text-foreground tabular-nums">
                            {status.values.toLocaleString()}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Clock className="size-3" />
                            History
                        </div>
                        <div className="text-lg font-semibold text-foreground tabular-nums">
                            {status.history}
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Replicas: {status.replicas}</span>
                    <Badge variant="outline" className="text-[10px] border-border bg-background px-1 py-0 h-4">
                        {(status.storage as unknown as StorageType) === StorageType.File ? "File" : "Memory"}
                    </Badge>
                </div>
            </CardContent>
            <CardFooter className="pt-0">
                <Button
                    variant="secondary"
                    className="w-full bg-muted hover:bg-muted text-foreground/80 text-xs h-8"
                    asChild
                >
                    <Link href={`/kv/${status.bucket}`}>
                        Manage Keys
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
