"use client";

import * as React from "react";
import {
    listStreams,
    deleteStream,
    getStreamConsumerStats,
    type ConsumerStats,
} from "@/features/streams/actions";
import type { StreamInfo } from "nats";
import { StreamTable } from "@/features/streams/components/stream-table";
import { CreateStreamDialog } from "@/features/streams/components/create-stream-dialog";
import { Layers } from "lucide-react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useActiveConnection } from "@/features/connections/hooks";
import { toastAction } from "@/lib/toast-action";
import { NoConnectionAlert } from "@/components/layout/no-connection-alert";
import { ErrorAlert } from "@/components/layout/error-alert";
import { toast } from "sonner";

export function StreamsListView() {
    const [streams, setStreams] = React.useState<StreamInfo[]>([]);
    const [consumerStats, setConsumerStats] = React.useState<
        Record<string, ConsumerStats> | undefined
    >();
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const fetchStreams = React.useCallback(async () => {
        if (!activeConnection) {
            setStreams([]);
            setConsumerStats(undefined);
            setIsLoading(false);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        setConsumerStats(undefined);
        const result = await listStreams(activeConnection);

        if (result.success) {
            const streamData = result.data || [];
            setStreams(streamData);

            if (streamData.length > 0) {
                const names = streamData.map((s) => s.config.name);
                const statsResult = await getStreamConsumerStats(activeConnection, names);
                if (statsResult.success && statsResult.data) {
                    setConsumerStats(statsResult.data);
                }
            }
        } else {
            setError(result.error || "Failed to fetch streams");
            toast.error("Failed to load streams", { description: result.error });
        }
        setIsLoading(false);
    }, [activeConnection]);

    React.useEffect(() => {
        void fetchStreams();
    }, [fetchStreams]);

    async function handleDelete(name: string) {
        if (!activeConnection) return;

        const ok = await confirm({
            title: `Delete stream "${name}"?`,
            description:
                "This permanently removes the stream and all its messages. This action cannot be undone.",
            confirmText: "Delete Stream",
            typedName: name,
        });
        if (!ok) return;

        const result = await toastAction(deleteStream(activeConnection, name), {
            loading: `Deleting stream ${name}...`,
            success: () => `Stream ${name} deleted`,
            error: "Failed to delete stream",
        });
        if (result.success) await fetchStreams();
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Layers className="size-6 text-amber-500" />
                        JetStream Streams
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your persistent message streams and configurations.
                    </p>
                </div>
                <CreateStreamDialog onCreated={fetchStreams} />
            </div>

            {!activeConnection ? (
                <NoConnectionAlert resourceLabel="streams" />
            ) : error ? (
                <ErrorAlert message={error} />
            ) : (
                <React.Suspense fallback={null}>
                    <StreamTable
                        data={streams}
                        consumerStats={consumerStats}
                        onDelete={handleDelete}
                        onRefresh={fetchStreams}
                        isLoading={isLoading}
                    />
                </React.Suspense>
            )}
        </div>
    );
}
