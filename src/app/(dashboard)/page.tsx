"use client";

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
    Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ConnectDialog } from "@/components/connections/connect-dialog";

export default function DashboardPage() {
    const { connections, activeConnectionId } = useNatsStore();
    const activeConnection = connections.find((c) => c.id === activeConnectionId);

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
                        <div className="text-2xl font-bold text-slate-100">--</div>
                        <p className="text-xs text-slate-500">JetStream stats</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 hover:border-rose-500/50 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Throughput</CardTitle>
                        <Zap className="size-4 text-rose-400 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">0 B/s</div>
                        <p className="text-xs text-slate-500">Across all subjects</p>
                    </CardContent>
                </Card>
            </div>

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
                                    <div className="text-sm text-slate-300">nats-main-01</div>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-md bg-amber-500/10 p-2">
                                            <Activity className="size-4 text-amber-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">Uptime</div>
                                            <div className="text-xs text-slate-500">Time since last restart</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-300">4d 12h 30m</div>
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
