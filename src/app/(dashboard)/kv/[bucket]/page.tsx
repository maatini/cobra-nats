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

    if (!activeConnection) return <div className="p-8 text-center text-slate-500">No active connection</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="text-slate-400 hover:text-slate-100">
                        <Link href="/kv">
                            <ChevronLeft className="size-5" />
                        </Link>
                    </Button>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-100">{bucket}</h1>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">KV Store</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchKeys} className="bg-slate-900 border-slate-800 text-slate-300">
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
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Filter keys..."
                                className="pl-9 bg-slate-900 border-slate-800 focus:border-emerald-500 h-9"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                        <PutEntryDialog bucket={bucket as string} onSuccess={fetchKeys} />
                    </div>

                    <div className="flex-1 rounded-md border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col">
                        <ScrollArea className="flex-1">
                            <Table>
                                <TableHeader className="bg-slate-900 sticky top-0 z-10">
                                    <TableRow className="border-slate-800 hover:bg-transparent">
                                        <TableHead className="text-slate-400 font-medium h-9 text-xs">Keys ({filteredKeys.length})</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredKeys.length > 0 ? (
                                        filteredKeys.map((k) => (
                                            <TableRow
                                                key={k}
                                                className={`border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors ${selectedEntry?.key === k && 'bg-emerald-500/10'}`}
                                                onClick={() => handleFetchEntry(k)}
                                            >
                                                <TableCell className="py-2.5 px-4 font-mono text-xs text-slate-300 flex items-center gap-2">
                                                    <Key className="size-3 text-emerald-500/50" />
                                                    {k}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell className="h-24 text-center text-slate-600 text-xs italic">
                                                {isLoading ? "Loading keys..." : "No keys found"}
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
                            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-800">
                                <div className="flex flex-col gap-1">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Viewing Key</div>
                                    <div className="text-lg font-mono font-medium text-emerald-400">{selectedEntry.key}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <PutEntryDialog
                                        bucket={bucket as string}
                                        initialKey={selectedEntry.key}
                                        initialValue={selectedEntry.value}
                                        onSuccess={fetchKeys}
                                        trigger={
                                            <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 hover:bg-slate-700">
                                                Edit Value
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-500 uppercase">Revision</span>
                                    <span className="text-sm font-mono text-slate-200">{selectedEntry.revision}</span>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-500 uppercase">Last Updated</span>
                                    <span className="text-[10px] text-slate-300">{format(new Date(selectedEntry.created), "MMM d, HH:mm:ss")}</span>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-500 uppercase">Operation</span>
                                    <Badge variant="outline" className="text-[9px] w-fit border-emerald-500/30 text-emerald-500 bg-emerald-500/5">{selectedEntry.operation}</Badge>
                                </div>
                            </div>

                            <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
                                <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-400">Value Editor</span>
                                    <span className="text-[10px] text-slate-600 font-mono">Size: {(selectedEntry.value.length / 1024).toFixed(2)} KB</span>
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
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20 text-center">
                            <Eye className="size-12 text-slate-700 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-slate-500">Select a key to view details</h3>
                            <p className="text-sm text-slate-600 mt-2">
                                Choose a key from the list on the left to inspect its value and revision history.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
