"use client";

import * as React from "react";
import { getStreamMessages } from "@/app/actions/stream-actions";
import type { NatsConnectionConfig, StreamMessage } from "@/lib/nats/nats-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    MessageSquare,
    Search,
    RefreshCcw,
    ChevronDown,
    ChevronRight,
    Hash,
    Clock,
    Filter,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MessageBrowserProps {
    config: NatsConnectionConfig;
    streamName: string;
    firstSeq: number;
    lastSeq: number;
}

// Try to pretty-print a string as JSON; return null if not valid JSON.
function tryPrettyJson(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const firstChar = trimmed[0];
    if (firstChar !== "{" && firstChar !== "[" && firstChar !== '"') return null;
    try {
        const parsed: unknown = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return null;
    }
}

export function MessageBrowser({ config, streamName, firstSeq, lastSeq }: MessageBrowserProps) {
    const [startSeq, setStartSeq] = React.useState<string>(String(firstSeq || 1));
    const [batchSize, setBatchSize] = React.useState<string>("25");
    const [subjectFilter, setSubjectFilter] = React.useState<string>("");
    const [messages, setMessages] = React.useState<StreamMessage[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
    const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

    const fetchBatch = React.useCallback(
        async (fromSeq: number, append: boolean) => {
            setIsLoading(true);
            const result = await getStreamMessages(config, streamName, {
                startSeq: fromSeq,
                batchSize: Number(batchSize) || 25,
                subjectFilter: subjectFilter.trim() || undefined,
            });
            setIsLoading(false);

            if (!result.success) {
                toast.error(`Failed to load messages: ${result.error}`);
                return;
            }

            setMessages(prev => (append ? [...prev, ...result.data.messages] : result.data.messages));
            setHasMore(result.data.hasMore);
            if (!append) setExpanded(new Set());
        },
        [config, streamName, batchSize, subjectFilter]
    );

    const handleLoad = () => {
        const seq = Number(startSeq) || firstSeq || 1;
        fetchBatch(seq, false);
    };

    const handleLoadMore = () => {
        if (messages.length === 0) return;
        const lastLoaded = messages[messages.length - 1].seq;
        fetchBatch(lastLoaded + 1, true);
    };

    const toggleExpanded = (seq: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(seq)) next.delete(seq);
            else next.add(seq);
            return next;
        });
    };

    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-400">
                    <MessageSquare className="size-4" />
                    Message Browser
                    <Badge variant="outline" className="ml-2 bg-slate-800 text-slate-400 border-slate-700 font-mono text-[10px]">
                        seq {firstSeq} – {lastSeq}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Controls */}
                <div className="grid gap-3 md:grid-cols-4 items-end">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                            <Hash className="size-3" /> Start Sequence
                        </Label>
                        <Input
                            type="number"
                            value={startSeq}
                            onChange={e => setStartSeq(e.target.value)}
                            placeholder={String(firstSeq)}
                            className="bg-slate-950 border-slate-800 text-slate-200 h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Batch Size</Label>
                        <Input
                            type="number"
                            value={batchSize}
                            onChange={e => setBatchSize(e.target.value)}
                            min={1}
                            max={500}
                            className="bg-slate-950 border-slate-800 text-slate-200 h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                            <Filter className="size-3" /> Subject Filter
                        </Label>
                        <Input
                            type="text"
                            value={subjectFilter}
                            onChange={e => setSubjectFilter(e.target.value)}
                            placeholder="orders.*"
                            className="bg-slate-950 border-slate-800 text-slate-200 h-9 font-mono"
                        />
                    </div>
                    <Button
                        onClick={handleLoad}
                        disabled={isLoading || lastSeq === 0}
                        className="bg-amber-600 hover:bg-amber-700 text-white h-9"
                    >
                        {isLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Search className="size-4 mr-2" />}
                        Load Messages
                    </Button>
                </div>

                {/* Empty state */}
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-800 rounded-lg">
                        <MessageSquare className="size-10 text-slate-700 mb-3" />
                        <p className="text-sm text-slate-500">
                            {lastSeq === 0
                                ? "Stream is empty."
                                : "Click \"Load Messages\" to browse stream contents."}
                        </p>
                    </div>
                )}

                {/* Message list */}
                {messages.length > 0 && (
                    <ScrollArea className="h-[520px] rounded-md border border-slate-800">
                        <div className="divide-y divide-slate-800">
                            {messages.map(msg => {
                                const isOpen = expanded.has(msg.seq);
                                const pretty = tryPrettyJson(msg.data);
                                const isJson = pretty !== null;
                                const headerEntries = Object.entries(msg.headers);
                                return (
                                    <div key={msg.seq} className="bg-slate-900">
                                        <button
                                            type="button"
                                            onClick={() => toggleExpanded(msg.seq)}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 transition-colors text-left"
                                        >
                                            {isOpen ? (
                                                <ChevronDown className="size-4 text-slate-500 shrink-0" />
                                            ) : (
                                                <ChevronRight className="size-4 text-slate-500 shrink-0" />
                                            )}
                                            <Badge
                                                variant="outline"
                                                className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-mono text-[10px] tabular-nums shrink-0"
                                            >
                                                #{msg.seq}
                                            </Badge>
                                            <span className="text-xs text-indigo-300 font-mono truncate flex-1">
                                                {msg.subject}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono tabular-nums shrink-0 flex items-center gap-1">
                                                <Clock className="size-3" />
                                                {format(new Date(msg.timestamp), "yyyy-MM-dd HH:mm:ss")}
                                            </span>
                                            <span className="text-[10px] text-slate-600 font-mono tabular-nums shrink-0 w-16 text-right">
                                                {msg.size} B
                                            </span>
                                        </button>

                                        {isOpen && (
                                            <div className="px-4 pb-4 pt-1 space-y-3 bg-slate-950/40">
                                                {headerEntries.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                                                            Headers
                                                        </div>
                                                        <div className="rounded border border-slate-800 bg-slate-950 p-2 space-y-1">
                                                            {headerEntries.map(([k, vs]) => (
                                                                <div key={k} className="flex gap-2 text-[11px] font-mono">
                                                                    <span className="text-cyan-400">{k}:</span>
                                                                    <span className="text-slate-300">{vs.join(", ")}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold">
                                                            Payload
                                                        </span>
                                                        {isJson && (
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0 px-1.5"
                                                            >
                                                                JSON
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <pre className="rounded border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-200 font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-96">
                                                        {pretty ?? msg.data ?? <span className="text-slate-600 italic">(empty)</span>}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                {messages.length > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                            Loaded <span className="text-slate-300 font-mono">{messages.length}</span> messages
                            {hasMore && <span className="text-amber-400"> (more available)</span>}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLoad}
                                disabled={isLoading}
                                className="bg-slate-900 border-slate-800 text-slate-300"
                            >
                                <RefreshCcw className="size-3 mr-1.5" /> Reload
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleLoadMore}
                                disabled={!hasMore || isLoading}
                                className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
                            >
                                {isLoading ? (
                                    <Loader2 className="size-3 mr-1.5 animate-spin" />
                                ) : (
                                    <ChevronDown className="size-3 mr-1.5" />
                                )}
                                Load Next Batch
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
