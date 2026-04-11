"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveConnection } from "@/features/connections/hooks";
import { getKVKeys, getKVEntry, deleteKVBucket } from "@/features/kv/actions";
import type { KvEntry } from "nats";
import type { KvEntryResult } from "@/types/nats";
import { toast } from "sonner";
import {
    Database,
    ChevronLeft,
    RefreshCcw,
    Trash2,
    Search,
    Key,
    Eye,
    Clock,
    ExternalLink,
    Plus
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
import { JsonViewer } from "@/components/ui/json-viewer";
import { useConfirm } from "@/components/providers/confirm-provider";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import { PutEntryDialog } from "@/features/kv/components/put-entry-dialog";
import Link from "next/link";
import { format } from "date-fns";

export default function KVDetailPage() {
    const { bucket } = useParams();
    const router = useRouter();
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const [keys, setKeys] = React.useState<string[]>([]);
    const [filter, setFilter] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(true);
    const [selectedEntry, setSelectedEntry] = React.useState<KvEntryResult | null>(null);
    const [isFetchingEntry, setIsFetchingEntry] = React.useState(false);

    const fetchKeys = React.useCallback(async () => {
        if (!activeConnection || !bucket) return;

        setIsLoading(true);
        const result = await getKVKeys(activeConnection, bucket as string);
        if (result.success) {
            setKeys(result.data.keys || []);
        } else {
            toast.error("Failed to load keys");
        }
        setIsLoading(false);
    }, [activeConnection, bucket]);

    React.useEffect(() => {
        fetchKeys();
    }, [fetchKeys]);

    const handleFetchEntry = async (key: string) => {
        if (!activeConnection || !bucket) return;
        setIsFetchingEntry(true);
        const result = await getKVEntry(activeConnection, bucket as string, key);
        if (result.success) {
            setSelectedEntry(result.data.entry);
        } else {
            toast.error("Failed to load entry data");
        }
        setIsFetchingEntry(false);
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

        const result = await deleteKVBucket(activeConnection, bucket as string);
        if (result.success) {
            toast.success("Bucket deleted");
            router.push("/kv");
        } else {
            toast.error("Failed to delete bucket");
        }
    };

    const filteredKeys = keys.filter(k => k.toLowerCase().includes(filter.toLowerCase()));

    if (!activeConnection) return <div className="p-8 text-center text-muted-foreground">No active connection</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                        <Link href="/kv">
                            <ChevronLeft className="size-5" />
                        </Link>
                    </Button>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{bucket}</h1>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">KV Store</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
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
                            <Input
                                placeholder="Filter keys..."
                                className="pl-9 bg-card border-border focus:border-emerald-500 h-9"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                        <PutEntryDialog bucket={bucket as string} onSuccess={fetchKeys} />
                    </div>

                    <div className="flex-1 rounded-md border border-border bg-card/50 overflow-hidden flex flex-col">
                        <ScrollArea className="flex-1">
                            <Table>
                                <TableHeader className="bg-card sticky top-0 z-10">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground font-medium h-9 text-xs">Keys ({filteredKeys.length})</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && keys.length === 0 ? (
                                        <TableRow>
                                            <TableCell className="p-3">
                                                <DataTableSkeleton rows={8} columns={1} />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredKeys.length > 0 ? (
                                        filteredKeys.map((k) => (
                                            <TableRow
                                                key={k}
                                                className={`border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${selectedEntry?.key === k && 'bg-emerald-500/10'}`}
                                                onClick={() => handleFetchEntry(k)}
                                            >
                                                <TableCell className="py-2.5 px-4 font-mono text-xs text-foreground/80 flex items-center gap-2">
                                                    <Key className="size-3 text-emerald-500/50" />
                                                    {k}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell className="h-24 text-center text-muted-foreground/70 text-xs italic">
                                                No keys found
                                            </TableCell>
                                        </TableRow>
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
                                    <PutEntryDialog
                                        bucket={bucket as string}
                                        initialKey={selectedEntry.key}
                                        initialValue={selectedEntry.value}
                                        onSuccess={() => {
                                            fetchKeys();
                                            handleFetchEntry(selectedEntry.key);
                                        }}
                                        trigger={
                                            <Button variant="outline" size="sm" className="bg-muted border-border hover:bg-muted">
                                                Edit Value
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col gap-1">
                                    <span className="text-[10px] text-muted-foreground uppercase">Revision</span>
                                    <span className="text-sm font-mono text-foreground">{selectedEntry.revision}</span>
                                </div>
                                <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col gap-1">
                                    <span className="text-[10px] text-muted-foreground uppercase">Last Updated</span>
                                    <span className="text-[10px] text-foreground/80">{format(new Date(selectedEntry.created), "MMM d, HH:mm:ss")}</span>
                                </div>
                                <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col gap-1">
                                    <span className="text-[10px] text-muted-foreground uppercase">Operation</span>
                                    <Badge variant="outline" className="text-[9px] w-fit border-emerald-500/30 text-emerald-500 bg-emerald-500/5">{selectedEntry.operation}</Badge>
                                </div>
                            </div>

                            <div className="flex-1 rounded-lg border border-border bg-background flex flex-col overflow-hidden">
                                <div className="px-4 py-2 border-b border-border bg-card flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">Value Editor</span>
                                    <span className="text-[10px] text-muted-foreground/70 font-mono">Size: {(selectedEntry.value.length / 1024).toFixed(2)} KB</span>
                                </div>
                                <ScrollArea className="flex-1 p-4">
                                    <JsonViewer
                                        value={selectedEntry.value}
                                        className="text-sm"
                                        rawClassName="text-sm text-indigo-300 leading-relaxed"
                                        showBadge
                                    />
                                </ScrollArea>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-card/20 text-center">
                            <Eye className="size-12 text-muted-foreground/50 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-muted-foreground">Select a key to view details</h3>
                            <p className="text-sm text-muted-foreground/70 mt-2">
                                Choose a key from the list on the left to inspect its value and revision history.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
