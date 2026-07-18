"use client";

import * as React from "react";
import { listKVBuckets, deleteKVBucket } from "@/features/kv/actions";
import type { KvStatus } from "nats";
import { KVBucketCard } from "@/features/kv/components/kv-bucket-card";
import { CreateKVDialog } from "@/features/kv/components/create-kv-dialog";
import { Database, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useUrlState } from "@/hooks/use-url-state";
import { useServerActionQuery } from "@/hooks/use-server-action-query";
import { toastAction } from "@/lib/toast-action";
import { NoConnectionAlert } from "@/components/layout/no-connection-alert";
import { ErrorAlert } from "@/components/layout/error-alert";
import { EmptyState } from "@/components/ui/empty-state";

const EMPTY_BUCKETS: KvStatus[] = [];

export function KVListView() {
    return (
        <React.Suspense fallback={null}>
            <KVListViewContent />
        </React.Suspense>
    );
}

function KVListViewContent() {
    const [urlState, setUrlState] = useUrlState({ q: "" });
    const filter = urlState.q;
    const confirm = useConfirm();

    const { data, error, isLoading, reload, connection } = useServerActionQuery(
        async (config) => {
            const result = await listKVBuckets(config);
            if (!result.success) return result;
            return { success: true as const, data: result.data.buckets || [] };
        },
        {
            emptyValue: EMPTY_BUCKETS,
            errorToast: "Failed to load KV buckets",
        }
    );

    async function handleDelete(name: string) {
        if (!connection) return;

        const ok = await confirm({
            title: `Delete bucket "${name}"?`,
            description: "This permanently removes the bucket and all its keys.",
            confirmText: "Delete Bucket",
            typedName: name,
        });
        if (!ok) return;

        const result = await toastAction(deleteKVBucket(connection, name), {
            loading: `Deleting bucket ${name}...`,
            success: () => `Bucket ${name} deleted`,
            error: "Failed to delete bucket",
        });
        if (result.success) await reload();
    }

    const filteredBuckets = data.filter((b) =>
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
                <CreateKVDialog onCreated={reload} />
            </div>

            {!connection ? (
                <NoConnectionAlert resourceLabel="buckets" />
            ) : error ? (
                <ErrorAlert message={error} />
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
                            onClick={() => void reload()}
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
                        <EmptyState
                            icon={Database}
                            title="No buckets found"
                            description="Create your first KeyValue bucket to start storing application data."
                            className="py-24 border-2 bg-card/20"
                        />
                    )}
                </div>
            )}
        </div>
    );
}
