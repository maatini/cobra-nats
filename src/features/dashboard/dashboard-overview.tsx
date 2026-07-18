"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
    AlertCircle,
    HardDrive,
} from "lucide-react";

import type { JetStreamAccountOverview, NatsConnectionConfig } from "@/types/nats";
import { useActiveConnection } from "@/features/connections/hooks";
import { useNatsStore } from "@/features/connections/store";
import { getServerInfo } from "@/features/connections/actions";
import { listStreams, getJetStreamAccountInfo } from "@/features/streams/actions";
import { listKVBuckets } from "@/features/kv/actions";
import { ConnectDialog } from "@/features/connections/components/connect-dialog";
import { HttpMonitoringCard } from "@/features/dashboard/http-monitoring-card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefreshSelect } from "@/components/ui/auto-refresh-select";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

interface DashboardStats {
    streamCount: number | null;
    kvBucketCount: number | null;
    serverName: string | null;
    serverVersion: string | null;
    jetstream: boolean;
    account: JetStreamAccountOverview | null;
}

const EMPTY_STATS: DashboardStats = {
    streamCount: null,
    kvBucketCount: null,
    serverName: null,
    serverVersion: null,
    jetstream: false,
    account: null,
};

function formatBytes(bytes: number): string {
    if (bytes < 0) return "∞";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DashboardOverview() {
    const activeConnection = useActiveConnection();
    const { connections } = useNatsStore();
    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async (connection: NatsConnectionConfig) => {
        setLoading(true);
        setError(null);

        try {
            const [serverResult, streamsResult, kvResult, accountResult] = await Promise.allSettled([
                getServerInfo(connection),
                listStreams(connection),
                listKVBuckets(connection),
                getJetStreamAccountInfo(connection),
            ]);

            const next: DashboardStats = { ...EMPTY_STATS };

            if (serverResult.status === "fulfilled" && serverResult.value.success) {
                const info = serverResult.value.data.info;
                next.serverName = info.server_name;
                next.serverVersion = info.version;
                next.jetstream = !!info.jetstream;
            }

            // Streams/KV may fail if JetStream is not enabled — treat as 0, not error.
            next.streamCount =
                streamsResult.status === "fulfilled" && streamsResult.value.success
                    ? streamsResult.value.data.length
                    : 0;

            next.kvBucketCount =
                kvResult.status === "fulfilled" && kvResult.value.success
                    ? kvResult.value.data.buckets.length
                    : 0;

            if (accountResult.status === "fulfilled" && accountResult.value.success) {
                next.account = accountResult.value.data;
                next.jetstream = true;
            }

            setStats(next);
        } catch {
            setError("Failed to fetch dashboard data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeConnection) {
            fetchDashboardData(activeConnection);
        } else {
            setStats(EMPTY_STATS);
        }
    }, [activeConnection, fetchDashboardData]);

    const { interval, setInterval } = useAutoRefresh(
        () => {
            if (activeConnection) fetchDashboardData(activeConnection);
        },
        { storageKey: "nats-ui:dashboard:refresh-interval" }
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Cobra NATS</h1>
                    <p className="text-muted-foreground">
                        Monitor and manage your NATS infrastructure from a single dashboard.
                    </p>
                </div>
                {activeConnection && (
                    <AutoRefreshSelect interval={interval} onChange={setInterval} />
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card border-border hover:border-indigo-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Connections</CardTitle>
                        <Database className="size-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{connections.length}</div>
                        <p className="text-xs text-muted-foreground">Saved in your browser</p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border hover:border-emerald-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Server</CardTitle>
                        <Server className="size-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {activeConnection ? "Connected" : "Idle"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {activeConnection ? activeConnection.name : "No active connection"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border hover:border-amber-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Streams</CardTitle>
                        <Layers className="size-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {loading ? (
                                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                            ) : stats.streamCount !== null ? (
                                stats.streamCount
                            ) : (
                                "--"
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats.jetstream ? "JetStream enabled" : "JetStream stats"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border hover:border-rose-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">KV Buckets</CardTitle>
                        <Database className="size-4 text-rose-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {loading ? (
                                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                            ) : stats.kvBucketCount !== null ? (
                                stats.kvBucketCount
                            ) : (
                                "--"
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Key-Value stores</p>
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
                <Card className="bg-card border-border overflow-hidden">
                    <CardHeader className="border-b border-border bg-card/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg text-foreground">Active Connection</CardTitle>
                                <CardDescription className="text-muted-foreground">Server status and information</CardDescription>
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
                            <div className="divide-y divide-border">
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-md bg-indigo-500/10 p-2">
                                            <Info className="size-4 text-indigo-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-foreground">Server Name</div>
                                            <div className="text-xs text-muted-foreground">{activeConnection.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-foreground/80">
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
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
                                            <div className="text-sm font-medium text-foreground">Version</div>
                                            <div className="text-xs text-muted-foreground">NATS server version</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-foreground/80">
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
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
                                            <div className="text-sm font-medium text-foreground">JetStream</div>
                                            <div className="text-xs text-muted-foreground">Persistence engine</div>
                                        </div>
                                    </div>
                                    <div className="text-sm">
                                        {loading ? (
                                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                        ) : stats.jetstream ? (
                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                                                Enabled
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground border-border">
                                                Disabled
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4 text-sm">
                                    <div className="text-muted-foreground">Servers</div>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                        {activeConnection.servers.map((s) => (
                                            <Badge key={s} variant="secondary" className="bg-muted text-foreground/80 hover:bg-muted">
                                                {s}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                {stats.account && (
                                    <>
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-md bg-cyan-500/10 p-2">
                                                    <HardDrive className="size-4 text-cyan-400" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-foreground">File Storage</div>
                                                    <div className="text-xs text-muted-foreground">JetStream disk usage</div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-foreground/80 tabular-nums text-right">
                                                {formatBytes(stats.account.storage)}
                                                {stats.account.limits.maxStorage > 0 && (
                                                    <span className="text-muted-foreground text-xs block">
                                                        / {formatBytes(stats.account.limits.maxStorage)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-md bg-violet-500/10 p-2">
                                                    <Activity className="size-4 text-violet-400" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-foreground">Memory Storage</div>
                                                    <div className="text-xs text-muted-foreground">JetStream memory usage</div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-foreground/80 tabular-nums text-right">
                                                {formatBytes(stats.account.memory)}
                                                {stats.account.limits.maxMemory > 0 && (
                                                    <span className="text-muted-foreground text-xs block">
                                                        / {formatBytes(stats.account.limits.maxMemory)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4 text-sm">
                                            <div className="text-muted-foreground">JS Streams / Consumers</div>
                                            <div className="tabular-nums text-foreground/80">
                                                {stats.account.streams}
                                                {stats.account.limits.maxStreams > 0 && (
                                                    <span className="text-muted-foreground">/{stats.account.limits.maxStreams}</span>
                                                )}
                                                {" · "}
                                                {stats.account.consumers}
                                                {stats.account.limits.maxConsumers > 0 && (
                                                    <span className="text-muted-foreground">/{stats.account.limits.maxConsumers}</span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div className="rounded-full bg-muted p-4 mb-4">
                                    <Plus className="size-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground/80">No connection selected</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
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

                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-lg text-foreground">Quick Actions</CardTitle>
                        <CardDescription className="text-muted-foreground">Common management tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Button variant="outline" className="justify-start gap-3 h-12 border-border bg-card hover:bg-muted hover:text-indigo-400" asChild>
                            <Link href="/publish">
                                <Send className="size-4 text-indigo-400" />
                                <span>Publish Message</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-3 h-12 border-border bg-card hover:bg-muted hover:text-amber-400" asChild>
                            <Link href="/streams">
                                <Layers className="size-4 text-amber-400" />
                                <span>Create Stream</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-3 h-12 border-border bg-card hover:bg-muted hover:text-rose-400" asChild>
                            <Link href="/monitor">
                                <Monitor className="size-4 text-rose-400" />
                                <span>Open Subject Monitor</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                        <Button variant="outline" className="justify-start gap-3 h-12 border-border bg-card hover:bg-muted hover:text-emerald-400" asChild>
                            <Link href="/kv">
                                <Database className="size-4 text-emerald-400" />
                                <span>Browse KV Stores</span>
                                <ArrowRight className="size-4 ml-auto opacity-50" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {activeConnection && <HttpMonitoringCard connection={activeConnection} />}
        </div>
    );
}
