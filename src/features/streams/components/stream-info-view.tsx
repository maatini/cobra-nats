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
    HardDrive,
    GitBranch,
    Copy,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    downloadJson,
    exportStreamConfig,
} from "@/features/streams/stream-form-utils";

export function StreamInfoView({ info }: { info: StreamInfo }) {
    const renderValue = (label: string, value: string | number, icon: React.ReactNode) => (
        <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-foreground text-xs font-medium tabular-nums">
                {value === -1 || value === 0 ? (
                    <span className="text-muted-foreground/70">Infinite</span>
                ) : (
                    value
                )}
            </div>
        </div>
    );

    const handleExport = () => {
        const payload = exportStreamConfig(info.config as unknown as Record<string, unknown>);
        downloadJson(`${info.config.name}.stream.json`, payload);
        toast.success("Stream config exported");
    };

    const handleCopy = async () => {
        const payload = exportStreamConfig(info.config as unknown as Record<string, unknown>);
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        toast.success("Stream config copied");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                {info.config.mirror && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
                        Mirror of {info.config.mirror.name}
                    </Badge>
                )}
                {(info.config.sources?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                        {info.config.sources!.length} source
                        {info.config.sources!.length === 1 ? "" : "s"}
                    </Badge>
                )}
                {info.config.compression && info.config.compression !== "none" && (
                    <Badge variant="outline" className="text-[10px]">
                        compression: {String(info.config.compression)}
                    </Badge>
                )}
                {info.config.deny_delete && (
                    <Badge variant="outline" className="text-[10px]">
                        deny_delete
                    </Badge>
                )}
                {info.config.deny_purge && (
                    <Badge variant="outline" className="text-[10px]">
                        deny_purge
                    </Badge>
                )}
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCopy}>
                        <Copy className="size-3.5 mr-1.5" /> Copy JSON
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}>
                        Export JSON
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-400">
                            <Settings className="size-4" />
                            Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {info.config.description && (
                            <p className="text-xs text-muted-foreground pb-2 border-b border-border">
                                {info.config.description}
                            </p>
                        )}
                        {renderValue(
                            "Retention",
                            (info.config.retention as unknown as string).toString().toUpperCase(),
                            <Shield className="size-3" />
                        )}
                        {renderValue(
                            "Storage",
                            info.config.storage === StorageType.File ? "FILE" : "MEMORY",
                            <HardDrive className="size-3" />
                        )}
                        {renderValue("Max Messages", info.config.max_msgs, <Activity className="size-3" />)}
                        {renderValue(
                            "Max Bytes",
                            info.config.max_bytes === -1
                                ? -1
                                : `${(info.config.max_bytes / (1024 * 1024)).toFixed(1)} MB`,
                            <Database className="size-3" />
                        )}
                        {renderValue(
                            "Max Age",
                            info.config.max_age === 0
                                ? 0
                                : `${(info.config.max_age / 1e9 / 3600).toFixed(1)} hours`,
                            <Clock className="size-3" />
                        )}
                        {renderValue(
                            "Max msg size",
                            info.config.max_msg_size ?? -1,
                            <Database className="size-3" />
                        )}
                        {renderValue(
                            "Duplicate window",
                            info.config.duplicate_window
                                ? `${Math.round(Number(info.config.duplicate_window) / 1e9)}s`
                                : "default",
                            <Clock className="size-3" />
                        )}
                        {renderValue("Replicas", info.config.num_replicas, <Zap className="size-3" />)}
                        <div className="pt-4">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">
                                Subjects
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(info.config.subjects?.length ?? 0) > 0 ? (
                                    info.config.subjects!.map((s) => (
                                        <Badge
                                            key={s}
                                            variant="secondary"
                                            className="bg-muted text-indigo-400 border-border"
                                        >
                                            {s}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        {info.config.mirror ? "(mirror — no local subjects)" : "None"}
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                            <Activity className="size-4" />
                            Live State
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {renderValue(
                            "Total Messages",
                            info.state.messages.toLocaleString(),
                            <Activity className="size-3" />
                        )}
                        {renderValue(
                            "Total Bytes",
                            `${(info.state.bytes / (1024 * 1024)).toFixed(2)} MB`,
                            <Database className="size-3" />
                        )}
                        {renderValue("First Sequence", info.state.first_seq, <Info className="size-3" />)}
                        {renderValue("Last Sequence", info.state.last_seq, <Info className="size-3" />)}
                        {renderValue("Consumers", info.state.consumer_count, <Zap className="size-3" />)}
                        <div className="pt-4">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">
                                Metadata
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Created: {format(new Date(info.created), "PPP p")}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {(info.config.mirror || (info.config.sources?.length ?? 0) > 0) && (
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-400">
                            <GitBranch className="size-4" />
                            Topology
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                        {info.config.mirror && (
                            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                                <div className="font-medium text-foreground">Mirror</div>
                                <div className="font-mono text-amber-400">{info.config.mirror.name}</div>
                                {info.config.mirror.filter_subject && (
                                    <div className="text-muted-foreground">
                                        filter:{" "}
                                        <span className="font-mono">{info.config.mirror.filter_subject}</span>
                                    </div>
                                )}
                                {info.config.mirror.external?.api && (
                                    <div className="text-muted-foreground">
                                        external API:{" "}
                                        <span className="font-mono">{info.config.mirror.external.api}</span>
                                    </div>
                                )}
                                {info.mirror && (
                                    <div className="text-muted-foreground pt-1">
                                        lag: {info.mirror.lag ?? "–"} · active:{" "}
                                        {info.mirror.active != null
                                            ? String(info.mirror.active)
                                            : "–"}
                                    </div>
                                )}
                            </div>
                        )}
                        {(info.config.sources ?? []).map((src) => {
                            const live = info.sources?.find((s) => s.name === src.name);
                            return (
                                <div
                                    key={src.name}
                                    className="rounded-md border border-border bg-muted/20 p-3 space-y-1"
                                >
                                    <div className="font-medium text-foreground">Source</div>
                                    <div className="font-mono text-indigo-400">{src.name}</div>
                                    {src.filter_subject && (
                                        <div className="text-muted-foreground">
                                            filter: <span className="font-mono">{src.filter_subject}</span>
                                        </div>
                                    )}
                                    {src.external?.api && (
                                        <div className="text-muted-foreground">
                                            external API:{" "}
                                            <span className="font-mono">{src.external.api}</span>
                                        </div>
                                    )}
                                    {live && (
                                        <div className="text-muted-foreground pt-1">
                                            lag: {live.lag ?? "–"} · active:{" "}
                                            {live.active != null ? String(live.active) : "–"}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
