"use client";

import { useNatsStore } from "@/features/connections/store";
import { useActiveConnection, useConnectionHealth } from "@/features/connections/hooks";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2, Plus, Server, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConnectDialog } from "@/features/connections/components/connect-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AutoBreadcrumbs } from "@/components/layout/auto-breadcrumbs";

export function Topbar() {
    const { connections, activeConnectionId, setActiveConnection } = useNatsStore();
    const activeConnection = useActiveConnection();
    const health = useConnectionHealth();

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-indigo-400" />
            <div className="hidden md:block">
                <AutoBreadcrumbs />
            </div>
            <div className="flex-1 flex justify-end md:justify-start">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="flex items-center gap-2 px-2 text-foreground/80 hover:bg-muted hover:text-foreground"
                        >
                            <Server className="size-4 text-indigo-400" />
                            <span className="font-medium">
                                {activeConnection ? activeConnection.name : "Select Connection"}
                            </span>
                            <ChevronDown className="size-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-card border-border text-foreground">
                        <DropdownMenuLabel>Connections</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-muted" />
                        {connections.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">No connections saved</div>
                        ) : (
                            connections.map((c) => (
                                <DropdownMenuItem
                                    key={c.id}
                                    onClick={() => setActiveConnection(c.id)}
                                    className="flex items-center justify-between focus:bg-indigo-600 focus:text-white"
                                >
                                    <span>{c.name}</span>
                                    {activeConnectionId === c.id && (
                                        <Badge variant="secondary" className="bg-indigo-600/20 text-indigo-400 border-indigo-600/30">
                                            Active
                                        </Badge>
                                    )}
                                </DropdownMenuItem>
                            ))
                        )}
                        <DropdownMenuSeparator className="bg-muted" />
                        <ConnectDialog
                            trigger={
                                <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="flex items-center gap-2 focus:bg-indigo-600 focus:text-white cursor-pointer"
                                >
                                    <Plus className="size-4" />
                                    <span>Add Connection</span>
                                </DropdownMenuItem>
                            }
                        />
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex items-center gap-4">
                {health.status === "checking" ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                        <Loader2 className="size-3 animate-spin" />
                        Checking
                    </div>
                ) : health.status === "connected" ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                            <Wifi className="size-3" />
                            Connected
                        </div>
                        {health.rttMs != null && (
                            <span className="text-xs text-muted-foreground">{health.rttMs}ms</span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                        <WifiOff className="size-3" />
                        Disconnected
                    </div>
                )}
                <ThemeToggle />
                <div className="h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                    MR
                </div>
            </div>
        </header>
    );
}
