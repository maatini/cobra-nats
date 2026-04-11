"use client";

import * as React from "react";
import { useActiveConnection } from "@/features/connections/hooks";
import { listKVBuckets, deleteKVBucket } from "@/features/kv/actions";
import type { KvStatus } from "nats";
import { toast } from "sonner";
import { KVBucketCard } from "@/features/kv/components/kv-bucket-card";
import { CreateKVDialog } from "@/features/kv/components/create-kv-dialog";
import { Database, AlertCircle, RefreshCcw, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useUrlState } from "@/hooks/use-url-state";

export default function KVPage() {
    return (
        <React.Suspense fallback={null}>
            <KVPageContent />
        </React.Suspense>
    );
}

function KVPageContent() {
    const [buckets, setBuckets] = React.useState<KvStatus[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [urlState, setUrlState] = useUrlState({ q: "" });
    const filter = urlState.q;
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const fetchBuckets = React.useCallback(async () => {
        if (!activeConnection) {
            setBuckets([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        const result = await listKVBuckets(activeConnection);

        if (result.success) {
            setBuckets(result.data.buckets || []);
        } else {
            setError(result.error || "Failed to fetch buckets");
            toast.error("Failed to load KV buckets", {
                description: result.error,
            });
        }
        setIsLoading(false);
    }, [activeConnection]);

    React.useEffect(() => {
        fetchBuckets();
    }, [fetchBuckets]);

    async function handleDelete(name: string) {
        if (!activeConnection) return;

        const ok = await confirm({
            title: `Delete bucket "${name}"?`,
            description: "This permanently removes the bucket and all its keys.",
            confirmText: "Delete Bucket",
            typedName: name,
        });
        if (!ok) return;

        const promise = deleteKVBucket(activeConnection, name);

        toast.promise(promise, {
            loading: `Deleting bucket ${name}...`,
            success: () => {
                fetchBuckets();
                return `Bucket ${name} deleted`;
            },
            error: (err) => `Failed to delete bucket: ${err.message}`,
        });
    }

    const filteredBuckets = buckets.filter((b) =>
        b.bucket.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Database className="size-6 text-emerald-500" />
                        KeyValue Stores
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your key-value buckets and explore their data.
                    </p>
                </div>
                <CreateKVDialog onCreated={fetchBuckets} />
            </div>

            {!activeConnection ? (
                <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Active Connection</AlertTitle>
                    <AlertDescription>
                        Please select a NATS connection from the topbar to view and manage buckets.
                    </AlertDescription>
                </Alert>
            ) : error ? (
                <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search buckets..."
                                className="pl-9 bg-card border-border focus:border-emerald-500"
                                value={filter}
                                onChange={(e) => setUrlState({ q: e.target.value })}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchBuckets}
                            disabled={isLoading}
                            className="bg-card border-border hover:bg-muted hover:text-emerald-400"
                        >
                            <RefreshCcw className={isLoading ? "size-4 animate-spin" : "size-4"} />
                        </Button>
                    </div>

                    {filteredBuckets.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredBuckets.map((bucket) => (
                                <KVBucketCard
                                    key={bucket.bucket}
                                    status={bucket}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl bg-card/20">
                            <Database className="size-12 text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-medium text-muted-foreground">No buckets found</h3>
                            <p className="text-sm text-muted-foreground/70 mt-2 max-w-sm">
                                Create your first KeyValue bucket to start storing application data.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
