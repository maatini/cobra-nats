"use client";

import * as React from "react";
import {
    listStreams,
    deleteStream,
    getStreamConsumerStats,
    type ConsumerStats,
} from "@/features/streams/actions";
import type { StreamInfoDto } from "@/types/nats";
import { StreamTable } from "@/features/streams/components/stream-table";
import { CreateStreamDialog } from "@/features/streams/components/create-stream-dialog";
import { ImportStreamConfigDialog } from "@/features/streams/components/import-stream-config-dialog";
import { Layers } from "lucide-react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useActiveConnection } from "@/features/connections/hooks";
import { toastAction } from "@/lib/toast-action";
import { NoConnectionAlert } from "@/components/layout/no-connection-alert";
import { ErrorAlert } from "@/components/layout/error-alert";
import { toast } from "sonner";

type StreamsSnapshot =
    | { ok: true; connectionId: string; streams: StreamInfoDto[]; stats?: Record<string, ConsumerStats> }
    | { ok: false; connectionId: string; error: string };

export function StreamsListView() {
    const [streams, setStreams] = React.useState<StreamInfoDto[]>([]);
    const [consumerStats, setConsumerStats] = React.useState<
        Record<string, ConsumerStats> | undefined
    >();
    const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
    const [isFetching, setIsFetching] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const connectionId = activeConnection?.id ?? null;
    // Loading while a fetch is in flight or while the rows on screen belong to another connection.
    const isLoading = isFetching || loadedFor !== connectionId;

    const fetchStreams = React.useCallback(async (): Promise<StreamsSnapshot | null> => {
        if (!activeConnection) return null;

        const result = await listStreams(activeConnection);

        if (!result.success) {
            toast.error("Failed to load streams", { description: result.error });
            return {
                ok: false,
                connectionId: activeConnection.id,
                error: result.error || "Failed to fetch streams",
            };
        }

        const streamData = result.data || [];
        let stats: Record<string, ConsumerStats> | undefined;
        if (streamData.length > 0) {
            const names = streamData.map((s) => s.config.name);
            const statsResult = await getStreamConsumerStats(activeConnection, names);
            if (statsResult.success && statsResult.data) {
                stats = statsResult.data;
            }
        }

        return { ok: true, connectionId: activeConnection.id, streams: streamData, stats };
    }, [activeConnection]);

    const applyStreams = React.useCallback((snapshot: StreamsSnapshot | null) => {
        if (!snapshot) return;
        if (snapshot.ok) {
            setStreams(snapshot.streams);
            setConsumerStats(snapshot.stats);
            setError(null);
        } else {
            setError(snapshot.error);
            setConsumerStats(undefined);
        }
        setIsFetching(false);
        setLoadedFor(snapshot.connectionId);
    }, []);

    const refresh = React.useCallback(() => {
        if (!activeConnection) return;
        setIsFetching(true);
        void fetchStreams().then(applyStreams);
    }, [activeConnection, fetchStreams, applyStreams]);

    React.useEffect(() => {
        void fetchStreams().then(applyStreams);
    }, [fetchStreams, applyStreams]);

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
        if (result.success) refresh();
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
                <div className="flex items-center gap-2">
                    <ImportStreamConfigDialog onImported={refresh} />
                    <CreateStreamDialog onCreated={refresh} />
                </div>
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
                        onRefresh={refresh}
                        isLoading={isLoading}
                    />
                </React.Suspense>
            )}
        </div>
    );
}
