"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Layers, Loader2, Info } from "lucide-react";
import { RetentionPolicy, StorageType, DiscardPolicy } from "@/lib/nats/nats-types";

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
import { useActiveConnection } from "@/hooks/use-active-connection";
import { createStream } from "@/app/actions/stream-actions";

// Time units supported for max_age. Values are nanoseconds per unit.
const MAX_AGE_UNITS = {
    s: { label: "Seconds", ns: 1_000_000_000 },
    m: { label: "Minutes", ns: 60 * 1_000_000_000 },
    h: { label: "Hours", ns: 3600 * 1_000_000_000 },
    d: { label: "Days", ns: 86400 * 1_000_000_000 },
} as const;

type MaxAgeUnit = keyof typeof MAX_AGE_UNITS;

const streamSchema = z.object({
    name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, dash and underscore allowed"),
    subjects: z.string().min(1, "At least one subject is required"),
    retention: z.nativeEnum(RetentionPolicy),
    storage: z.nativeEnum(StorageType),
    max_msgs: z.number(),
    max_bytes: z.number(),
    max_age_value: z.number().min(0),
    max_age_unit: z.enum(["s", "m", "h", "d"] as const),
    discard: z.nativeEnum(DiscardPolicy),
    replicas: z.number().min(1).max(5),
});

type StreamFormValues = z.infer<typeof streamSchema>;

interface CreateStreamDialogProps {
    onCreated?: () => void;
}

export function CreateStreamDialog({ onCreated }: CreateStreamDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const activeConnection = useActiveConnection();

    const form = useForm<StreamFormValues>({
        resolver: zodResolver(streamSchema),
        defaultValues: {
            name: "",
            subjects: "",
            retention: RetentionPolicy.Limits,
            storage: StorageType.File,
            max_msgs: -1,
            max_bytes: -1,
            max_age_value: 0,
            max_age_unit: "h",
            discard: DiscardPolicy.Old,
            replicas: 1,
        },
    });

    async function onSubmit(values: StreamFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        // Convert user-friendly value + unit into nanoseconds (0 = infinite).
        const maxAgeNs = values.max_age_value > 0
            ? values.max_age_value * MAX_AGE_UNITS[values.max_age_unit].ns
            : 0;

        setIsSubmitting(true);
        const result = await createStream(activeConnection, {
            name: values.name,
            subjects: values.subjects.split(",").map(s => s.trim()),
            retention: values.retention as unknown as import("nats").RetentionPolicy,
            storage: values.storage as unknown as import("nats").StorageType,
            max_msgs: Number(values.max_msgs),
            max_bytes: Number(values.max_bytes),
            max_age: maxAgeNs,
            discard: values.discard as unknown as import("nats").DiscardPolicy,
            num_replicas: Number(values.replicas),
        } as unknown as import("nats").StreamConfig);

        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Stream "${values.name}" created successfully`);
            setOpen(false);
            form.reset();
            onCreated?.();
        } else {
            toast.error("Failed to create stream", {
                description: result.error,
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                    <Plus className="size-4" />
                    Create Stream
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-slate-950 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="size-5 text-amber-500" />
                        Create New Stream
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Configure a new JetStream stream for message persistence.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Stream Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="MY_STREAM" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="subjects"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Subjects</FormLabel>
                                        <FormControl>
                                            <Input placeholder="events.>" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">Comma-separated subjects</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="storage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Storage Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                                            <FormControl>
                                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border-slate-800">
                                                <SelectItem value={StorageType.File}>File</SelectItem>
                                                <SelectItem value={StorageType.Memory}>Memory</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="retention"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Retention Policy</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border-slate-800">
                                                <SelectItem value={RetentionPolicy.Limits}>Limits</SelectItem>
                                                <SelectItem value={RetentionPolicy.Interest}>Interest</SelectItem>
                                                <SelectItem value={RetentionPolicy.WorkQueue}>Work Queue</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="max_msgs"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Messages</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">-1 for infinite</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="max_bytes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Bytes</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">-1 for infinite</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="replicas"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Replicas</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="max_age_value"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Max Age</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                {...field}
                                                onChange={e => field.onChange(Number(e.target.value))}
                                                className="bg-slate-900 border-slate-800"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">0 = infinite retention</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="max_age_unit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit</FormLabel>
                                        <Select
                                            onValueChange={v => field.onChange(v as MaxAgeUnit)}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border-slate-800">
                                                {(Object.keys(MAX_AGE_UNITS) as MaxAgeUnit[]).map(u => (
                                                    <SelectItem key={u} value={u}>
                                                        {MAX_AGE_UNITS[u].label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="rounded-md bg-blue-500/10 p-3 border border-blue-500/20 flex gap-3">
                            <Info className="size-5 text-blue-400 shrink-0" />
                            <div className="text-xs text-blue-300 leading-relaxed">
                                JetStream streams provide persistence for messages published to subjects.
                                Configure limits to control resource usage.
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
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
                                className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    "Create Stream"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
