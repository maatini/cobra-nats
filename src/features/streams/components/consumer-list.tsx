"use client";

import type { ConsumerInfoDto } from "@/types/nats";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CreateConsumerDialog } from "./create-consumer-dialog";

function lastActiveLabel(c: ConsumerInfoDto): string {
    if (c.ts) {
        try {
            return formatDistanceToNow(new Date(c.ts), { addSuffix: true });
        } catch {
            // fall through
        }
    }
    const nanos = c.delivered?.last_active;
    if (nanos && Number(nanos) > 1e15) {
        try {
            return formatDistanceToNow(new Date(Number(nanos) / 1e6), { addSuffix: true });
        } catch {
            // fall through
        }
    }
    return formatDistanceToNow(new Date(c.created), { addSuffix: true }) + " (created)";
}

export function ConsumerList({
    consumers,
    streamName,
    onDelete,
    onCreated,
    onSelect,
}: {
    consumers: ConsumerInfoDto[];
    streamName: string;
    onDelete: (name: string) => void;
    onCreated?: () => void;
    onSelect?: (name: string) => void;
}) {
    return (
        <div className="rounded-md border border-border bg-card/50">
            <Table>
                <TableHeader className="bg-card">
                    <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-medium h-10">Name</TableHead>
                        <TableHead className="text-muted-foreground font-medium h-10">Mode</TableHead>
                        <TableHead className="text-muted-foreground font-medium h-10">Ack Policy</TableHead>
                        <TableHead className="text-muted-foreground font-medium h-10">Pend/Wait</TableHead>
                        <TableHead className="text-muted-foreground font-medium h-10">Last Active</TableHead>
                        <TableHead className="text-muted-foreground font-medium h-10 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {consumers.length > 0 ? (
                        consumers.map((c) => (
                            <TableRow
                                key={c.name}
                                className="border-border hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => onSelect?.(c.name)}
                            >
                                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                                        {c.config.deliver_subject ? "PUSH" : "PULL"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {c.config.ack_policy.toUpperCase()}
                                </TableCell>
                                <TableCell className="text-xs text-foreground/80 tabular-nums">
                                    {c.num_pending} / {c.num_ack_pending}
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Clock className="size-3" />
                                        {lastActiveLabel(c)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                        {onSelect && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onSelect(c.name)}
                                                className="h-8 w-8 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10"
                                            >
                                                <Eye className="size-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(c.name)}
                                            className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                                <div className="flex flex-col items-center gap-3">
                                    <span>No consumers found for this stream.</span>
                                    <CreateConsumerDialog streamName={streamName} onCreated={onCreated} />
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
