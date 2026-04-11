"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Users, Loader2, Info } from "lucide-react";
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
        },
    });

    const mode = form.watch("mode");

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
        };
        if (values.mode === "push" && values.deliver_subject) {
            config.deliver_subject = values.deliver_subject.trim();
        }
        if (values.filter_subject && values.filter_subject.trim()) {
            config.filter_subject = values.filter_subject.trim();
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
            <DialogContent className="sm:max-w-[620px] bg-slate-950 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="size-5 text-amber-500" />
                        Create Consumer
                        <span className="text-xs font-mono text-slate-500 ml-2">→ {streamName}</span>
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
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
                                            <Input placeholder="my-consumer" {...field} className="bg-slate-900 border-slate-800" />
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
                                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border-slate-800">
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
                                                className="bg-slate-900 border-slate-800 font-mono"
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
                                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border-slate-800">
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
                                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border-slate-800">
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
                                                className="bg-slate-900 border-slate-800"
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
                                                className="bg-slate-900 border-slate-800"
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
                                            className="bg-slate-900 border-slate-800 font-mono"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[10px]">
                                        Restrict consumer to matching subjects. Supports `*` and `&gt;` wildcards.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                className="text-slate-400 hover:text-slate-100 hover:bg-slate-800"
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
