"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Database, Loader2, Info } from "lucide-react";

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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { KvOptions } from "nats";
import { useNatsStore } from "@/store/useNatsStore";
import { createKVBucket } from "@/app/actions/kv-actions";

const kvSchema = z.object({
    bucket: z.string().min(1, "Bucket name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, dash and underscore allowed"),
    description: z.string().optional(),
    history: z.number().min(1).max(64),
    max_age: z.number(),
    replicas: z.number().min(1).max(5),
});

type KVFormValues = z.infer<typeof kvSchema>;

interface CreateKVDialogProps {
    onCreated?: () => void;
}

export function CreateKVDialog({ onCreated }: CreateKVDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { connections, activeConnectionId } = useNatsStore();
    const activeConnection = connections.find((c) => c.id === activeConnectionId);

    const form = useForm<KVFormValues>({
        resolver: zodResolver(kvSchema),
        defaultValues: {
            bucket: "",
            description: "",
            history: 1,
            max_age: 0,
            replicas: 1,
        },
    });

    async function onSubmit(values: KVFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        setIsSubmitting(true);
        const cleanOptions: Partial<KvOptions & { bucket: string }> = {
            bucket: values.bucket,
            history: values.history,
            replicas: values.replicas,
            timeout: 5000,
        };
        if (values.description?.trim()) cleanOptions.description = values.description.trim();
        if (values.max_age > 0) cleanOptions.ttl = values.max_age;

        const result = await createKVBucket(activeConnection, cleanOptions);

        setIsSubmitting(false);

        if (result.success) {
            toast.success(`KV Bucket "${values.bucket}" created successfully`);
            setOpen(false);
            form.reset();
            onCreated?.();
        } else {
            toast.error("Failed to create bucket", {
                description: result.error,
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                    <Plus className="size-4" />
                    Create KV Bucket
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="size-5 text-emerald-500" />
                        Create New KV Bucket
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        A KeyValue bucket provides a simple key-value store backed by JetStream.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="bucket"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bucket Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="settings" {...field} className="bg-slate-900 border-slate-800" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Application settings" {...field} className="bg-slate-900 border-slate-800" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="history"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>History (Revisions)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
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

                        <div className="rounded-md bg-indigo-500/10 p-3 border border-indigo-500/20 flex gap-3">
                            <Info className="size-5 text-indigo-400 shrink-0" />
                            <div className="text-xs text-indigo-300 leading-relaxed">
                                KV buckets use JetStream under the hood. The bucket name will be prefixed with <code>KV_</code> in NATS.
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting || !activeConnection}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    "Create Bucket"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
