"use client";

import * as React from "react";
import { getStreamMessages, deleteStreamMessage } from "@/features/streams/actions";
import type { NatsConnectionConfig, StreamMessage } from "@/types/nats";
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
    Trash2,
    Send,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-format";
import Link from "next/link";
import { useConfirm } from "@/components/providers/confirm-provider";
import { buildPublishReplayHref } from "@/lib/publish-replay";
import { PayloadViewer } from "@/components/ui/payload-viewer";

interface MessageBrowserProps {
    config: NatsConnectionConfig;
    streamName: string;
    firstSeq: number;
    lastSeq: number;
}

export function MessageBrowser({ config, streamName, firstSeq, lastSeq }: MessageBrowserProps) {
    const confirm = useConfirm();
    const [startSeq, setStartSeq] = React.useState<string>(String(firstSeq || 1));
    const [batchSize, setBatchSize] = React.useState<string>("25");
    const [subjectFilter, setSubjectFilter] = React.useState<string>("");
    const [messages, setMessages] = React.useState<StreamMessage[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
    const [focusedSeqInput, setFocusedSeq] = React.useState<number | null>(null);
    const [deletingSeq, setDeletingSeq] = React.useState<number | null>(null);
    const listRef = React.useRef<HTMLDivElement | null>(null);

    // Stored focus can point at a message that was reloaded away or deleted; fall back to the first row.
    const focusedSeq =
        focusedSeqInput != null && messages.some(m => m.seq === focusedSeqInput)
            ? focusedSeqInput
            : (messages[0]?.seq ?? null);

    const handleDeleteMessage = async (seq: number) => {
        const ok = await confirm({
            title: `Delete message #${seq}?`,
            description: "This permanently removes the message from the stream. This cannot be undone.",
            confirmText: "Delete Message",
        });
        if (!ok) return;

        setDeletingSeq(seq);
        const result = await deleteStreamMessage(config, streamName, seq);
        setDeletingSeq(null);

        if (!result.success) {
            toast.error("Failed to delete message", { description: result.error });
            return;
        }

        toast.success(`Message #${seq} deleted`);
        setMessages((prev) => prev.filter((m) => m.seq !== seq));
        setExpanded((prev) => {
            const next = new Set(prev);
            next.delete(seq);
            return next;
        });
    };

    const fetchBatch = React.useCallback(
        async (fromSeq: number, append: boolean) => {
            setIsLoading(true);
            setLoadError(null);
            const requestedBatch = Number(batchSize) || 25;
            const boundedBatch = Math.min(200, Math.max(1, requestedBatch));
            if (String(boundedBatch) !== batchSize) setBatchSize(String(boundedBatch));
            try {
                const result = await getStreamMessages(config, streamName, {
                    startSeq: fromSeq,
                    batchSize: boundedBatch,
                    subjectFilter: subjectFilter.trim() || undefined,
                });
                if (!result.success) {
                    setLoadError(result.error);
                    toast.error(`Failed to load messages: ${result.error}`);
                    return;
                }

                setMessages(prev => (append ? [...prev, ...result.data.messages] : result.data.messages));
                setHasMore(result.data.hasMore);
                if (!append) setExpanded(new Set());
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unexpected error while loading messages.";
                setLoadError(message);
                toast.error(`Failed to load messages: ${message}`);
            } finally {
                setIsLoading(false);
            }
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

    const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (messages.length === 0) return;
        const currentIndex = focusedSeq != null
            ? messages.findIndex(m => m.seq === focusedSeq)
            : -1;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = messages[Math.min(messages.length - 1, currentIndex + 1)];
            if (next) setFocusedSeq(next.seq);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prev = messages[Math.max(0, currentIndex - 1)];
            if (prev) setFocusedSeq(prev.seq);
        } else if (e.key === "Enter" || e.key === " ") {
            if (focusedSeq != null) {
                e.preventDefault();
                toggleExpanded(focusedSeq);
            }
        } else if (e.key === "Escape") {
            if (expanded.size > 0) {
                e.preventDefault();
                setExpanded(new Set());
            }
        } else if (e.key === "Home") {
            e.preventDefault();
            setFocusedSeq(messages[0].seq);
        } else if (e.key === "End") {
            e.preventDefault();
            setFocusedSeq(messages[messages.length - 1].seq);
        }
    };

    React.useEffect(() => {
        if (focusedSeq == null || !listRef.current) return;
        const el = listRef.current.querySelector<HTMLElement>(`[data-seq="${focusedSeq}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [focusedSeq]);

    return (
        <Card className="bg-card border-border">
            <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-400">
                    <MessageSquare className="size-4" />
                    Message Browser
                    <Badge variant="outline" className="ml-2 bg-muted text-muted-foreground border-border font-mono text-[10px]">
                        seq {firstSeq} – {lastSeq}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Controls */}
                <div className="grid gap-3 md:grid-cols-4 items-end">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                            <Hash className="size-3" /> Start Sequence
                        </Label>
                        <Input
                            type="number"
                            value={startSeq}
                            onChange={e => setStartSeq(e.target.value)}
                            placeholder={String(firstSeq)}
                            className="bg-background border-border text-foreground h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Batch Size</Label>
                        <Input
                            type="number"
                            value={batchSize}
                            onChange={e => setBatchSize(e.target.value)}
                            min={1}
                            max={200}
                            className="bg-background border-border text-foreground h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                            <Filter className="size-3" /> Subject Filter
                        </Label>
                        <Input
                            type="text"
                            value={subjectFilter}
                            onChange={e => setSubjectFilter(e.target.value)}
                            placeholder="orders.*"
                            className="bg-background border-border text-foreground h-9 font-mono"
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

                {messages.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/70">
                        Tip: click the list, then use <kbd className="px-1 rounded bg-muted text-foreground/80">↑</kbd>/<kbd className="px-1 rounded bg-muted text-foreground/80">↓</kbd> to navigate, <kbd className="px-1 rounded bg-muted text-foreground/80">Enter</kbd> to expand, <kbd className="px-1 rounded bg-muted text-foreground/80">Esc</kbd> to collapse all.
                    </p>
                )}

                {loadError && (
                    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        Unable to load this tab’s messages: {loadError}
                    </div>
                )}

                {/* Empty state */}
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg">
                        <MessageSquare className="size-10 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            {lastSeq === 0
                                ? "Stream is empty."
                                : "Click \"Load Messages\" to browse stream contents."}
                        </p>
                    </div>
                )}

                {/* Message list */}
                {messages.length > 0 && (
                    <ScrollArea
                        className="h-[520px] rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        tabIndex={0}
                        onKeyDown={handleListKeyDown}
                        aria-label="Messages — use arrow keys to navigate, Enter to expand, Escape to collapse all"
                    >
                        <div className="divide-y divide-border" ref={listRef}>
                            {messages.map(msg => {
                                const isOpen = expanded.has(msg.seq);
                                const headerEntries = Object.entries(msg.headers);
                                const isFocused = focusedSeq === msg.seq;
                                return (
                                    <div
                                        key={msg.seq}
                                        data-seq={msg.seq}
                                        className={isFocused ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/30" : "bg-card"}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFocusedSeq(msg.seq);
                                                toggleExpanded(msg.seq);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                                        >
                                            {isOpen ? (
                                                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                                            ) : (
                                                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
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
                                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 flex items-center gap-1">
                                                <Clock className="size-3" />
                                                {formatDate(msg.timestamp, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums shrink-0 w-16 text-right">
                                                {msg.size} B
                                            </span>
                                        </button>

                                        {isOpen && (
                                            <div className="px-4 pb-4 pt-1 space-y-3 bg-background/40">
                                                {headerEntries.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">
                                                            Headers
                                                        </div>
                                                        <div className="rounded border border-border bg-background p-2 space-y-1">
                                                            {headerEntries.map(([k, vs]) => (
                                                                <div key={k} className="flex gap-2 text-[11px] font-mono">
                                                                    <span className="text-cyan-400">{k}:</span>
                                                                    <span className="text-foreground/80">{vs.join(", ")}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                                                Payload
                                                            </span>

                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={buildPublishReplayHref({
                                                                        subject: msg.subject,
                                                                        payload: msg.data,
                                                                        headers: msg.headers,
                                                                    })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Send className="size-3 mr-1" />
                                                                    Replay
                                                                </Link>
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-[10px] text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                                                                disabled={deletingSeq === msg.seq}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void handleDeleteMessage(msg.seq);
                                                                }}
                                                            >
                                                                {deletingSeq === msg.seq ? (
                                                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="size-3 mr-1" />
                                                                )}
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <PayloadViewer payload={msg.data} base64={msg.dataBase64} />
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
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            Loaded <span className="text-foreground/80 font-mono">{messages.length}</span> messages
                            {hasMore && <span className="text-amber-400"> (more available)</span>}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLoad}
                                disabled={isLoading}
                                className="bg-card border-border text-foreground/80"
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
