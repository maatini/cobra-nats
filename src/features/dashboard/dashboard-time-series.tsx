"use client";

import type { DashboardSample } from "@/features/dashboard/sampler";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardTimeSeriesProps {
    samples: DashboardSample[];
}

interface SeriesDefinition {
    key: "streamCount" | "consumers" | "storageBytes";
    title: string;
    unit: string;
    format: (value: number) => string;
}

const SERIES: SeriesDefinition[] = [
    { key: "streamCount", title: "JetStream streams", unit: "streams", format: (value) => String(value) },
    { key: "consumers", title: "JetStream consumers", unit: "consumers", format: (value) => String(value) },
    {
        key: "storageBytes",
        title: "JetStream storage",
        unit: "bytes",
        format: (value) => `${(value / (1024 * 1024)).toFixed(1)} MiB`,
    },
];

function Sparkline({ samples, series }: { samples: DashboardSample[]; series: SeriesDefinition }) {
    const available = samples
        .map((sample) => ({ sampledAt: sample.sampledAt, value: sample[series.key] }))
        .filter((point): point is { sampledAt: number; value: number } => point.value !== null);
    const width = 280;
    const height = 72;
    const min = Math.min(...available.map((point) => point.value));
    const max = Math.max(...available.map((point) => point.value));
    const span = max - min || 1;
    const coordinates = available.map((point, index) => ({
        x: available.length === 1 ? width / 2 : (index / (available.length - 1)) * width,
        y: height - 6 - ((point.value - min) / span) * (height - 12),
        ...point,
    }));
    const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
    const latest = available.at(-1);

    return (
        <Card className="bg-card border-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">{series.title}</CardTitle>
                <CardDescription>Sampled locally · {series.unit}</CardDescription>
            </CardHeader>
            <CardContent>
                {available.length === 0 ? (
                    <p className="flex h-[72px] items-center justify-center text-sm text-muted-foreground" role="status">
                        No samples available for this metric.
                    </p>
                ) : (
                    <>
                        <svg
                            viewBox={`0 0 ${width} ${height}`}
                            className="h-[72px] w-full overflow-visible"
                            role="img"
                            aria-label={`${series.title} over ${available.length} dashboard samples`}
                        >
                            <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400" />
                            {coordinates.map((point) => (
                                <circle key={point.sampledAt} cx={point.x} cy={point.y} r="2.5" className="fill-sky-300">
                                    <title>{`${new Date(point.sampledAt).toLocaleString()}: ${series.format(point.value)} ${series.unit}`}</title>
                                </circle>
                            ))}
                        </svg>
                        <div className="mt-2 flex items-end justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                                {available.length} sample{available.length === 1 ? "" : "s"} · {new Date(available[0]!.sampledAt).toLocaleTimeString()} to {new Date(available.at(-1)!.sampledAt).toLocaleTimeString()}
                            </p>
                            <p className="text-sm font-semibold tabular-nums" aria-label={`Latest ${series.title}`}>
                                {series.format(latest!.value)} {series.unit}
                            </p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export function DashboardTimeSeries({ samples }: DashboardTimeSeriesProps) {
    return (
        <section aria-labelledby="dashboard-history-heading" className="space-y-3">
            <div>
                <h2 id="dashboard-history-heading" className="text-lg font-semibold">Recent dashboard history</h2>
                <p className="text-sm text-muted-foreground">In-memory samples for the active connection only. Up to 60 successful refreshes; history is not persisted.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {SERIES.map((series) => <Sparkline key={series.key} samples={samples} series={series} />)}
            </div>
        </section>
    );
}
