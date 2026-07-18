"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Users } from "lucide-react";
import type { ConsumerInfo } from "nats";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useActiveConnection } from "@/features/connections/hooks";
import { getConsumerInfo, updateConsumer } from "@/features/streams/actions";

const updateSchema = z.object({
    ack_wait_seconds: z.number().min(0),
    max_deliver: z.number().min(-1),
    max_ack_pending: z.number().min(-1),
    filter_subject: z.string().optional(),
    description: z.string().optional(),
});

type UpdateFormValues = z.infer<typeof updateSchema>;

interface ConsumerDetailSheetProps {
    streamName: string;
    consumerName: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated?: () => void;
}

function formatLastActive(info: ConsumerInfo): string {
    const nanos = info.delivered?.last_active;
    if (nanos && Number(nanos) > 0) {
        // NATS reports last_active in nanoseconds since epoch in some versions;
        // when it's a relative/activity nanos it can be huge. Prefer `ts` when present.
        const ms = Number(nanos) > 1e15 ? Number(nanos) / 1e6 : Number(nanos) / 1e6;
        if (ms > 1e12) {
            try {
                return formatDistanceToNow(new Date(ms), { addSuffix: true });
            } catch {
                // fall through
            }
        }
    }
    if (info.ts) {
        try {
            return formatDistanceToNow(new Date(info.ts), { addSuffix: true });
        } catch {
            // fall through
        }
    }
    return formatDistanceToNow(new Date(info.created), { addSuffix: true }) + " (created)";
}

export function ConsumerDetailSheet({
    streamName,
    consumerName,
    open,
    onOpenChange,
    onUpdated,
}: ConsumerDetailSheetProps) {
    const activeConnection = useActiveConnection();
    const [info, setInfo] = React.useState<ConsumerInfo | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<UpdateFormValues>({
        resolver: zodResolver(updateSchema),
        defaultValues: {
            ack_wait_seconds: 30,
            max_deliver: -1,
            max_ack_pending: 1000,
            filter_subject: "",
            description: "",
        },
    });

    const load = React.useCallback(async () => {
        if (!activeConnection || !consumerName || !open) return;
        setLoading(true);
        const result = await getConsumerInfo(activeConnection, streamName, consumerName);
        setLoading(false);
        if (!result.success) {
            toast.error("Failed to load consumer", { description: result.error });
            return;
        }
        const c = result.data.info;
        setInfo(c);
        form.reset({
            ack_wait_seconds: c.config.ack_wait ? Math.round(Number(c.config.ack_wait) / 1e9) : 30,
            max_deliver: c.config.max_deliver ?? -1,
            max_ack_pending: c.config.max_ack_pending ?? 1000,
            filter_subject: c.config.filter_subject ?? "",
            description: c.config.description ?? "",
        });
    }, [activeConnection, consumerName, open, streamName, form]);

    React.useEffect(() => {
        void load();
    }, [load]);

    async function onSubmit(values: UpdateFormValues) {
        if (!activeConnection || !consumerName) return;

        setIsSubmitting(true);
        const result = await updateConsumer(activeConnection, streamName, consumerName, {
            ack_wait: values.ack_wait_seconds > 0 ? values.ack_wait_seconds * 1_000_000_000 : undefined,
            max_deliver: values.max_deliver,
            max_ack_pending: values.max_ack_pending,
            filter_subject: values.filter_subject?.trim() || undefined,
            description: values.description?.trim() || undefined,
        });
        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Consumer "${consumerName}" updated`);
            setInfo(result.data.info);
            onUpdated?.();
        } else {
            toast.error("Failed to update consumer", { description: result.error });
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-lg overflow-y-auto bg-background border-border">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Users className="size-5 text-amber-500" />
                        {consumerName ?? "Consumer"}
                    </SheetTitle>
                    <SheetDescription>
                        Stream <span className="font-mono">{streamName}</span>
                    </SheetDescription>
                </SheetHeader>

                {loading && !info ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground">
                        <Loader2 className="size-5 animate-spin mr-2" /> Loading…
                    </div>
                ) : info ? (
                    <div className="space-y-6 px-1 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Stat label="Mode" value={info.config.deliver_subject ? "PUSH" : "PULL"} />
                            <Stat label="Ack Policy" value={String(info.config.ack_policy).toUpperCase()} />
                            <Stat label="Pending" value={String(info.num_pending)} />
                            <Stat label="Ack Pending" value={String(info.num_ack_pending)} />
                            <Stat label="Redelivered" value={String(info.num_redelivered)} />
                            <Stat label="Waiting" value={String(info.num_waiting)} />
                            <Stat
                                label="Delivered"
                                value={`${info.delivered.stream_seq} / ${info.delivered.consumer_seq}`}
                            />
                            <Stat
                                label="Ack Floor"
                                value={`${info.ack_floor.stream_seq} / ${info.ack_floor.consumer_seq}`}
                            />
                            <Stat label="Last Active" value={formatLastActive(info)} />
                            <Stat
                                label="Created"
                                value={format(new Date(info.created), "MMM d, HH:mm:ss")}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-[10px]">
                                deliver: {String(info.config.deliver_policy)}
                            </Badge>
                            {info.config.filter_subject && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                    {info.config.filter_subject}
                                </Badge>
                            )}
                            {info.push_bound && (
                                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                                    push bound
                                </Badge>
                            )}
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-4">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Update settings
                                </div>
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="bg-card border-border" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="ack_wait_seconds"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Ack Wait (s)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        {...field}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                        className="bg-card border-border"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="max_deliver"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max Deliver</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min={-1}
                                                        {...field}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                        className="bg-card border-border"
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[10px]">-1 unlimited</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="max_ack_pending"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max Ack Pending</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min={-1}
                                                        {...field}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                        className="bg-card border-border"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="filter_subject"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Filter Subject</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        className="bg-card border-border font-mono"
                                                        placeholder="events.*"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <SheetFooter className="px-0">
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || !activeConnection}
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            "Save Changes"
                                        )}
                                    </Button>
                                </SheetFooter>
                            </form>
                        </Form>
                    </div>
                ) : (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        Consumer not found
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-card/50 border border-border rounded-lg p-3 flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className="text-sm font-mono text-foreground tabular-nums truncate" title={value}>
                {value}
            </span>
        </div>
    );
}
