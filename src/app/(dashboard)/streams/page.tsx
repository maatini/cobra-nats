"use client";

import * as React from "react";
import { useActiveConnection } from "@/hooks/use-active-connection";
import { listStreams, deleteStream } from "@/app/actions/stream-actions";
import { getStreamConsumerStats, type ConsumerStats } from "@/app/actions/stream-consumer-stats";
import type { StreamInfo } from "nats";
import { toast } from "sonner";
import { StreamTable } from "@/components/streams/stream-table";
import { CreateStreamDialog } from "@/components/streams/create-stream-dialog";
import { Layers, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function StreamsPage() {
    const [streams, setStreams] = React.useState<StreamInfo[]>([]);
    const [consumerStats, setConsumerStats] = React.useState<Record<string, ConsumerStats> | undefined>();
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const activeConnection = useActiveConnection();

    const fetchStreams = React.useCallback(async () => {
        if (!activeConnection) {
            setStreams([]);
            setConsumerStats(undefined);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        setConsumerStats(undefined);
        const result = await listStreams(activeConnection);

        if (result.success) {
            const streamData = result.data || [];
            setStreams(streamData);

            // Fetch consumer stats asynchronously after streams load
            if (streamData.length > 0) {
                const names = streamData.map((s) => s.config.name);
                const statsResult = await getStreamConsumerStats(activeConnection, names);
                if (statsResult.success && statsResult.data) {
                    setConsumerStats(statsResult.data);
                }
            }
        } else {
            setError(result.error || "Failed to fetch streams");
            toast.error("Failed to load streams", {
                description: result.error,
            });
        }
        setIsLoading(false);
    }, [activeConnection]);

    React.useEffect(() => {
        fetchStreams();
    }, [fetchStreams]);

    async function handleDelete(name: string) {
        if (!activeConnection) return;

        const promise = deleteStream(activeConnection, name);

        toast.promise(promise, {
            loading: `Deleting stream ${name}...`,
            success: () => {
                fetchStreams();
                return `Stream ${name} deleted`;
            },
            error: (err) => `Failed to delete stream: ${err.message}`,
        });
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                        <Layers className="size-6 text-amber-500" />
                        JetStream Streams
                    </h1>
                    <p className="text-slate-400">
                        Manage your persistent message streams and configurations.
                    </p>
                </div>
                <CreateStreamDialog onCreated={fetchStreams} />
            </div>

            {!activeConnection ? (
                <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Active Connection</AlertTitle>
                    <AlertDescription>
                        Please select a NATS connection from the topbar to view and manage streams.
                    </AlertDescription>
                </Alert>
            ) : error ? (
                <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <StreamTable
                    data={streams}
                    consumerStats={consumerStats}
                    onDelete={handleDelete}
                    onRefresh={fetchStreams}
                    isLoading={isLoading}
                />
            )}
        </div>
    );
}
