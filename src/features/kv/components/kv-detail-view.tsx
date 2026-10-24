"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveConnection } from "@/features/connections/hooks";
import {
    getKVKeys,
    getKVEntry,
    deleteKVBucket,
    deleteKVEntry,
    purgeKVEntry,
    getKVHistory,
    putKVEntry,
} from "@/features/kv/actions";
import type { KvEntryResult } from "@/types/nats";
import { toast } from "sonner";
import {
    ChevronLeft,
    RefreshCcw,
    Trash2,
    Search,
    Key,
    History,
    Play,
    Pause,
    Wifi,
    WifiOff,
    Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeViewer } from "@/components/ui/code-viewer";
import { useConfirm } from "@/components/providers/confirm-provider";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PutEntryDialog } from "@/features/kv/components/put-entry-dialog";
import Link from "next/link";
import { formatDate } from "@/lib/date-format";

export function KVDetailView() {
    const { bucket } = useParams();
    const router = useRouter();
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const [keys, setKeys] = React.useState<string[]>([]);
    const [filter, setFilter] = React.useState("");
    /** Connection/bucket the listed keys belong to (set after a fetch resolves). */
    const [loadedScope, setLoadedScope] = React.useState<string | null>(null);
    const [selectedEntry, setSelectedEntry] = React.useState<KvEntryResult | null>(null);
    const [history, setHistory] = React.useState<KvEntryResult[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = React.useState(false);
    const [isWatching, setIsWatching] = React.useState(false);
    const [isWatchPaused, setIsWatchPaused] = React.useState(false);
    const [watchPausedCount, setWatchPausedCount] = React.useState(0);
    const watchControllerRef = React.useRef<AbortController | null>(null);
    const watchPausedRef = React.useRef(false);
    const watchQueueRef = React.useRef<KvEntryResult[]>([]);

    React.useEffect(() => {
        watchPausedRef.current = isWatchPaused;
    }, [isWatchPaused]);

    const bucketName = typeof bucket === "string" ? bucket : null;
    const dataScope = activeConnection && bucketName ? `${activeConnection.id}/${bucketName}` : null;
    // Keys are stale until the fetch for the current connection/bucket resolves.
    const isLoading = dataScope !== null && loadedScope !== dataScope;

    /** Fetch the key list for the current connection/bucket. Performs no state updates. */
    const loadKeys = React.useCallback(async () => {
        if (!activeConnection || !bucket) return null;
        const scope = `${activeConnection.id}/${bucket as string}`;
        const result = await getKVKeys(activeConnection, bucket as string);
        return { scope, keys: result.success ? result.data.keys || [] : null };
    }, [activeConnection, bucket]);

    const applyKeys = React.useCallback((payload: { scope: string; keys: string[] | null }) => {
        if (payload.keys) setKeys(payload.keys);
        else toast.error("Failed to load keys");
        setLoadedScope(payload.scope);
    }, []);

    const fetchKeys = React.useCallback(async () => {
        const payload = await loadKeys();
        if (payload) applyKeys(payload);
    }, [loadKeys, applyKeys]);

    React.useEffect(() => {
        let cancelled = false;
        loadKeys().then((payload) => {
            if (cancelled || !payload) return;
            applyKeys(payload);
        });
        return () => {
            cancelled = true;
        };
    }, [loadKeys, applyKeys]);

    const applyWatchEntry = React.useCallback((entry: KvEntryResult) => {
        if (entry.operation === "PUT") {
            setKeys((current) => current.includes(entry.key) ? current : [...current, entry.key].sort());
            if (selectedEntry?.key === entry.key) {
                setSelectedEntry(entry);
                if (activeConnection && bucket) {
                    void getKVHistory(activeConnection, bucket as string, entry.key).then((result) => {
                        if (result.success) setHistory(result.data.entries);
                    });
                }
            }
        } else {
            setKeys((current) => current.filter((key) => key !== entry.key));
            if (selectedEntry?.key === entry.key) {
                setSelectedEntry(null);
                setHistory([]);
            }
        }
    }, [activeConnection, bucket, selectedEntry]);

    const stopWatch = React.useCallback((notify = false) => {
        watchControllerRef.current?.abort();
        watchControllerRef.current = null;
        setIsWatching(false);
        setIsWatchPaused(false);
        watchPausedRef.current = false;
        watchQueueRef.current = [];
        setWatchPausedCount(0);
        if (notify) toast.info("KV watch stopped");
    }, []);

    React.useEffect(() => () => watchControllerRef.current?.abort(), [activeConnection?.id, bucket]);

    const startWatch = async () => {
        if (!activeConnection || !bucket) {
            toast.error("No active connection selected");
            return;
        }

        const controller = new AbortController();
        watchControllerRef.current = controller;
        watchQueueRef.current = [];
        setWatchPausedCount(0);
        try {
            const response = await fetch("/api/kv/watch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config: activeConnection, bucket }),
                signal: controller.signal,
            });
            if (!response.ok || !response.body) {
                const text = await response.text().catch(() => "KV watch connection failed");
                toast.error(text || "KV watch connection failed");
                watchControllerRef.current = null;
                return;
            }

            setIsWatching(true);
            toast.success(`Watching KV bucket ${bucket}`);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            const handleFrame = (frame: string) => {
                let event = "message";
                const data: string[] = [];
                for (const line of frame.split("\n")) {
                    if (line.startsWith("event:")) event = line.slice(6).trim();
                    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
                }
                if (event === "error") {
                    toast.error(data.join("\n") || "KV watch error");
                    stopWatch();
                    return;
                }
                if (event !== "entry" || !data.length) return;
                try {
                    const entry = JSON.parse(data.join("\n")) as KvEntryResult;
                    if (watchPausedRef.current) {
                        watchQueueRef.current.push(entry);
                        setWatchPausedCount(watchQueueRef.current.length);
                    } else {
                        applyWatchEntry(entry);
                    }
                } catch {
                    toast.error("Received an invalid KV watch update");
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const frames = buffer.split("\n\n");
                buffer = frames.pop() ?? "";
                for (const frame of frames) handleFrame(frame);
            }
            if (!controller.signal.aborted) setIsWatching(false);
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            console.error("KV watch stream error:", error);
            toast.error("KV watch connection error");
            setIsWatching(false);
        } finally {
            if (watchControllerRef.current === controller) watchControllerRef.current = null;
        }
    };

    const toggleWatchPause = () => {
        if (isWatchPaused) {
            watchPausedRef.current = false;
            setIsWatchPaused(false);
            const queued = watchQueueRef.current;
            watchQueueRef.current = [];
            setWatchPausedCount(0);
            for (const entry of queued) applyWatchEntry(entry);
        } else {
            watchPausedRef.current = true;
            setIsWatchPaused(true);
        }
    };

    const handleFetchEntry = async (key: string) => {
        if (!activeConnection || !bucket) return;
        setIsFetchingHistory(true);
        const [entryResult, historyResult] = await Promise.all([
            getKVEntry(activeConnection, bucket as string, key),
            getKVHistory(activeConnection, bucket as string, key),
        ]);
        if (entryResult.success) setSelectedEntry(entryResult.data.entry);
        else {
            toast.error("Failed to load entry data");
            setSelectedEntry(null);
        }
        if (historyResult.success) setHistory(historyResult.data.entries || []);
        else setHistory([]);
        setIsFetchingHistory(false);
    };

    const handleRestoreRevision = async (entry: KvEntryResult) => {
        if (!activeConnection || !bucket) return;
        if (entry.operation !== "PUT") {
            toast.error("Only PUT revisions can be restored");
            return;
        }
        const ok = await confirm({
            title: `Restore revision ${entry.revision}?`,
            description: `This will write the value from revision ${entry.revision} as a new revision of "${entry.key}".`,
            confirmText: "Restore",
        });
        if (!ok) return;
        const result = await putKVEntry(activeConnection, bucket as string, entry.key, entry.value);
        if (result.success) {
            toast.success(`Restored as revision ${result.data.revision}`);
            void handleFetchEntry(entry.key);
            void fetchKeys();
        } else toast.error("Failed to restore revision", { description: result.error });
    };

    const handleDeleteKey = async (key: string) => {
        if (!activeConnection || !bucket) return;
        const ok = await confirm({
            title: `Delete key "${key}"?`,
            description: "Creates a tombstone. History may still be retained depending on bucket settings.",
            confirmText: "Delete Key",
        });
        if (!ok) return;
        const result = await deleteKVEntry(activeConnection, bucket as string, key);
        if (result.success) {
            toast.success(`Key "${key}" deleted`);
            if (selectedEntry?.key === key) {
                setSelectedEntry(null);
                setHistory([]);
            }
            void fetchKeys();
        } else toast.error("Failed to delete key", { description: result.error });
    };

    const handlePurgeKey = async (key: string) => {
        if (!activeConnection || !bucket) return;
        const ok = await confirm({
            title: `Purge key "${key}"?`,
            description: "Hard-removes the key and all revision history. This cannot be undone.",
            confirmText: "Purge Key",
            typedName: key,
        });
        if (!ok) return;
        const result = await purgeKVEntry(activeConnection, bucket as string, key);
        if (result.success) {
            toast.success(`Key "${key}" purged`);
            if (selectedEntry?.key === key) {
                setSelectedEntry(null);
                setHistory([]);
            }
            void fetchKeys();
        } else toast.error("Failed to purge key", { description: result.error });
    };

    const handleDeleteBucket = async () => {
        if (!activeConnection || !bucket) return;
        const ok = await confirm({
            title: `Delete bucket "${bucket}"?`,
            description: "All keys and their history will be permanently removed.",
            confirmText: "Delete Bucket",
            typedName: bucket as string,
        });
        if (!ok) return;
        stopWatch();
        const result = await deleteKVBucket(activeConnection, bucket as string);
        if (result.success) {
            toast.success("Bucket deleted");
            router.push("/kv");
        } else toast.error("Failed to delete bucket");
    };

    const filteredKeys = keys.filter((key) => key.toLowerCase().includes(filter.toLowerCase()));

    if (!activeConnection) return <div className="p-8 text-center text-muted-foreground">No active connection</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                        <Link href="/kv"><ChevronLeft className="size-5" /></Link>
                    </Button>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{bucket}</h1>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">KV Store</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isWatching ? (
                        <>
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30"><Wifi className="size-3 mr-1" /> Live</Badge>
                            {isWatchPaused && <Badge variant="secondary">Paused{watchPausedCount ? ` · ${watchPausedCount} queued` : ""}</Badge>}
                            <Button variant="outline" size="sm" onClick={toggleWatchPause}>
                                {isWatchPaused ? <Play className="size-4 mr-2" /> : <Pause className="size-4 mr-2" />}
                                {isWatchPaused ? "Resume" : "Pause"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => stopWatch(true)}><WifiOff className="size-4 mr-2" /> Stop watch</Button>
                        </>
                    ) : (
                        <Button variant="outline" size="sm" onClick={startWatch}><Wifi className="size-4 mr-2" /> Watch live</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchKeys} className="bg-card border-border text-foreground/80">
                        <RefreshCcw className="size-4 mr-2" /> Refresh
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDeleteBucket}>
                        <Trash2 className="size-4 mr-2" /> Delete Bucket
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
                <div className="col-span-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Filter keys..." className="pl-9 bg-card border-border focus:border-emerald-500 h-9" value={filter} onChange={(event) => setFilter(event.target.value)} />
                        </div>
                        <PutEntryDialog bucket={bucket as string} onSuccess={fetchKeys} />
                    </div>
                    <div className="flex-1 rounded-md border border-border bg-card/50 overflow-hidden flex flex-col">
                        <ScrollArea className="flex-1">
                            <Table>
                                <TableHeader className="bg-card sticky top-0 z-10">
                                    <TableRow className="border-border hover:bg-transparent"><TableHead className="text-muted-foreground font-medium h-9 text-xs">Keys ({filteredKeys.length})</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && keys.length === 0 ? (
                                        <TableRow><TableCell className="p-3"><DataTableSkeleton rows={8} columns={1} /></TableCell></TableRow>
                                    ) : filteredKeys.length ? filteredKeys.map((key) => (
                                        <TableRow key={key} className={`border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${selectedEntry?.key === key ? "bg-emerald-500/10" : ""}`} onClick={() => void handleFetchEntry(key)}>
                                            <TableCell className="py-2.5 px-4 font-mono text-xs text-foreground/80 flex items-center gap-2"><Key className="size-3 text-emerald-500/50" />{key}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell className="h-24 text-center text-muted-foreground/70 text-xs italic">No keys found</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>

                <div className="col-span-2 flex flex-col gap-4 overflow-hidden">
                    {selectedEntry ? (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between bg-card p-4 rounded-lg border border-border">
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Viewing Key</div>
                                    <div className="text-lg font-mono font-medium text-emerald-400">{selectedEntry.key}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <PutEntryDialog bucket={bucket as string} initialKey={selectedEntry.key} initialValue={selectedEntry.value} onSuccess={() => { void fetchKeys(); void handleFetchEntry(selectedEntry.key); }} trigger={<Button variant="outline" size="sm" className="bg-muted border-border hover:bg-muted">Edit Value</Button>} />
                                    <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => void handlePurgeKey(selectedEntry.key)}><Eraser className="size-3.5 mr-1" />Purge</Button>
                                    <Button variant="destructive" size="sm" onClick={() => void handleDeleteKey(selectedEntry.key)}><Trash2 className="size-3.5 mr-1" />Delete</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col gap-1"><span className="text-[10px] text-muted-foreground uppercase">Revision</span><span className="text-sm font-mono text-foreground">{selectedEntry.revision}</span></div>
                                <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col gap-1"><span className="text-[10px] text-muted-foreground uppercase">Last Updated</span><span className="text-[10px] text-foreground/80">{formatDate(selectedEntry.created, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span></div>
                                <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col gap-1"><span className="text-[10px] text-muted-foreground uppercase">Operation</span><Badge variant="outline" className="text-[9px] w-fit border-emerald-500/30 text-emerald-500 bg-emerald-500/5">{selectedEntry.operation}</Badge></div>
                            </div>
                            <div className="flex-1 rounded-lg border border-border bg-background flex flex-col overflow-hidden min-h-0">
                                <div className="px-4 py-2 border-b border-border bg-card flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">Value</span><span className="text-[10px] text-muted-foreground/70 font-mono">{(selectedEntry.value.length / 1024).toFixed(2)} KB</span></div>
                                <CodeViewer value={selectedEntry.value} fileName={selectedEntry.key} className="border-0 rounded-none" maxHeight="calc(100vh - 520px)" />
                            </div>
                            <div className="rounded-lg border border-border bg-card/50 overflow-hidden max-h-48 flex flex-col">
                                <div className="px-4 py-2 border-b border-border bg-card flex items-center gap-2"><History className="size-3.5 text-emerald-500" /><span className="text-xs font-semibold text-muted-foreground">Revision History</span>{isFetchingHistory && <RefreshCcw className="size-3 animate-spin text-muted-foreground ml-auto" />}</div>
                                <ScrollArea className="flex-1">
                                    {history.length ? <div className="divide-y divide-border/50">{history.map((entry) => (
                                        <div key={`${entry.revision}-${entry.operation}`} className={`flex items-center justify-between gap-3 px-4 py-2 text-xs ${entry.revision === selectedEntry.revision ? "bg-emerald-500/5" : ""}`}>
                                            <div className="flex items-center gap-3"><Badge variant="outline" className="font-mono">rev {entry.revision}</Badge><span className="text-muted-foreground">{formatDate(entry.created, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span><Badge variant="outline">{entry.operation}</Badge></div>
                                            {entry.operation === "PUT" && <Button variant="ghost" size="sm" onClick={() => void handleRestoreRevision(entry)}><RefreshCcw className="size-3 mr-1" />Restore</Button>}
                                        </div>
                                    ))}</div> : <EmptyHistory />}
                                </ScrollArea>
                            </div>
                        </div>
                    ) : <EmptySelection />}
                </div>
            </div>
        </div>
    );
}

function EmptyHistory() {
    return <div className="p-6 text-center text-xs text-muted-foreground">No revision history available</div>;
}

function EmptySelection() {
    return <div className="flex-1"><EmptyState icon={Key} title="Select a key" description="Choose a key to view its value and revision history." /></div>;
}
