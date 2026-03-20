"use client";

import { useActiveConnection } from "@/hooks/use-active-connection";
import { useNatsStore } from "@/store/useNatsStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Activity,
    Layers,
    Database,
    Server,
    Zap,
    Plus,
    Info,
    ArrowRight,
    Send,
    Monitor,
    Loader2,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ConnectDialog } from "@/components/connections/connect-dialog";
import { useEffect, useState, useCallback } from "react";
import { listStreams } from "@/app/actions/stream-actions";
import { listKVBuckets } from "@/app/actions/kv-actions";
import { getServerInfo } from "@/app/actions/nats-actions";
import type { NatsConnectionConfig } from "@/lib/nats/nats-types";

interface DashboardStats {
    streamCount: number | null;
    kvBucketCount: number | null;
    serverName: string | null;
    serverVersion: string | null;
    jetstream: boolean;
    host: string | null;
    port: number | null;
}

export default function DashboardPage() {
    const activeConnection = useActiveConnection();
    const { connections } = useNatsStore();
    const [stats, setStats] = useState<DashboardStats>({
        streamCount: null,
        kvBucketCount: null,
        serverName: null,
        serverVersion: null,
        jetstream: false,
        host: null,
        port: null,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async (connection: NatsConnectionConfig) => {
        setLoading(true);
        setError(null);

        try {
            // Fetch server info and JetStream data in parallel
            const [serverResult, streamsResult, kvResult] = await Promise.allSettled([
                getServerInfo(connection),
                listStreams(connection),
                listKVBuckets(connection),
            ]);

            const newStats: DashboardStats = {
                streamCount: null,
                kvBucketCount: null,
                serverName: null,
                serverVersion: null,
                jetstream: false,
                host: null,
                port: null,
            };

            // Process server info
            if (serverResult.status === "fulfilled" && serverResult.value.success && serverResult.value.data) {
                const info = serverResult.value.data.info;
                newStats.serverName = info.server_name;
                newStats.serverVersion = info.version;
                newStats.jetstream = !!info.jetstream;
                newStats.host = info.host;
                newStats.port = info.port;
            }

            // Process streams (may fail if JetStream not enabled)
            if (streamsResult.status === "fulfilled" && streamsResult.value.success && streamsResult.value.data) {
                newStats.streamCount = streamsResult.value.data.length;
            } else {
                newStats.streamCount = 0;
            }

            // Process KV (may fail if JetStream not enabled)
            if (kvResult.status === "fulfilled" && kvResult.value.success && kvResult.value.data) {
                newStats.kvBucketCount = kvResult.value.data.buckets.length;
            } else {
                newStats.kvBucketCount = 0;
            }

            setStats(newStats);
        } catch {
            setError("Failed to fetch dashboard data");
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch data when connection changes
    useEffect(() => {
        if (activeConnection) {
            fetchDashboardData(activeConnection as NatsConnectionConfig);
        } else {
            // Reset stats when no connection
            setStats({
                streamCount: null,
                kvBucketCount: null,
                serverName: null,
                serverVersion: null,
                jetstream: false,
                host: null,
                port: null,
            });
        }
    }, [activeConnection, fetchDashboardData]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-100">Welcome to Cobra NATS</h1>
                <p className="text-slate-400">
                    Monitor and manage your NATS infrastructure from a single dashboard.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Connections</CardTitle>
                        <Database className="size-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">{connections.length}</div>
                        <p className="text-xs text-slate-500">Saved in your browser</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 hover:border-emerald-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Active Server</CardTitle>
                        <Server className="size-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">
                            {activeConnection ? "Connected" : "Idle"}
                        </div>
                        <p className="text-xs text-slate-500">
                            {activeConnection ? activeConnection.name : "No active connection"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 hover:border-amber-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Streams</CardTitle>
                        <Layers className="size-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">
                            {loading ? (
                                <Loader2 className="size-5 animate-spin text-slate-500" />
                            ) : stats.streamCount !== null ? (
                                stats.streamCount
                            ) : (
                                "--"
                            )}
                        </div>
                        <p className="text-xs text-slate-500">
                            {stats.jetstream ? "JetStream enabled" : "JetStream stats"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 hover:border-rose-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">KV Buckets</CardTitle>
                        <Database className="size-4 text-rose-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">
                            {loading ? (
                                <Loader2 className="size-5 animate-spin text-slate-500" />
                            ) : stats.kvBucketCount !== null ? (
                                stats.kvBucketCount
                            ) : (
                                "--"
                            )}
                        </div>
                        <p className="text-xs text-slate-500">Key-Value stores</p>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
                    <AlertCircle className="size-4" />
                    {error}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg text-slate-100">Active Connection</CardTitle>
                                <CardDescription className="text-slate-400">Server status and information</CardDescription>
                            </div>
                            {activeConnection && (
                                <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5 px-3 py-1">
                                    Online
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {activeConnection ? (
                            <div className="divide-y divide-slate-800">
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-md bg-indigo-500/10 p-2">
                                            <Info className="size-4 text-indigo-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">Server Name</div>
                                            <div className="text-xs text-slate-500">{activeConnection.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin text-slate-500" />
                                        ) : (
                                            stats.serverName || "–"
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-md bg-amber-500/10 p-2">
                                            <Activity className="size-4 text-amber-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">Version</div>
                                            <div className="text-xs text-slate-500">NATS server version</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin text-slate-500" />
                                        ) : stats.serverVersion ? (
                                            `v${stats.serverVersion}`
                                        ) : (
                                            "–"
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-md bg-emerald-500/10 p-2">
                                            <Zap className="size-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">JetStream</div>
                                            <div className="text-xs text-slate-500">Persistence engine</div>
                                        </div>
                                    </div>
                                    <div className="text-sm">
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin text-slate-500" />
                                        ) : stats.jetstream ? (
                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                                                Enabled
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-500 border-slate-700">
                                                Disabled
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4 text-sm">
                                    <div className="text-slate-400">Servers</div>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                        {activeConnection.servers.map((s) => (
                                            <Badge key={s} variant="secondary" className="bg-slate-800 text-slate-300 hover:bg-slate-700">
                                                {s}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div className="rounded-full bg-slate-800 p-4 mb-4">
                                    <Plus className="size-8 text-slate-500" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-300">No connection selected</h3>
                                <p className="text-sm text-slate-500 mt-2 max-w-xs">
                                    Select an existing connection from the topbar or create a new one to start monitoring.
                                </p>
                                <ConnectDialog
                                    trigger={
                                        <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white">
                                            Create New Connection
                                        </Button>
                                    }
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-slate-100">Quick Actions</CardTitle>
                        <CardDescription className="text-slate-400">Common management tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Button variant="outline" className="justify-start gap-3 h-12 border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-indigo-400" asChild>
                            <Link href="/publish">
                                <Send className="size-4 text-indigo-400" />
                                <span>Publish Message</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-3 h-12 border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-amber-400" asChild>
                            <Link href="/streams">
                                <Layers className="size-4 text-amber-400" />
                                <span>Create Stream</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-3 h-12 border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-rose-400" asChild>
                            <Link href="/monitor">
                                <Monitor className="size-4 text-rose-400" />
                                <span>Open Subject Monitor</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-3 h-12 border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-emerald-400" asChild>
                            <Link href="/kv">
                                <Database className="size-4 text-emerald-400" />
                                <span>Browse KV Stores</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
