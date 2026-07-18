"use client";

import * as React from "react";
import Link from "next/link";
import { useActiveConnection } from "@/features/connections/hooks";
import {
    Monitor,
    Play,
    Pause,
    Trash2,
    Download,
    Wifi,
    WifiOff,
    Search,
    ChevronRight,
    ChevronDown,
    Copy,
    Layers,
    Send,
    Gauge,
    Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonViewer, tryParseJson } from "@/components/ui/json-viewer";
import { toast } from "sonner";
import { format } from "date-fns";
import { buildPublishReplayHref } from "@/lib/publish-replay";

interface NatsMessage {
    timestamp: number;
    subject: string;
    data: string;
    size: number;
    headers?: Record<string, string>;
}

const BUFFER_OPTIONS = [100, 250, 500, 1000, 2000] as const;
const RATE_OPTIONS = [
    { label: "Unlimited", value: 0 },
    { label: "10/s", value: 10 },
    { label: "25/s", value: 25 },
    { label: "50/s", value: 50 },
    { label: "100/s", value: 100 },
] as const;

/** Simple NATS-like subject match for client-side filter (* and >). */
function subjectMatchesFilter(subject: string, filter: string): boolean {
    const f = filter.trim();
    if (!f || f === ">") return true;
    const subParts = subject.split(".");
    const filterParts = f.split(".");
    for (let i = 0; i < filterParts.length; i++) {
        if (filterParts[i] === ">") return true;
        if (i >= subParts.length) return false;
        if (filterParts[i] === "*") continue;
        if (filterParts[i] !== subParts[i]) return false;
    }
    return subParts.length === filterParts.length;
}

