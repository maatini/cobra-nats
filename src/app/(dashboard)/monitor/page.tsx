"use client";

import * as React from "react";
import { useActiveConnection } from "@/hooks/use-active-connection";
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
    Clock,
    Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonViewer, tryParseJson } from "@/components/ui/json-viewer";
import { toast } from "sonner";
import { format } from "date-fns";

interface NatsMessage {
    timestamp: number;
    subject: string;
    data: string;
    size: number;
    headers?: Record<string, string>;
}

export default function MonitorPage() {
    const [subject, setSubject] = React.useState(">");
    const [messages, setMessages] = React.useState<NatsMessage[]>([]);
    const [isSubscribed, setIsSubscribed] = React.useState(false);
    const [isPaused, setIsPaused] = React.useState(false);
    const [expandedMessage, setExpandedMessage] = React.useState<number | null>(null);

    const eventSourceRef = React.useRef<EventSource | null>(null);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const activeConnection = useActiveConnection();

    const toggleSubscription = () => {
        if (isSubscribed) {
            eventSourceRef.current?.close();
            setIsSubscribed(false);
            setIsPaused(false);
            toast.info("Subscription stopped");
        } else {
            if (!activeConnection) {
                toast.error("No active connection selected");
                return;
            }

            const servers = activeConnection.servers.join(",");
            const url = `/api/monitor?connectionId=${activeConnection.id}&subject=${encodeURIComponent(subject)}&servers=${encodeURIComponent(servers)}`;

            const es = new EventSource(url);
            eventSourceRef.current = es;

            es.addEventListener("connected", (e) => {
                setIsSubscribed(true);
                toast.success(`Subscribed to ${subject}`);
            });

            es.addEventListener("message", (e) => {
                if (isPaused) return;

                try {
                    const msg = JSON.parse(e.data);
                    setMessages((prev) => [msg, ...prev].slice(0, 500)); // Keep last 500
                } catch (err) {
                    console.error("Failed to parse message", err);
                }
            });

            es.addEventListener("error", (e) => {
                console.error("SSE Error:", e);
                es.close();
                setIsSubscribed(false);
                toast.error("Monitor connection error");
            });
        }
    };

    const clearMessages = () => setMessages([]);

    const exportJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
        const downloadAnchorNode = document.createElement('a');
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

    // Auto-scroll logic if needed, but current implementation puts new messages at top
    // React.useEffect(() => {
    //   if (!isPaused) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // }, [messages, isPaused]);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                    <Monitor className="size-6 text-rose-500" />
                    Live Subject Monitor
                </h1>
                <p className="text-slate-400">
                    Monitor your NATS traffic in real-time. New messages appear at the top.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 shadow-sm">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Subject or pattern (e.g. orders.*, >)"
                        className="pl-9 bg-slate-950 border-slate-800 focus:border-rose-500 font-mono"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={isSubscribed}
                    />
                </div>
                <Button
                    variant={isSubscribed ? "destructive" : "default"}
                    onClick={toggleSubscription}
                    className={!isSubscribed ? "bg-rose-600 hover:bg-rose-700 text-white min-w-[120px]" : "min-w-[120px]"}
                    disabled={!activeConnection}
                >
                    {isSubscribed ? (
                        <><WifiOff className="size-4 mr-2" /> Stop</>
                    ) : (
                        <><Wifi className="size-4 mr-2" /> Subscribe</>
                    )}
                </Button>
                <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsPaused(!isPaused)}
                        disabled={!isSubscribed}
                        className={isPaused ? "text-amber-500 bg-amber-500/10" : "text-slate-400"}
                    >
                        {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={clearMessages} className="text-slate-400 hover:text-rose-500">
                        <Trash2 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={exportJson} disabled={messages.length === 0} className="text-slate-400 hover:text-indigo-400">
                        <Download className="size-4" />
                    </Button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Badge variant="outline" className="tabular-nums bg-slate-950 border-slate-800 text-slate-400">
                        {messages.length} messages
                    </Badge>
                    {isSubscribed && (
                        <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </div>
            </div>

            <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
                <div className="grid grid-cols-[140px,2fr,3fr,100px] gap-4 px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400">
                    <div>TIMESTAMP</div>
                    <div>SUBJECT</div>
                    <div>PAYLOAD</div>
                    <div className="text-right">SIZE</div>
                </div>
                <ScrollArea className="flex-1">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-600 text-sm italic">
                            <Layers className="size-12 mb-4 opacity-20" />
                            {isSubscribed ? "Waiting for messages..." : "Subscribe to a subject to start monitoring"}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {messages.map((msg, idx) => {
                                const isExpanded = expandedMessage === idx;
                                return (
                                    <div key={`${msg.timestamp}-${idx}`} className="group">
                                        <div
                                            className={`grid grid-cols-[140px,2fr,3fr,100px] gap-4 px-4 py-2.5 items-center text-xs cursor-pointer hover:bg-slate-900/60 transition-colors ${isExpanded && 'bg-indigo-600/5'}`}
                                            onClick={() => setExpandedMessage(isExpanded ? null : idx)}
                                        >
                                            <div className="flex items-center gap-2 text-slate-500">
                                                {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                                <span className="tabular-nums font-mono">{format(msg.timestamp, "HH:mm:ss.SSS")}</span>
                                            </div>
                                            <div className="font-mono font-medium text-amber-400 truncate">{msg.subject}</div>
                                            <div className="truncate font-mono opacity-80">
                                                {tryParseJson(msg.data) ? (
                                                    <span className="text-emerald-300">{msg.data}</span>
                                                ) : (
                                                    <span className="text-slate-300">{msg.data}</span>
                                                )}
                                            </div>
                                            <div className="text-right text-slate-500 tabular-nums">{(msg.size / 1024).toFixed(2)} KB</div>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-0 bg-indigo-600/5 animate-in slide-in-from-top-2 duration-200">
                                                <div className="bg-slate-950/80 border border-slate-800 rounded-md p-4 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payload</div>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500" onClick={(e) => { e.stopPropagation(); copyToClipboard(msg.data); }}>
                                                            <Copy className="size-3" />
                                                        </Button>
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
                                                        <div className="pt-4 border-t border-slate-800 space-y-2">
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Headers</div>
                                                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                                                {Object.entries(msg.headers).map(([k, v]) => (
                                                                    <div key={k} className="flex items-center justify-between text-[10px] py-1 border-b border-slate-800/30">
                                                                        <span className="font-bold text-slate-400">{k}</span>
                                                                        <span className="text-slate-300">{v}</span>
                                                                    </div>
                                                                ))}
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
