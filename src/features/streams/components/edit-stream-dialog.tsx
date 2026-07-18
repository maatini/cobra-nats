"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Pencil, Layers, Loader2 } from "lucide-react";
import { RetentionPolicy, StorageType, DiscardPolicy } from "@/types/nats";
import type { StreamInfo } from "nats";

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
import { updateStream } from "@/features/streams/actions";

const MAX_AGE_UNITS = {
    s: { label: "Seconds", ns: 1_000_000_000 },
    m: { label: "Minutes", ns: 60 * 1_000_000_000 },
    h: { label: "Hours", ns: 3600 * 1_000_000_000 },
    d: { label: "Days", ns: 86400 * 1_000_000_000 },
} as const;

type MaxAgeUnit = keyof typeof MAX_AGE_UNITS;

function nsToAgeFields(ns: number): { value: number; unit: MaxAgeUnit } {
    if (!ns || ns <= 0) return { value: 0, unit: "h" };
    for (const unit of ["d", "h", "m", "s"] as MaxAgeUnit[]) {
        const factor = MAX_AGE_UNITS[unit].ns;
        if (ns % factor === 0) {
            return { value: ns / factor, unit };
        }
    }
    // Fallback: hours with fractional rounding
    return { value: Math.round(ns / MAX_AGE_UNITS.h.ns), unit: "h" };
}

const streamEditSchema = z.object({
    subjects: z.string().min(1, "At least one subject is required"),
    max_msgs: z.number(),
    max_bytes: z.number(),
    max_age_value: z.number().min(0),
    max_age_unit: z.enum(["s", "m", "h", "d"] as const),
    discard: z.nativeEnum(DiscardPolicy),
    replicas: z.number().min(1).max(5),
});

type StreamEditFormValues = z.infer<typeof streamEditSchema>;

interface EditStreamDialogProps {
    info: StreamInfo;
    onUpdated?: () => void;
    trigger?: React.ReactNode;
}

export function EditStreamDialog({ info, onUpdated, trigger }: EditStreamDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const activeConnection = useActiveConnection();
    const age = nsToAgeFields(info.config.max_age ?? 0);

    const form = useForm<StreamEditFormValues>({
        resolver: zodResolver(streamEditSchema),
        defaultValues: {
            subjects: (info.config.subjects ?? []).join(", "),
            max_msgs: info.config.max_msgs ?? -1,
            max_bytes: info.config.max_bytes ?? -1,
            max_age_value: age.value,
            max_age_unit: age.unit,
            discard: (info.config.discard as DiscardPolicy) ?? DiscardPolicy.Old,
            replicas: info.config.num_replicas ?? 1,
        },
    });

    React.useEffect(() => {
        if (!open) return;
        const nextAge = nsToAgeFields(info.config.max_age ?? 0);
        form.reset({
            subjects: (info.config.subjects ?? []).join(", "),
            max_msgs: info.config.max_msgs ?? -1,
            max_bytes: info.config.max_bytes ?? -1,
            max_age_value: nextAge.value,
            max_age_unit: nextAge.unit,
            discard: (info.config.discard as DiscardPolicy) ?? DiscardPolicy.Old,
            replicas: info.config.num_replicas ?? 1,
        });
    }, [open, info, form]);

    async function onSubmit(values: StreamEditFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        const maxAgeNs =
            values.max_age_value > 0
                ? values.max_age_value * MAX_AGE_UNITS[values.max_age_unit].ns
                : 0;

        setIsSubmitting(true);
        const result = await updateStream(activeConnection, info.config.name, {
            subjects: values.subjects.split(",").map((s) => s.trim()).filter(Boolean),
            max_msgs: Number(values.max_msgs),
            max_bytes: Number(values.max_bytes),
            max_age: maxAgeNs,
            discard: values.discard,
            num_replicas: Number(values.replicas),
        });
        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Stream "${info.config.name}" updated`);
            setOpen(false);
            onUpdated?.();
        } else {
            toast.error("Failed to update stream", { description: result.error });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm" className="bg-card border-border text-foreground/80">
                        <Pencil className="size-4 mr-2" /> Edit
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-background border-border text-foreground max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="size-5 text-amber-500" />
                        Edit Stream
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Update limits and subjects. Name, storage, and retention are immutable after create.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <FormLabel>Stream Name</FormLabel>
                                <Input
                                    value={info.config.name}
                                    disabled
                                    className="bg-muted border-border opacity-80"
                                />
                                <FormDescription className="text-[10px]">Name cannot be changed</FormDescription>
                            </div>
                            <FormField
                                control={form.control}
                                name="subjects"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Subjects</FormLabel>
                                        <FormControl>
                                            <Input placeholder="events.>" {...field} className="bg-card border-border" />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">Comma-separated subjects</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                            <div>
                                Storage:{" "}
                                <span className="text-foreground">
                                    {info.config.storage === StorageType.File ? "File" : "Memory"}
                                </span>
                            </div>
                            <div>
                                Retention:{" "}
                                <span className="text-foreground capitalize">
                                    {String(info.config.retention || RetentionPolicy.Limits)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="max_msgs"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Messages</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
                                            />
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
                                            <Input
                                                type="number"
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
                                            />
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
                                            <Input
                                                type="number"
                                                min={1}
                                                max={5}
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
                                            />
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
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
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
                                        <Select onValueChange={(v) => field.onChange(v as MaxAgeUnit)} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-card border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card border-border">
                                                {(Object.keys(MAX_AGE_UNITS) as MaxAgeUnit[]).map((u) => (
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

                        <FormField
                            control={form.control}
                            name="discard"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Discard Policy</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-card border-border">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-card border-border">
                                            <SelectItem value={DiscardPolicy.Old}>Old</SelectItem>
                                            <SelectItem value={DiscardPolicy.New}>New</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
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
                                className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
                            >
                                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