export function MonitorView() {
    const [subject, setSubject] = React.useState(">");
    const [messages, setMessages] = React.useState<NatsMessage[]>([]);
    const [isSubscribed, setIsSubscribed] = React.useState(false);
    const [isPaused, setIsPaused] = React.useState(false);
    const [expandedMessage, setExpandedMessage] = React.useState<number | null>(null);
    const [clientFilter, setClientFilter] = React.useState("");
    const [maxBuffer, setMaxBuffer] = React.useState<number>(500);
    const [rateLimit, setRateLimit] = React.useState<number>(0);
    const [droppedCount, setDroppedCount] = React.useState(0);
    const [rateLimitedCount, setRateLimitedCount] = React.useState(0);

    const abortRef = React.useRef<AbortController | null>(null);
    const isPausedRef = React.useRef(false);
    const maxBufferRef = React.useRef(maxBuffer);
    const rateLimitRef = React.useRef(rateLimit);
    const clientFilterRef = React.useRef(clientFilter);
    const rateWindowRef = React.useRef<{ start: number; count: number }>({
        start: Date.now(),
        count: 0,
    });
    const activeConnection = useActiveConnection();

    React.useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    React.useEffect(() => {
        maxBufferRef.current = maxBuffer;
    }, [maxBuffer]);

    React.useEffect(() => {
        rateLimitRef.current = rateLimit;
    }, [rateLimit]);

    React.useEffect(() => {
        clientFilterRef.current = clientFilter;
    }, [clientFilter]);

    React.useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    /** Parse SSE frames from a chunked text buffer; returns leftover incomplete frame. */
    function processSseBuffer(
        buffer: string,
        onEvent: (event: string, data: string) => void
    ): string {
        const parts = buffer.split("\n\n");
        const remainder = parts.pop() ?? "";
        for (const part of parts) {
            if (!part.trim()) continue;
            let event = "message";
            const dataLines: string[] = [];
            for (const line of part.split("\n")) {
                if (line.startsWith("event:")) {
                    event = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                    dataLines.push(line.slice(5).trim());
                }
            }
            if (dataLines.length > 0) {
                onEvent(event, dataLines.join("\n"));
            }
        }
        return remainder;
    }

    const stopSubscription = React.useCallback((notify = true) => {
        abortRef.current?.abort();
        abortRef.current = null;
        setIsSubscribed(false);
        setIsPaused(false);
        if (notify) toast.info("Subscription stopped");
    }, []);

    const acceptByRateLimit = React.useCallback((): boolean => {
        const limit = rateLimitRef.current;
        if (limit <= 0) return true;
        const now = Date.now();
        const window = rateWindowRef.current;
        if (now - window.start >= 1000) {
            window.start = now;
            window.count = 0;
        }
        if (window.count >= limit) {
            setRateLimitedCount((c) => c + 1);
            return false;
        }
        window.count += 1;
        return true;
    }, []);

    const toggleSubscription = async () => {
        if (isSubscribed) {
            stopSubscription(true);
            return;
        }

        if (!activeConnection) {
            toast.error("No active connection selected");
            return;
        }

        // POST body carries full config (incl. auth). Secrets never go in the URL.
        const controller = new AbortController();
        abortRef.current = controller;
        setDroppedCount(0);
        setRateLimitedCount(0);
        rateWindowRef.current = { start: Date.now(), count: 0 };

        try {
            const res = await fetch("/api/monitor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    config: activeConnection,
                    subject,
                }),
                signal: controller.signal,
            });

            if (!res.ok || !res.body) {
                const text = await res.text().catch(() => "Monitor connection failed");
                toast.error(text || "Monitor connection failed");
                abortRef.current = null;
                return;
            }

            setIsSubscribed(true);
            toast.success(`Subscribed to ${subject}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            const onEvent = (event: string, data: string) => {
                if (event === "ping" || event === "connected") return;
                if (event === "error") {
                    toast.error(data || "Monitor error");
                    stopSubscription(false);
                    return;
                }
                if (event === "message") {
                    if (isPausedRef.current) return;
                    if (!acceptByRateLimit()) return;
                    try {
                        const msg = JSON.parse(data) as NatsMessage;
                        if (
                            clientFilterRef.current &&
                            !subjectMatchesFilter(msg.subject, clientFilterRef.current)
                        ) {
                            return;
                        }
                        setMessages((prev) => {
                            const cap = maxBufferRef.current;
                            const next = [msg, ...prev];
                            if (next.length > cap) {
                                const overflow = next.length - cap;
                                setDroppedCount((d) => d + overflow);
                                return next.slice(0, cap);
                            }
                            return next;
                        });
                    } catch (err) {
                        console.error("Failed to parse message", err);
                    }
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                buffer = processSseBuffer(buffer, onEvent);
            }

            if (!controller.signal.aborted) {
                setIsSubscribed(false);
                setIsPaused(false);
            }
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }
            console.error("Monitor stream error:", err);
            toast.error("Monitor connection error");
            setIsSubscribed(false);
            setIsPaused(false);
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
            }
        }
    };

    const clearMessages = () => {
        setMessages([]);
        setDroppedCount(0);
        setRateLimitedCount(0);
        setExpandedMessage(null);
    };

    const exportJson = () => {
        const dataStr =
            "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `nats_monitor_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Messages exported");
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    // When buffer shrinks, trim immediately.
    React.useEffect(() => {
        setMessages((prev) => {
            if (prev.length <= maxBuffer) return prev;
            const overflow = prev.length - maxBuffer;
            setDroppedCount((d) => d + overflow);
            return prev.slice(0, maxBuffer);
        });
    }, [maxBuffer]);

    const filteredMessages = React.useMemo(() => {
        if (!clientFilter.trim()) return messages;
        return messages.filter((m) => subjectMatchesFilter(m.subject, clientFilter));
    }, [messages, clientFilter]);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Monitor className="size-6 text-rose-500" />
                    Live Subject Monitor
                </h1>
                <p className="text-muted-foreground">
                    Monitor your NATS traffic in real-time. New messages appear at the top.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-lg border border-border shadow-sm">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Subject or pattern (e.g. orders.*, >)"
                        className="pl-9 bg-background border-border focus:border-rose-500 font-mono"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={isSubscribed}
                    />
                </div>
                <Button
                    variant={isSubscribed ? "destructive" : "default"}
                    onClick={toggleSubscription}
                    className={
                        !isSubscribed
                            ? "bg-rose-600 hover:bg-rose-700 text-white min-w-[120px]"
                            : "min-w-[120px]"
                    }
                    disabled={!activeConnection}
                >
                    {isSubscribed ? (
                        <>
                            <WifiOff className="size-4 mr-2" /> Stop
                        </>
                    ) : (
                        <>
                            <Wifi className="size-4 mr-2" /> Subscribe
                        </>
                    )}
                </Button>
                <div className="flex items-center gap-1 border-l border-border pl-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsPaused(!isPaused)}
                        disabled={!isSubscribed}
                        className={isPaused ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground"}
                        title={isPaused ? "Resume" : "Pause"}
                    >
                        {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearMessages}
                        className="text-muted-foreground hover:text-rose-500"
                        title="Clear buffer"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={exportJson}
                        disabled={messages.length === 0}
                        className="text-muted-foreground hover:text-indigo-400"
                        title="Export JSON"
                    >
                        <Download className="size-4" />
                    </Button>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Badge
                        variant="outline"
                        className="tabular-nums bg-background border-border text-muted-foreground"
                    >
                        {filteredMessages.length}
                        {clientFilter.trim() ? ` / ${messages.length}` : ""} msgs
                    </Badge>
                    {droppedCount > 0 && (
                        <Badge
                            variant="outline"
                            className="tabular-nums bg-amber-500/10 text-amber-400 border-amber-500/30"
                            title="Messages dropped due to buffer cap (oldest removed)"
                        >
                            {droppedCount} dropped
                        </Badge>
                    )}
                    {rateLimitedCount > 0 && (
                        <Badge
                            variant="outline"
                            className="tabular-nums bg-violet-500/10 text-violet-400 border-violet-500/30"
                            title="Messages skipped by client rate limit"
                        >
                            {rateLimitedCount} rate-limited
                        </Badge>
                    )}
                    {isPaused && (
                        <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-400 border-amber-500/30"
                        >
                            Paused
                        </Badge>
                    )}
                    {isSubscribed && (
                        <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </div>
            </div>

            {/* Backpressure / filter controls */}
            <div className="flex flex-wrap items-end gap-3 bg-card/60 p-3 rounded-lg border border-border/80">
                <div className="space-y-1 min-w-[180px] flex-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        <Filter className="size-3" /> Client filter
                    </Label>
                    <Input
                        placeholder="Filter subjects (orders.*, events.>)"
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        className="h-9 bg-background border-border font-mono text-xs"
                    />
                </div>
                <div className="space-y-1 w-[140px]">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        <Layers className="size-3" /> Buffer size
                    </Label>
                    <select
                        value={maxBuffer}
                        onChange={(e) => setMaxBuffer(Number(e.target.value))}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    >
                        {BUFFER_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                                {n} messages
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1 w-[140px]">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        <Gauge className="size-3" /> Rate limit
                    </Label>
                    <select
                        value={rateLimit}
                        onChange={(e) => setRateLimit(Number(e.target.value))}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    >
                        {RATE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed pb-1">
                    Filter, buffer cap, and rate limit run in the browser. Pause freezes the UI buffer
                    without unsubscribing.
                </p>
            </div>

            <div className="flex-1 rounded-lg border border-border bg-background overflow-hidden flex flex-col">
                <div className="grid grid-cols-[140px,2fr,3fr,100px] gap-4 px-4 py-2 bg-card/80 border-b border-border text-xs font-semibold text-muted-foreground">
                    <div>TIMESTAMP</div>
                    <div>SUBJECT</div>
                    <div>PAYLOAD</div>
                    <div className="text-right">SIZE</div>
                </div>
                <ScrollArea className="flex-1">
                    {filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground/70 text-sm italic">
                            <Layers className="size-12 mb-4 opacity-20" />
                            {isSubscribed
                                ? clientFilter.trim()
                                    ? "No messages match the client filter…"
                                    : "Waiting for messages..."
                                : "Subscribe to a subject to start monitoring"}
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {filteredMessages.map((msg, idx) => {
                                const isExpanded = expandedMessage === idx;
                                return (
                                    <div key={`${msg.timestamp}-${idx}`} className="group">
                                        <div
                                            className={`grid grid-cols-[140px,2fr,3fr,100px] gap-4 px-4 py-2.5 items-center text-xs cursor-pointer hover:bg-card/60 transition-colors ${isExpanded && "bg-indigo-600/5"}`}
                                            onClick={() => setExpandedMessage(isExpanded ? null : idx)}
                                        >
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                {isExpanded ? (
                                                    <ChevronDown className="size-3" />
                                                ) : (
                                                    <ChevronRight className="size-3" />
                                                )}
                                                <span className="tabular-nums font-mono">
                                                    {format(msg.timestamp, "HH:mm:ss.SSS")}
                                                </span>
                                            </div>
                                            <div className="font-mono font-medium text-amber-400 truncate">
                                                {msg.subject}
                                            </div>
                                            <div className="truncate font-mono opacity-80">
                                                {tryParseJson(msg.data) ? (
                                                    <span className="text-emerald-300">{msg.data}</span>
                                                ) : (
                                                    <span className="text-foreground/80">{msg.data}</span>
                                                )}
                                            </div>
                                            <div className="text-right text-muted-foreground tabular-nums">
                                                {(msg.size / 1024).toFixed(2)} KB
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-0 bg-indigo-600/5 animate-in slide-in-from-top-2 duration-200">
                                                <div className="bg-background/80 border border-border rounded-md p-4 space-y-4">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                            Payload
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-[10px] text-indigo-400 hover:text-indigo-300"
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
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-muted-foreground"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    copyToClipboard(msg.data);
                                                                }}
                                                            >
                                                                <Copy className="size-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="overflow-auto max-h-[300px]">
                                                        <JsonViewer
                                                            value={msg.data}
                                                            className="text-xs"
                                                            rawClassName="text-xs text-indigo-300"
                                                            showBadge
                                                        />
                                                    </div>

                                                    {msg.headers && Object.keys(msg.headers).length > 0 && (
                                                        <div className="pt-4 border-t border-border space-y-2">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                                Headers
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                                                {Object.entries(msg.headers).map(
                                                                    ([k, v]) => (
                                                                        <div
                                                                            key={k}
                                                                            className="flex items-center justify-between text-[10px] py-1 border-b border-border/30"
                                                                        >
                                                                            <span className="font-bold text-muted-foreground">
                                                                                {k}
                                                                            </span>
                                                                            <span className="text-foreground/80">
                                                                                {v}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}
