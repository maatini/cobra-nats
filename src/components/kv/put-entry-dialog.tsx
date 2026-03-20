"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Loader2, Database } from "lucide-react";

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
import { putKVEntry } from "@/app/actions/kv-actions";

const entrySchema = z.object({
    key: z.string().min(1, "Key is required"),
    value: z.string(),
});

type EntryFormValues = z.infer<typeof entrySchema>;

interface PutEntryDialogProps {
    bucket: string;
    initialKey?: string;
    initialValue?: string;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function PutEntryDialog({ bucket, initialKey = "", initialValue = "", onSuccess, trigger }: PutEntryDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const activeConnection = useActiveConnection();

    const form = useForm<EntryFormValues>({
        resolver: zodResolver(entrySchema),
        defaultValues: {
            key: initialKey,
            value: initialValue,
        },
    });

    async function onSubmit(values: EntryFormValues) {
        if (!activeConnection) return;

        setIsSubmitting(true);
        const result = await putKVEntry(activeConnection, bucket, values.key, values.value);

        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Key "${values.key}" saved`);
            setOpen(false);
            onSuccess?.();
        } else {
            toast.error("Failed to save entry", { description: result.error });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                        <Plus className="size-4" />
                        Add Entry
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="size-5 text-emerald-500" />
                        {initialKey ? "Edit Entry" : "Add New Entry"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Store a value in the <code>{bucket}</code> bucket.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="key"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Key</FormLabel>
                                    <FormControl>
                                        <Input placeholder="user.123.profile" {...field} className="bg-slate-900 border-slate-800 font-mono" disabled={!!initialKey} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Value</FormLabel>
                                    <FormControl>
                                        <textarea
                                            {...field}
                                            className="min-h-[200px] w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-mono text-slate-300 ring-offset-slate-950 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            placeholder='{"active": true}'
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
                            <Button type="submit" disabled={isSubmitting || !activeConnection} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Save Entry"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
