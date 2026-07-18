"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Layers, Loader2, Info, ChevronDown, FileJson } from "lucide-react";
import { RetentionPolicy, StorageType, DiscardPolicy, StoreCompression } from "@/types/nats";
import type { StreamConfig } from "nats";

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
import { createStream } from "@/features/streams/actions";
import {
    MAX_AGE_UNITS,
    type MaxAgeUnit,
    ageToNs,
} from "@/features/streams/stream-form-utils";

const streamSchema = z
    .object({
        name: z
            .string()
            .min(1, "Name is required")
            .regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, dash and underscore allowed"),
        subjects: z.string().optional(),
        description: z.string().optional(),
        retention: z.nativeEnum(RetentionPolicy),
        storage: z.nativeEnum(StorageType),
        max_msgs: z.number(),
        max_bytes: z.number(),
        max_age_value: z.number().min(0),
        max_age_unit: z.enum(["s", "m", "h", "d"] as const),
        discard: z.nativeEnum(DiscardPolicy),
        replicas: z.number().min(1).max(5),
        // Advanced
        max_msg_size: z.number(),
        max_msgs_per_subject: z.number(),
        duplicate_window_seconds: z.number().min(0),
        compression: z.nativeEnum(StoreCompression),
        allow_rollup_hdrs: z.boolean(),
        deny_delete: z.boolean(),
        deny_purge: z.boolean(),
        discard_new_per_subject: z.boolean(),
        allow_direct: z.boolean(),
        // Topology
        topology: z.enum(["standard", "mirror", "sources"]),
        mirror_name: z.string().optional(),
        mirror_filter: z.string().optional(),
        mirror_external_api: z.string().optional(),
        sources_csv: z.string().optional(),
    })
    .superRefine((v, ctx) => {
        if (v.topology === "standard") {
            if (!v.subjects || !v.subjects.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "At least one subject is required",
                    path: ["subjects"],
                });
            }
        }
        if (v.topology === "mirror" && !v.mirror_name?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Mirror stream name is required",
                path: ["mirror_name"],
            });
        }
        if (v.topology === "sources" && !v.sources_csv?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "At least one source stream name is required",
                path: ["sources_csv"],
            });
        }
    });

type StreamFormValues = z.infer<typeof streamSchema>;

const DEFAULTS: StreamFormValues = {
    name: "",
    subjects: "",
    description: "",
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    max_msgs: -1,
    max_bytes: -1,
    max_age_value: 0,
    max_age_unit: "h",
    discard: DiscardPolicy.Old,
    replicas: 1,
    max_msg_size: -1,
    max_msgs_per_subject: -1,
    duplicate_window_seconds: 120,
    compression: StoreCompression.None,
    allow_rollup_hdrs: false,
    deny_delete: false,
    deny_purge: false,
    discard_new_per_subject: false,
    allow_direct: false,
    topology: "standard",
    mirror_name: "",
    mirror_filter: "",
    mirror_external_api: "",
    sources_csv: "",
};

