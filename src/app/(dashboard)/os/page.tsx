"use client";

import * as React from "react";
import { useActiveConnection } from "@/hooks/use-active-connection";
import { listOSBuckets, deleteOSBucket } from "@/app/actions/os-actions";
import type { OsBucketInfo } from "@/lib/nats/nats-types";
import { toast } from "sonner";
import { OSBucketCard } from "@/components/os/os-bucket-card";
import { CreateOSDialog } from "@/components/os/create-os-dialog";
import { HardDrive, AlertCircle, RefreshCcw, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OSPage() {
    const [buckets, setBuckets] = React.useState<OsBucketInfo[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [filter, setFilter] = React.useState("");
    const activeConnection = useActiveConnection();

    const fetchBuckets = React.useCallback(async () => {
        if (!activeConnection) {
            setBuckets([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        const result = await listOSBuckets(activeConnection);

        if (result.success) {
            setBuckets(result.data.buckets || []);
        } else {
            setError(result.error || "Failed to fetch buckets");
            toast.error("Failed to load Object Store buckets", {
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

        const promise = deleteOSBucket(activeConnection, name);

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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                        <HardDrive className="size-6 text-cyan-500" />
                        Object Stores
                    </h1>
                    <p className="text-slate-400">
                        Manage your object store buckets and browse stored files.
                    </p>
                </div>
                <CreateOSDialog onCreated={fetchBuckets} />
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
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search buckets..."
                                className="pl-9 bg-slate-900 border-slate-800 focus:border-cyan-500"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchBuckets}
                            disabled={isLoading}
                            className="bg-slate-900 border-slate-800 hover:bg-slate-800 hover:text-cyan-400"
                        >
                            <RefreshCcw className={isLoading ? "size-4 animate-spin" : "size-4"} />
                        </Button>
                    </div>

                    {filteredBuckets.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredBuckets.map((bucket) => (
                                <OSBucketCard
                                    key={bucket.bucket}
                                    bucket={bucket}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                            <HardDrive className="size-12 text-slate-700 mb-4" />
                            <h3 className="text-lg font-medium text-slate-400">No buckets found</h3>
                            <p className="text-sm text-slate-600 mt-2 max-w-sm">
                                Create your first Object Store bucket to start storing binary files.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
