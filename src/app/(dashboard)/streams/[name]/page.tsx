"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveConnection } from "@/hooks/use-active-connection";
import { getStreamInfo, deleteStream } from "@/app/actions/stream-actions";
import { listConsumers, deleteConsumer } from "@/app/actions/consumer-actions";
import type { StreamInfo, ConsumerInfo } from "nats";
import { toast } from "sonner";
import {
    ChevronLeft,
    RefreshCcw,
    Trash2,
    Info,
    Users,
    MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StreamInfoView } from "@/components/streams/stream-info-view";
import { ConsumerList } from "@/components/streams/consumer-list";
import { CreateConsumerDialog } from "@/components/streams/create-consumer-dialog";
import { MessageBrowser } from "@/components/streams/message-browser";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/providers/confirm-provider";
import Link from "next/link";

export default function StreamDetailPage() {
    const { name } = useParams();
    const router = useRouter();
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const [streamInfo, setStreamInfo] = React.useState<StreamInfo | null>(null);
    const [consumers, setConsumers] = React.useState<ConsumerInfo[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const fetchData = React.useCallback(async () => {
        if (!activeConnection || !name) return;

        setIsLoading(true);
        const [infoResult, consumersResult] = await Promise.all([
            getStreamInfo(activeConnection, name as string),
            listConsumers(activeConnection, name as string)
        ]);

        if (infoResult.success) {
            setStreamInfo(infoResult.data!);
        } else {
            toast.error("Failed to load stream info");
        }

        if (consumersResult.success) {
            setConsumers(consumersResult.data.consumers || []);
        }

        setIsLoading(false);
    }, [activeConnection, name]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDeleteStream = async () => {
        if (!activeConnection || !name) return;
        const ok = await confirm({
            title: `Delete stream "${name}"?`,
            description: "This permanently removes the stream and all its messages. This action cannot be undone.",
            confirmText: "Delete Stream",
        });
        if (!ok) return;

        const result = await deleteStream(activeConnection, name as string);
        if (result.success) {
            toast.success("Stream deleted");
            router.push("/streams");
        } else {
            toast.error("Failed to delete stream");
        }
    };

    const handleDeleteConsumer = async (consumerName: string) => {
        if (!activeConnection || !name) return;

        const result = await deleteConsumer(activeConnection, name as string, consumerName);
        if (result.success) {
            toast.success("Consumer deleted");
            fetchData();
        } else {
            toast.error("Failed to delete consumer");
        }
    };

    if (!activeConnection) return <div className="p-8 text-center text-slate-500">No active connection</div>;
    if (isLoading && !streamInfo) return <div className="p-8 text-center text-slate-500">Loading...</div>;
    if (!streamInfo) return <div className="p-8 text-center text-slate-500">Stream not found</div>;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="text-slate-400 hover:text-slate-100">
                        <Link href="/streams">
                            <ChevronLeft className="size-5" />
                        </Link>
                    </Button>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-100">{name}</h1>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">JetStream</Badge>
                        </div>
                        <p className="text-xs text-slate-500 font-mono italic">
                            Created {new Date(streamInfo.created).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData} className="bg-slate-900 border-slate-800 text-slate-300">
                        <RefreshCcw className="size-4 mr-2" /> Refresh
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDeleteStream}>
                        <Trash2 className="size-4 mr-2" /> Delete
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="info" className="w-full">
                <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6">
                    <TabsTrigger value="info" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Info className="size-4 mr-2" /> Info
                    </TabsTrigger>
                    <TabsTrigger value="consumers" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Users className="size-4 mr-2" /> Consumers ({streamInfo.state.consumer_count})
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <MessageSquare className="size-4 mr-2" /> Messages (Peek)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="outline-none">
                    <StreamInfoView info={streamInfo} />
                </TabsContent>

                <TabsContent value="consumers" className="outline-none">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-slate-200">Processing Consumers</h3>
                            <CreateConsumerDialog streamName={name as string} onCreated={fetchData} />
                        </div>
                        <ConsumerList
                            consumers={consumers}
                            streamName={name as string}
                            onDelete={handleDeleteConsumer}
                            onCreated={fetchData}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="messages" className="outline-none">
                    <MessageBrowser
                        config={activeConnection}
                        streamName={name as string}
                        firstSeq={streamInfo.state.first_seq}
                        lastSeq={streamInfo.state.last_seq}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