function valuesToStreamConfig(values: StreamFormValues): StreamConfig {
    const maxAgeNs = ageToNs(values.max_age_value, values.max_age_unit);
    const dupNs =
        values.duplicate_window_seconds > 0
            ? values.duplicate_window_seconds * 1_000_000_000
            : 0;

    const config: Partial<StreamConfig> = {
        name: values.name,
        description: values.description?.trim() || undefined,
        retention: values.retention,
        storage: values.storage,
        max_msgs: Number(values.max_msgs),
        max_bytes: Number(values.max_bytes),
        max_age: maxAgeNs,
        discard: values.discard,
        num_replicas: Number(values.replicas),
        max_msg_size: Number(values.max_msg_size),
        max_msgs_per_subject: Number(values.max_msgs_per_subject),
        duplicate_window: dupNs,
        compression: values.compression === StoreCompression.None ? undefined : values.compression,
        allow_rollup_hdrs: values.allow_rollup_hdrs,
        deny_delete: values.deny_delete,
        deny_purge: values.deny_purge,
        discard_new_per_subject: values.discard_new_per_subject,
        allow_direct: values.allow_direct,
    };

    if (values.topology === "mirror" && values.mirror_name?.trim()) {
        config.subjects = [];
        config.mirror = {
            name: values.mirror_name.trim(),
            filter_subject: values.mirror_filter?.trim() || undefined,
            external: values.mirror_external_api?.trim()
                ? { api: values.mirror_external_api.trim() }
                : undefined,
        };
    } else if (values.topology === "sources" && values.sources_csv?.trim()) {
        config.subjects = values.subjects?.trim()
            ? values.subjects.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
        config.sources = values.sources_csv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((name) => ({ name }));
    } else {
        config.subjects = (values.subjects || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    return config as StreamConfig;
}

interface CreateStreamDialogProps {
    onCreated?: () => void;
}

export function CreateStreamDialog({ onCreated }: CreateStreamDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [importJson, setImportJson] = React.useState("");
    const activeConnection = useActiveConnection();

    const form = useForm<StreamFormValues>({
        resolver: zodResolver(streamSchema),
        defaultValues: DEFAULTS,
    });

    const topology = form.watch("topology");

    function applyImportJson() {
        try {
            const raw = JSON.parse(importJson) as Record<string, unknown>;
            // Support { config: {...} } wrappers and raw StreamConfig
            const cfg = (raw.config && typeof raw.config === "object"
                ? raw.config
                : raw) as Record<string, unknown>;

            const patch: Partial<StreamFormValues> = {};
            if (typeof cfg.name === "string") patch.name = cfg.name;
            if (typeof cfg.description === "string") patch.description = cfg.description;
            if (Array.isArray(cfg.subjects)) patch.subjects = cfg.subjects.join(", ");
            if (typeof cfg.retention === "string") patch.retention = cfg.retention as RetentionPolicy;
            if (typeof cfg.storage === "string") patch.storage = cfg.storage as StorageType;
            if (typeof cfg.discard === "string") patch.discard = cfg.discard as DiscardPolicy;
            if (typeof cfg.max_msgs === "number") patch.max_msgs = cfg.max_msgs;
            if (typeof cfg.max_bytes === "number") patch.max_bytes = cfg.max_bytes;
            if (typeof cfg.num_replicas === "number") patch.replicas = cfg.num_replicas;
            if (typeof cfg.max_msg_size === "number") patch.max_msg_size = cfg.max_msg_size;
            if (typeof cfg.max_msgs_per_subject === "number") {
                patch.max_msgs_per_subject = cfg.max_msgs_per_subject;
            }
            if (typeof cfg.max_age === "number" && cfg.max_age > 0) {
                patch.max_age_value = Math.round(cfg.max_age / 1e9 / 3600);
                patch.max_age_unit = "h";
            }
            if (typeof cfg.duplicate_window === "number") {
                patch.duplicate_window_seconds = Math.round(cfg.duplicate_window / 1e9);
            }
            if (typeof cfg.compression === "string") {
                patch.compression =
                    cfg.compression === "s2" ? StoreCompression.S2 : StoreCompression.None;
            }
            if (typeof cfg.allow_rollup_hdrs === "boolean") patch.allow_rollup_hdrs = cfg.allow_rollup_hdrs;
            if (typeof cfg.deny_delete === "boolean") patch.deny_delete = cfg.deny_delete;
            if (typeof cfg.deny_purge === "boolean") patch.deny_purge = cfg.deny_purge;
            if (typeof cfg.discard_new_per_subject === "boolean") {
                patch.discard_new_per_subject = cfg.discard_new_per_subject;
            }
            if (typeof cfg.allow_direct === "boolean") patch.allow_direct = cfg.allow_direct;

            if (cfg.mirror && typeof cfg.mirror === "object") {
                const m = cfg.mirror as Record<string, unknown>;
                patch.topology = "mirror";
                if (typeof m.name === "string") patch.mirror_name = m.name;
                if (typeof m.filter_subject === "string") patch.mirror_filter = m.filter_subject;
                if (m.external && typeof m.external === "object") {
                    const ext = m.external as Record<string, unknown>;
                    if (typeof ext.api === "string") patch.mirror_external_api = ext.api;
                }
            } else if (Array.isArray(cfg.sources) && cfg.sources.length > 0) {
                patch.topology = "sources";
                patch.sources_csv = cfg.sources
                    .map((s) => (typeof s === "object" && s && "name" in s ? String((s as { name: string }).name) : ""))
                    .filter(Boolean)
                    .join(", ");
            } else {
                patch.topology = "standard";
            }

            form.reset({ ...DEFAULTS, ...patch });
            setShowAdvanced(true);
            toast.success("Imported stream config into form");
        } catch {
            toast.error("Invalid JSON — expected a StreamConfig object");
        }
    }

    async function onSubmit(values: StreamFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        setIsSubmitting(true);
        const result = await createStream(activeConnection, valuesToStreamConfig(values));
        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Stream "${values.name}" created successfully`);
            setOpen(false);
            form.reset(DEFAULTS);
            setImportJson("");
            setShowAdvanced(false);
            onCreated?.();
        } else {
            toast.error("Failed to create stream", { description: result.error });
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
            <DialogContent className="sm:max-w-[640px] bg-background border-border text-foreground max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="size-5 text-amber-500" />
                        Create New Stream
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Configure a new JetStream stream. Import JSON to prefill from nats-cli export.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
                        <div className="rounded-md border border-border bg-card/40 p-3 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <FileJson className="size-3.5" /> Import config (JSON)
                            </div>
                            <textarea
                                value={importJson}
                                onChange={(e) => setImportJson(e.target.value)}
                                placeholder='{"name":"ORDERS","subjects":["orders.>"],...}'
                                className="min-h-[72px] w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-mono"
                                spellCheck={false}
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={applyImportJson}
                                disabled={!importJson.trim()}
                            >
                                Apply to form
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Stream Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="MY_STREAM" {...field} className="bg-card border-border" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="topology"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Topology</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-card border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value="standard">Standard</SelectItem>
                                                <SelectItem value="mirror">Mirror</SelectItem>
                                                <SelectItem value="sources">Sources</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="What this stream stores" {...field} className="bg-card border-border" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {topology === "mirror" ? (
                            <div className="grid grid-cols-1 gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                                <FormField
                                    control={form.control}
                                    name="mirror_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Mirror source stream</FormLabel>
                                            <FormControl>
                                                <Input placeholder="ORIGIN_STREAM" {...field} className="bg-card border-border font-mono" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="mirror_filter"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Filter subject (optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="orders.>" {...field} className="bg-card border-border font-mono" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="mirror_external_api"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>External API prefix (optional)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="$JS.other-domain.API"
                                                    {...field}
                                                    className="bg-card border-border font-mono"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-[10px]">
                                                For cross-domain mirrors. Leave empty for same-cluster.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        ) : topology === "sources" ? (
                            <div className="space-y-3 rounded-md border border-indigo-500/20 bg-indigo-500/5 p-3">
                                <FormField
                                    control={form.control}
                                    name="sources_csv"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Source streams</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="STREAM_A, STREAM_B"
                                                    {...field}
                                                    className="bg-card border-border font-mono"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-[10px]">Comma-separated stream names</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="subjects"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Local subjects (optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="local.>" {...field} className="bg-card border-border" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        ) : (
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
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="storage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Storage Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-card border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card border-border">
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
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-card border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value={RetentionPolicy.Limits}>Limits</SelectItem>
                                                <SelectItem value={RetentionPolicy.Interest}>Interest</SelectItem>
                                                <SelectItem value={RetentionPolicy.Workqueue}>Work Queue</SelectItem>
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

                        <div className="border border-border rounded-lg">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-sm text-foreground/90 hover:bg-muted/40"
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
                                                    <FormDescription className="text-[10px]">-1 unlimited</FormDescription>
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
                                                    <FormDescription className="text-[10px]">-1 unlimited</FormDescription>
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

                        <div className="rounded-md bg-blue-500/10 p-3 border border-blue-500/20 flex gap-3">
                            <Info className="size-5 text-blue-400 shrink-0" />
                            <div className="text-xs text-blue-300 leading-relaxed">
                                Mirror streams must leave subjects empty. Sources can combine remote streams with optional
                                local subjects.
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
                                className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
                            >
                                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Create Stream"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
