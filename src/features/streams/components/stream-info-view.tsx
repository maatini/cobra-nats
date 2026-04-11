"use client";

import type { StreamInfo } from "nats";
import { StorageType } from "@/types/nats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Info,
    Settings,
    Activity,
    Database,
    Clock,
    Shield,
    Zap,
    HardDrive
} from "lucide-react";
import { format } from "date-fns";

export function StreamInfoView({ info }: { info: StreamInfo }) {
    const renderValue = (label: string, value: string | number, icon: React.ReactNode) => (
        <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-slate-200 text-xs font-medium tabular-nums">
                {value === -1 || value === 0 ? <span className="text-slate-600">Infinite</span> : value}
            </div>
        </div>
    );

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-400">
                        <Settings className="size-4" />
                        Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                    {renderValue("Retention", (info.config.retention as unknown as string).toString().toUpperCase(), <Shield className="size-3" />)}
                    {renderValue("Storage", info.config.storage === StorageType.File ? "FILE" : "MEMORY", <HardDrive className="size-3" />)}
                    {renderValue("Max Messages", info.config.max_msgs, <Activity className="size-3" />)}
                    {renderValue("Max Bytes", info.config.max_bytes === -1 ? -1 : `${(info.config.max_bytes / (1024 * 1024)).toFixed(1)} MB`, <Database className="size-3" />)}
                    {renderValue("Max Age", info.config.max_age === 0 ? 0 : `${(info.config.max_age / 1e9 / 3600).toFixed(1)} hours`, <Clock className="size-3" />)}
                    {renderValue("Replicas", info.config.num_replicas, <Zap className="size-3" />)}
                    <div className="pt-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Subjects</div>
                        <div className="flex flex-wrap gap-2">
                            {info.config.subjects?.map(s => (
                                <Badge key={s} variant="secondary" className="bg-slate-800 text-indigo-400 border-slate-700">
                                    {s}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                        <Activity className="size-4" />
                        Live State
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                    {renderValue("Total Messages", info.state.messages.toLocaleString(), <Activity className="size-3" />)}
                    {renderValue("Total Bytes", `${(info.state.bytes / (1024 * 1024)).toFixed(2)} MB`, <Database className="size-3" />)}
                    {renderValue("First Sequence", info.state.first_seq, <Info className="size-3" />)}
                    {renderValue("Last Sequence", info.state.last_seq, <Info className="size-3" />)}
                    {renderValue("Consumers", info.state.consumer_count, <Zap className="size-3" />)}
                    <div className="pt-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Metadata</div>
                        <div className="text-xs text-slate-400">
                            Created: {format(new Date(info.created), "PPP p")}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
