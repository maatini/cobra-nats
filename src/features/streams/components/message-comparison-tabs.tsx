"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBrowser } from "@/features/streams/components/message-browser";
import type { NatsConnectionConfig } from "@/types/nats";
import { Plus, X } from "lucide-react";

const MAX_COMPARISON_TABS = 4;

interface MessageComparisonTabsProps {
    config: NatsConnectionConfig;
    streamName: string;
    firstSeq: number;
    lastSeq: number;
}

interface ComparisonTab {
    id: number;
    label: string;
}

/** Multiple independent message-browser workspaces for comparing positions in one stream. */
export function MessageComparisonTabs({
    config,
    streamName,
    firstSeq,
    lastSeq,
}: MessageComparisonTabsProps) {
    const [tabs, setTabs] = React.useState<ComparisonTab[]>([{ id: 1, label: "Comparison 1" }]);
    const [activeId, setActiveId] = React.useState(1);
    const nextId = React.useRef(2);

    const addTab = () => {
        if (tabs.length >= MAX_COMPARISON_TABS) return;
        const id = nextId.current++;
        setTabs((current) => [...current, { id, label: `Comparison ${id}` }]);
        setActiveId(id);
    };

    const closeTab = (id: number) => {
        if (tabs.length <= 1) return;
        const index = tabs.findIndex((tab) => tab.id === id);
        const remaining = tabs.filter((tab) => tab.id !== id);
        setTabs(remaining);
        if (activeId === id) {
            setActiveId(remaining[Math.max(0, index - 1)]?.id ?? remaining[0].id);
        }
    };

    const renameTab = (id: number, label: string) => {
        setTabs((current) => current.map((tab) => tab.id === id ? { ...tab, label } : tab));
    };

    return (
        <section aria-label="Message comparison" className="space-y-4">
            <div className="rounded-md border border-border bg-card p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Message comparison</h2>
                        <p className="text-xs text-muted-foreground">
                            Independent message browsers for stream <span className="font-mono text-foreground/80">{streamName}</span>. Tabs compare positions within this stream only.
                        </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addTab} disabled={tabs.length >= MAX_COMPARISON_TABS}>
                        <Plus className="mr-1.5 size-4" /> Add comparison
                        <span className="ml-1 text-muted-foreground">({tabs.length}/{MAX_COMPARISON_TABS})</span>
                    </Button>
                </div>
                <div role="tablist" aria-label="Message comparison tabs" className="flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <div key={tab.id} className={`flex items-center gap-1 rounded-md border px-2 ${activeId === tab.id ? "border-amber-500/60 bg-amber-500/10" : "border-border bg-background"}`}>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeId === tab.id}
                                aria-controls={`comparison-panel-${tab.id}`}
                                onClick={() => setActiveId(tab.id)}
                                className="max-w-40 truncate py-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            >
                                {tab.label.trim() || `Comparison ${tab.id}`}
                            </button>
                            <Input
                                aria-label={`Rename ${tab.label || `Comparison ${tab.id}`}`}
                                value={tab.label}
                                onChange={(event) => renameTab(tab.id, event.target.value)}
                                className="h-7 w-28 border-0 bg-transparent px-1 text-xs focus-visible:ring-1"
                                maxLength={40}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Close ${tab.label || `Comparison ${tab.id}`}`}
                                title={tabs.length === 1 ? "At least one comparison tab is required" : "Close comparison tab"}
                                disabled={tabs.length === 1}
                                onClick={() => closeTab(tab.id)}
                                className="size-7 text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            {tabs.map((tab) => (
                <div
                    key={`${config.id}-${streamName}-${tab.id}`}
                    id={`comparison-panel-${tab.id}`}
                    role="tabpanel"
                    aria-label={`${tab.label || `Comparison ${tab.id}`} — ${streamName}`}
                    hidden={activeId !== tab.id}
                >
                    <MessageBrowser
                        config={config}
                        streamName={streamName}
                        firstSeq={firstSeq}
                        lastSeq={lastSeq}
                    />
                </div>
            ))}
        </section>
    );
}
