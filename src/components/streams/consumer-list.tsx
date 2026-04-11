"use client";

import type { ConsumerInfo } from "nats";
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
import { Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CreateConsumerDialog } from "./create-consumer-dialog";

export function ConsumerList({
    consumers,
    streamName,
    onDelete,
    onCreated,
}: {
    consumers: ConsumerInfo[];
    streamName: string;
    onDelete: (name: string) => void;
    onCreated?: () => void;
}) {
    return (
        <div className="rounded-md border border-slate-800 bg-slate-900/50">
            <Table>
                <TableHeader className="bg-slate-900">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-400 font-medium h-10">Name</TableHead>
                        <TableHead className="text-slate-400 font-medium h-10">Mode</TableHead>
                        <TableHead className="text-slate-400 font-medium h-10">Ack Policy</TableHead>
                        <TableHead className="text-slate-400 font-medium h-10">Bkd/Prnd</TableHead>
                        <TableHead className="text-slate-400 font-medium h-10">Last Active</TableHead>
                        <TableHead className="text-slate-400 font-medium h-10 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {consumers.length > 0 ? (
                        consumers.map((c) => (
                            <TableRow key={c.name} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                                <TableCell className="font-medium text-slate-200">{c.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                                        {c.config.deliver_subject ? "PUSH" : "PULL"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-slate-400">
                                    {c.config.ack_policy.toUpperCase()}
                                </TableCell>
                                <TableCell className="text-xs text-slate-300 tabular-nums">
                                    {c.num_pending} / {c.num_waiting}
                                </TableCell>
                                <TableCell className="text-[10px] text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <Clock className="size-3" />
                                        {formatDistanceToNow(new Date(c.created), { addSuffix: true })}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onDelete(c.name)}
                                        className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-28 text-center text-slate-500">
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
