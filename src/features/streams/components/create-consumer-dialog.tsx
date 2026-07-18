"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Users, Loader2, Info, ChevronDown } from "lucide-react";
import type { ConsumerConfig as NatsConsumerConfig } from "nats";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useActiveConnection } from "@/features/connections/hooks";
import { createConsumer } from "@/features/streams/actions";

// Consumer delivery mode (push requires a deliver subject, pull does not).
const deliveryModes = ["push", "pull"] as const;
const ackPolicies = ["none", "all", "explicit"] as const;
const deliverPolicies = ["all", "last", "new", "last_per_subject"] as const;

const consumerSchema = z
    .object({
        durable_name: z
            .string()
            .min(1, "Durable name is required")
            .regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, dash and underscore allowed"),
        mode: z.enum(deliveryModes),
        deliver_subject: z.string().optional(),
        deliver_policy: z.enum(deliverPolicies),
        ack_policy: z.enum(ackPolicies),
        ack_wait_seconds: z.number().min(0),
        max_deliver: z.number().min(-1),
        filter_subject: z.string().optional(),
        description: z.string().optional(),
        max_ack_pending: z.number().min(-1),
        max_waiting: z.number().min(-1),
        headers_only: z.boolean(),
        inactive_threshold_seconds: z.number().min(0),
        filter_subjects: z.string().optional(),
    })
    .refine(
        v => v.mode !== "push" || (v.deliver_subject && v.deliver_subject.trim().length > 0),
        { message: "Deliver subject is required for push consumers", path: ["deliver_subject"] }
    );

type ConsumerFormValues = z.infer<typeof consumerSchema>;

interface CreateConsumerDialogProps {
    streamName: string;
    onCreated?: () => void;
    trigger?: React.ReactNode;
}

export function CreateConsumerDialog({ streamName, onCreated, trigger }: CreateConsumerDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const activeConnection = useActiveConnection();

    const form = useForm<ConsumerFormValues>({
        resolver: zodResolver(consumerSchema),
        defaultValues: {
            durable_name: "",
            mode: "pull",
            deliver_subject: "",
            deliver_policy: "all",
            ack_policy: "explicit",
            ack_wait_seconds: 30,
            max_deliver: -1,
            filter_subject: "",
            description: "",
            max_ack_pending: 1000,
            max_waiting: 512,
            headers_only: false,
            inactive_threshold_seconds: 0,
            filter_subjects: "",
        },
    });

    const mode = form.watch("mode");
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    async function onSubmit(values: ConsumerFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        // Assemble raw JetStream consumer config. Undefined fields are omitted
        // so the NATS server applies its defaults.
        const config: Partial<NatsConsumerConfig> = {
            durable_name: values.durable_name,
            deliver_policy: values.deliver_policy as NatsConsumerConfig["deliver_policy"],
            ack_policy: values.ack_policy as NatsConsumerConfig["ack_policy"],
            ack_wait: values.ack_wait_seconds > 0 ? values.ack_wait_seconds * 1_000_000_000 : undefined,
            max_deliver: values.max_deliver,
            description: values.description?.trim() || undefined,
            max_ack_pending: values.max_ack_pending,
            max_waiting: values.max_waiting > 0 ? values.max_waiting : undefined,
            headers_only: values.headers_only || undefined,
            inactive_threshold:
                values.inactive_threshold_seconds > 0
                    ? values.inactive_threshold_seconds * 1_000_000_000
                    : undefined,
        };
        if (values.mode === "push" && values.deliver_subject) {
            config.deliver_subject = values.deliver_subject.trim();
        }
        const multi = values.filter_subjects
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (multi && multi.length > 1) {
            config.filter_subjects = multi;
        } else if (values.filter_subject && values.filter_subject.trim()) {
            config.filter_subject = values.filter_subject.trim();
        } else if (multi && multi.length === 1) {
            config.filter_subject = multi[0];
        }

        setIsSubmitting(true);
        const result = await createConsumer(activeConnection, streamName, config as NatsConsumerConfig);
        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Consumer "${values.durable_name}" created`);
            setOpen(false);
            form.reset();
            onCreated?.();
        } else {
            toast.error("Failed to create consumer", { description: result.error });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700 gap-2">
                        <Plus className="size-4" /> Add Consumer
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px] bg-background border-border text-foreground max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="size-5 text-amber-500" />
                        Create Consumer
                        <span className="text-xs font-mono text-muted-foreground ml-2">→ {streamName}</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Add a new JetStream consumer for this stream.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-3">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="durable_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Durable Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="my-consumer" {...field} className="bg-card border-border" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="mode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mode</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-card border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value="pull">Pull</SelectItem>
                                                <SelectItem value="push">Push</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-[10px]">
                                            Push delivers to a subject, Pull is client-driven.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {mode === "push" && (
                            <FormField
                                control={form.control}
                                name="deliver_subject"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Deliver Subject</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="deliver.my-consumer"
                                                {...field}
                                                className="bg-card border-border font-mono"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">
                                            Subject where messages are pushed to subscribers.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="deliver_policy"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Deliver Policy</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-card border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="last">Last</SelectItem>
                                                <SelectItem value="new">New</SelectItem>
                                                <SelectItem value="last_per_subject">Last per Subject</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ack_policy"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ack Policy</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-card border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value="explicit">Explicit</SelectItem>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="none">None</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="ack_wait_seconds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ack Wait (seconds)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                {...field}
                                                onChange={e => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">
                                            0 = server default.
                                        </FormDescription>
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
                                                onChange={e => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">-1 = unlimited.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="filter_subject"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Filter Subject (optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="events.orders.*"
                                            {...field}
                                            className="bg-card border-border font-mono"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[10px]">
                                        Restrict consumer to matching subjects. Supports `*` and `&gt;` wildcards.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="border border-border rounded-lg">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/40"
                                onClick={() => setShowAdvanced((v) => !v)}
                            >
                                <span className="font-medium">Advanced</span>
                                <ChevronDown
                                    className={`size-4 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                                />
                            </button>
                            {showAdvanced && (
                                <div className="space-y-3 border-t border-border p-3">
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
                                            name="max_ack_pending"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Max Ack Pending</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
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
                                            name="max_waiting"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Max Waiting (pull)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
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
                                            name="inactive_threshold_seconds"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Inactive threshold (s)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            {...field}
                                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                                            className="bg-card border-border"
                                                        />
                                                    </FormControl>
                                                    <FormDescription className="text-[10px]">
                                                        0 = server default
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="filter_subjects"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Filter subjects (multi)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="a.*, b.>"
                                                            {...field}
                                                            className="bg-card border-border font-mono"
                                                        />
                                                    </FormControl>
                                                    <FormDescription className="text-[10px]">
                                                        Comma-separated; overrides single filter when 2+
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="headers_only"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={(c) => field.onChange(c === true)}
                                                    />
                                                </FormControl>
                                                <FormLabel className="text-xs font-normal cursor-pointer">
                                                    Headers only
                                                </FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="rounded-md bg-amber-500/10 p-3 border border-amber-500/20 flex gap-3">
                            <Info className="size-5 text-amber-400 shrink-0" />
                            <div className="text-xs text-amber-200 leading-relaxed">
                                Pull consumers are recommended for most workloads. Push consumers deliver to a subject and
                                are better suited for fan-out.
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting || !activeConnection}
                                className="bg-amber-600 hover:bg-amber-700 text-white min-w-[140px]"
                            >
                                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Create Consumer"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
