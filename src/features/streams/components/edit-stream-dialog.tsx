"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Pencil, Layers, Loader2, ChevronDown } from "lucide-react";
import { RetentionPolicy, StorageType, DiscardPolicy, StoreCompression } from "@/types/nats";
import type { StreamInfo } from "nats";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
    MAX_AGE_UNITS,
    type MaxAgeUnit,
    ageToNs,
    nsToAgeFields,
} from "@/features/streams/stream-form-utils";

const streamEditSchema = z.object({
    subjects: z.string(),
    description: z.string().optional(),
    max_msgs: z.number(),
    max_bytes: z.number(),
    max_age_value: z.number().min(0),
    max_age_unit: z.enum(["s", "m", "h", "d"] as const),
    discard: z.nativeEnum(DiscardPolicy),
    replicas: z.number().min(1).max(5),
    max_msg_size: z.number(),
    max_msgs_per_subject: z.number(),
    duplicate_window_seconds: z.number().min(0),
    compression: z.nativeEnum(StoreCompression),
    allow_rollup_hdrs: z.boolean(),
    deny_delete: z.boolean(),
    deny_purge: z.boolean(),
    discard_new_per_subject: z.boolean(),
    allow_direct: z.boolean(),
});

type StreamEditFormValues = z.infer<typeof streamEditSchema>;

function formDefaults(info: StreamInfo): StreamEditFormValues {
    const age = nsToAgeFields(info.config.max_age ?? 0);
    const isMirror = Boolean(info.config.mirror);
    return {
        subjects: isMirror ? "" : (info.config.subjects ?? []).join(", "),
        description: info.config.description ?? "",
        max_msgs: info.config.max_msgs ?? -1,
        max_bytes: info.config.max_bytes ?? -1,
        max_age_value: age.value,
        max_age_unit: age.unit,
        discard: (info.config.discard as DiscardPolicy) ?? DiscardPolicy.Old,
        replicas: info.config.num_replicas ?? 1,
        max_msg_size: info.config.max_msg_size ?? -1,
        max_msgs_per_subject: info.config.max_msgs_per_subject ?? -1,
        duplicate_window_seconds: info.config.duplicate_window
            ? Math.round(Number(info.config.duplicate_window) / 1e9)
            : 120,
        compression:
            (info.config.compression as StoreCompression) === StoreCompression.S2
                ? StoreCompression.S2
                : StoreCompression.None,
        allow_rollup_hdrs: Boolean(info.config.allow_rollup_hdrs),
        deny_delete: Boolean(info.config.deny_delete),
        deny_purge: Boolean(info.config.deny_purge),
        discard_new_per_subject: Boolean(info.config.discard_new_per_subject),
        allow_direct: Boolean(info.config.allow_direct),
    };
}

interface EditStreamDialogProps {
    info: StreamInfo;
    onUpdated?: () => void;
    trigger?: React.ReactNode;
}

export function EditStreamDialog({ info, onUpdated, trigger }: EditStreamDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const activeConnection = useActiveConnection();
    const isMirror = Boolean(info.config.mirror);

    const form = useForm<StreamEditFormValues>({
        resolver: zodResolver(streamEditSchema),
        defaultValues: formDefaults(info),
    });

    React.useEffect(() => {
        if (!open) return;
        form.reset(formDefaults(info));
    }, [open, info, form]);

    async function onSubmit(values: StreamEditFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        setIsSubmitting(true);
        const result = await updateStream(activeConnection, info.config.name, {
            subjects: isMirror
                ? []
                : values.subjects
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
            description: values.description?.trim() || undefined,
            max_msgs: Number(values.max_msgs),
            max_bytes: Number(values.max_bytes),
            max_age: ageToNs(values.max_age_value, values.max_age_unit),
            discard: values.discard,
            num_replicas: Number(values.replicas),
            max_msg_size: Number(values.max_msg_size),
            max_msgs_per_subject: Number(values.max_msgs_per_subject),
            duplicate_window:
                values.duplicate_window_seconds > 0
                    ? values.duplicate_window_seconds * 1_000_000_000
                    : 0,
            compression:
                values.compression === StoreCompression.None
                    ? StoreCompression.None
                    : values.compression,
            allow_rollup_hdrs: values.allow_rollup_hdrs,
            deny_delete: values.deny_delete,
            deny_purge: values.deny_purge,
            discard_new_per_subject: values.discard_new_per_subject,
            allow_direct: values.allow_direct,
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
            <DialogContent className="sm:max-w-[640px] bg-background border-border text-foreground max-h-[90vh] overflow-y-auto">
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
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
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
                            {!isMirror ? (
                                <FormField
                                    control={form.control}
                                    name="subjects"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subjects</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="events.>"
                                                    {...field}
                                                    className="bg-card border-border"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-[10px]">
                                                Comma-separated subjects
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
                                <div className="space-y-1.5">
                                    <FormLabel>Mirror</FormLabel>
                                    <Input
                                        value={info.config.mirror?.name ?? ""}
                                        disabled
                                        className="bg-muted border-border opacity-80 font-mono"
                                    />
                                    <FormDescription className="text-[10px]">
                                        Mirror target is set at create time
                                    </FormDescription>
                                </div>
                            )}
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
                                        <FormDescription className="text-[10px]">-1 infinite</FormDescription>
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
                                        <FormDescription className="text-[10px]">-1 infinite</FormDescription>
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
                                        <FormDescription className="text-[10px]">0 = infinite</FormDescription>
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
                                            onValueChange={(v) => field.onChange(v as MaxAgeUnit)}
                                            value={field.value}
                                        >
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
                                <div className="space-y-4 border-t border-border p-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField
                                            control={form.control}
                                            name="max_msg_size"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Max msg size</FormLabel>
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
                                            name="max_msgs_per_subject"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Max msgs / subject</FormLabel>
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
                                            name="duplicate_window_seconds"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Duplicate window (s)</FormLabel>
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
                                            name="compression"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Compression</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-card border-border">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-card border-border">
                                                            <SelectItem value={StoreCompression.None}>None</SelectItem>
                                                            <SelectItem value={StoreCompression.S2}>S2</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(
                                            [
                                                ["allow_rollup_hdrs", "Allow rollup headers"],
                                                ["deny_delete", "Deny delete"],
                                                ["deny_purge", "Deny purge"],
                                                ["discard_new_per_subject", "Discard new per subject"],
                                                ["allow_direct", "Allow direct get"],
                                            ] as const
                                        ).map(([name, label]) => (
                                            <FormField
                                                key={name}
                                                control={form.control}
                                                name={name}
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value}
                                                                onCheckedChange={(c) => field.onChange(c === true)}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="text-xs font-normal cursor-pointer">
                                                            {label}
                                                        </FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
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
