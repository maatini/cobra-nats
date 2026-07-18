"use client";

import * as React from "react";
import { useNatsStore } from "@/features/connections/store";
import { Settings, Server, Plus, Trash2, Edit2, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectDialog } from "@/features/connections/components/connect-dialog";
import { useConfirm } from "@/components/providers/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

export function SettingsView() {
    const { connections, activeConnectionId, removeConnection, setActiveConnection } = useNatsStore();
    const confirm = useConfirm();

    const handleDeleteConnection = async (id: string, name: string) => {
        const ok = await confirm({
            title: `Remove connection "${name}"?`,
            description: "This only removes it from the UI — the NATS server itself is untouched.",
            confirmText: "Remove",
        });
        if (!ok) return;
        removeConnection(id);
        toast.success("Connection removed");
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <Settings className="size-8 text-indigo-500" />
                    Settings
                </h1>
                <p className="text-muted-foreground">Manage your NATS connections and application preferences.</p>
            </div>

            <div className="grid gap-6">
                <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                            <Server className="size-5 text-indigo-400" />
                            Connections
                        </h2>
                        <ConnectDialog
                            trigger={
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                    <Plus className="size-4" /> Add New
                                </Button>
                            }
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {connections.length > 0 ? (
                            connections.map((conn) => (
                                <Card key={conn.id} className={`bg-card border-border hover:border-border transition-colors ${activeConnectionId === conn.id ? 'ring-2 ring-indigo-500/50' : ''}`}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-col gap-1">
                                                <CardTitle className="text-lg font-bold text-foreground">{conn.name}</CardTitle>
                                                <CardDescription className="font-mono text-[10px] truncate max-w-[200px]">
                                                    {conn.servers.join(", ")}
                                                </CardDescription>
                                            </div>
                                            {activeConnectionId === conn.id && (
                                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10">Active</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Shield className="size-3 text-muted-foreground" />
                                            <span>Auth: <span className="text-foreground capitalize">{conn.authType === 'none' ? 'None' : conn.authType.replace('_', ' ')}</span></span>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-between pt-2 border-t border-border/50">
                                        <div className="flex gap-2">
                                            <ConnectDialog
                                                editingConfig={conn}
                                                trigger={
                                                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-400/10">
                                                        <Edit2 className="size-4" />
                                                    </Button>
                                                }
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10"
                                                onClick={() => handleDeleteConnection(conn.id, conn.name)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                        {activeConnectionId !== conn.id && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 bg-muted border-border text-foreground/80 hover:bg-muted hover:text-foreground"
                                                onClick={() => setActiveConnection(conn.id)}
                                            >
                                                Activate
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))
                        ) : (
                            <EmptyState
                                icon={Server}
                                title="No connections configured"
                                description="Add a NATS connection to start exploring your clusters."
                                className="col-span-full py-12 border-2 bg-card/50"
                                action={
                                    <ConnectDialog
                                        trigger={
                                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                                Add First Connection
                                            </Button>
                                        }
                                    />
                                }
                            />
                        )}
                    </div>
                </section>

                <section className="flex flex-col gap-4 mt-8">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <Info className="size-5 text-indigo-400" />
                        Application Info
                    </h2>
                    <Card className="bg-card border-border">
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-muted-foreground">Version</span>
                                        <span className="text-foreground font-mono">0.1.0</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-muted-foreground">Next.js</span>
                                        <span className="text-foreground font-mono">16.1.6</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-muted-foreground">Architecture</span>
                                        <span className="text-foreground font-mono">Server Actions + Zustand</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-muted-foreground">License</span>
                                        <span className="text-foreground">MIT</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-muted-foreground">GitHub</span>
                                        <span className="text-indigo-400 hover:underline cursor-pointer">maatini/nats-ui</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                                        <span className="text-muted-foreground">Environment</span>
                                        <span className="text-emerald-400 font-medium">Production Ready</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    );
}
