"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, HardDrive, Loader2, Info } from "lucide-react";

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
import { useActiveConnection } from "@/hooks/use-active-connection";
import { createOSBucket } from "@/app/actions/os-actions";

const osSchema = z.object({
    bucket: z.string().min(1, "Bucket name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, dash and underscore allowed"),
    description: z.string().optional(),
    replicas: z.number().min(1).max(5),
    maxChunkSize: z.number().min(0),
});

type OSFormValues = z.infer<typeof osSchema>;

interface CreateOSDialogProps {
    onCreated?: () => void;
}

export function CreateOSDialog({ onCreated }: CreateOSDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const activeConnection = useActiveConnection();

    const form = useForm<OSFormValues>({
        resolver: zodResolver(osSchema),
        defaultValues: {
            bucket: "",
            description: "",
            replicas: 1,
            maxChunkSize: 0,
        },
    });

    async function onSubmit(values: OSFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        setIsSubmitting(true);

        const opts: Record<string, unknown> = {
            replicas: values.replicas,
            timeout: 5000,
        };
        if (values.description?.trim()) opts.description = values.description.trim();
        if (values.maxChunkSize > 0) opts.max_chunk_size = values.maxChunkSize;

        const result = await createOSBucket(activeConnection, values.bucket, opts);

        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Object Store "${values.bucket}" created successfully`);
            setOpen(false);
            form.reset();
            onCreated?.();
        } else {
            toast.error("Failed to create Object Store", {
                description: result.error,
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                    <Plus className="size-4" />
                    Create Object Store
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HardDrive className="size-5 text-cyan-500" />
                        Create New Object Store
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        An Object Store provides large binary file storage backed by JetStream.
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
                                        <Input placeholder="my-assets" {...field} className="bg-slate-900 border-slate-800" />
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
                                        <Input placeholder="Static assets storage" {...field} className="bg-slate-900 border-slate-800" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
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
                            <FormField
                                control={form.control}
                                name="maxChunkSize"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Chunk Size</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0 = default" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="rounded-md bg-cyan-500/10 p-3 border border-cyan-500/20 flex gap-3">
                            <Info className="size-5 text-cyan-400 shrink-0" />
                            <div className="text-xs text-cyan-300 leading-relaxed">
                                Object Store buckets use JetStream under the hood. The bucket name will be prefixed with <code>OBJ_</code> in NATS.
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting || !activeConnection}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white w-full"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    "Create Object Store"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
