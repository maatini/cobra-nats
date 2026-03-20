"use client";

import { useNatsStore } from "@/store/useNatsStore";
import { useActiveConnection } from "@/hooks/use-active-connection";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, Server, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConnectDialog } from "@/components/connections/connect-dialog";

export function Topbar() {
    const { connections, activeConnectionId, setActiveConnection } = useNatsStore();
    const activeConnection = useActiveConnection();

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-md lg:px-6">
            <SidebarTrigger className="-ml-1 text-slate-400 hover:text-indigo-400" />
            <div className="flex-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="flex items-center gap-2 px-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                        >
                            <Server className="size-4 text-indigo-400" />
                            <span className="font-medium">
                                {activeConnection ? activeConnection.name : "Select Connection"}
                            </span>
                            <ChevronDown className="size-4 text-slate-500" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-slate-900 border-slate-700 text-slate-200">
                        <DropdownMenuLabel>Connections</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        {connections.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-slate-500">No connections saved</div>
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
                        <DropdownMenuSeparator className="bg-slate-700" />
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
                {activeConnection ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                            <Wifi className="size-3" />
                            Connected
                        </div>
                        <span className="text-xs text-slate-500">12ms</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-700">
                        <WifiOff className="size-3" />
                        Disconnected
                    </div>
                )}
                <div className="h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                    MR
                </div>
            </div>
        </header>
    );
}
