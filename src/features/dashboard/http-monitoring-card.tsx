"use client";

import * as React from "react";
import { Activity, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import type { HttpMonitoringEndpoint, NatsConnectionConfig } from "@/types/nats";
import { fetchHttpMonitoring } from "@/features/connections/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface HttpMonitoringCardProps {
    connection: NatsConnectionConfig;
}

function pickSummary(endpoint: HttpMonitoringEndpoint, data: Record<string, unknown>) {
    if (endpoint === "varz") {
        return [
            { label: "Connections", value: String(data.connections ?? "–") },
            { label: "In msgs", value: String(data.in_msgs ?? "–") },
            { label: "Out msgs", value: String(data.out_msgs ?? "–") },
            { label: "CPU", value: data.cpu != null ? `${data.cpu}%` : "–" },
            {
                label: "Mem",
                value:
                    typeof data.mem === "number"
                        ? `${(data.mem / (1024 * 1024)).toFixed(1)} MB`
                        : "–",
            },
            { label: "Uptime", value: String(data.uptime ?? "–") },
        ];
    }
    if (endpoint === "jsz") {
        const account = (data.account_details as unknown[] | undefined)?.[0] as
            | Record<string, unknown>
            | undefined;
        const streamDetail = account?.stream_detail;
        const streamCount = Array.isArray(streamDetail) ? streamDetail.length : undefined;
        return [
            { label: "Memory", value: String(data.memory ?? account?.memory ?? "–") },
            { label: "Storage", value: String(data.storage ?? account?.storage ?? "–") },
            { label: "Streams", value: String(data.streams ?? streamCount ?? "–") },
            { label: "Consumers", value: String(data.consumers ?? "–") },
            { label: "Messages", value: String(data.messages ?? "–") },
            { label: "Bytes", value: String(data.bytes ?? "–") },
        ];
    }
    // connz
    const connections = (data.connections as unknown[] | undefined) ?? [];
    return [
        { label: "Num connections", value: String(data.num_connections ?? connections.length) },
        { label: "Total", value: String(data.total ?? "–") },
        { label: "Offset", value: String(data.offset ?? 0) },
        { label: "Limit", value: String(data.limit ?? "–") },
    ];
}

export function HttpMonitoringCard({ connection }: HttpMonitoringCardProps) {
    const [endpoint, setEndpoint] = React.useState<HttpMonitoringEndpoint>("varz");
    const [loading, setLoading] = React.useState(false);
    const [data, setData] = React.useState<Record<string, unknown> | null>(null);
    const monitoringUrl = connection.monitoringUrl?.trim();

    const load = React.useCallback(async () => {
        if (!monitoringUrl) return;
        setLoading(true);
        const result = await fetchHttpMonitoring(monitoringUrl, endpoint);
        setLoading(false);
        if (!result.success) {
            toast.error("Monitoring fetch failed", { description: result.error });
            setData(null);
            return;
        }
        setData(result.data.data);
    }, [monitoringUrl, endpoint]);

    React.useEffect(() => {
        if (monitoringUrl) void load();
        else setData(null);
    }, [monitoringUrl, load]);

    if (!monitoringUrl) {
        return (
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-lg text-foreground flex items-center gap-2">
                        <Activity className="size-4 text-sky-400" />
                        HTTP Monitoring
                    </CardTitle>
                    <CardDescription>
                        Set a monitoring URL on the connection (e.g. http://localhost:8222) under Settings
                        to load varz / jsz / connz.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const summary = data ? pickSummary(endpoint, data) : [];

    return (
        <Card className="bg-card border-border">
            <CardHeader className="border-b border-border bg-card/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-lg text-foreground flex items-center gap-2">
                            <Activity className="size-4 text-sky-400" />
                            HTTP Monitoring
                        </CardTitle>
                        <CardDescription className="font-mono text-[11px]">{monitoringUrl}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select
                            value={endpoint}
                            onValueChange={(v) => setEndpoint(v as HttpMonitoringEndpoint)}
                        >
                            <SelectTrigger className="w-[110px] h-8 bg-card border-border text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="varz">varz</SelectItem>
                                <SelectItem value="jsz">jsz</SelectItem>
                                <SelectItem value="connz">connz</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => void load()}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <RefreshCcw className="size-3.5" />
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {loading && !data ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                        <Loader2 className="size-4 animate-spin" /> Loading…
                    </div>
                ) : data ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {summary.map((s) => (
                                <div
                                    key={s.label}
                                    className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-1"
                                >
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                        {s.label}
                                    </span>
                                    <span className="text-sm font-mono tabular-nums text-foreground truncate">
                                        {s.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Raw JSON
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px]">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        </details>
                    </>
                ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                        No data. Check the monitoring URL and that the NATS monitoring port is reachable
                        from the Next.js server.
                    </div>
                )}
                <Badge variant="outline" className="text-[10px]">
                    Server-side fetch · not browser CORS
                </Badge>
            </CardContent>
        </Card>
    );
}
