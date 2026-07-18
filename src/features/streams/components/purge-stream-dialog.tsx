"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Eraser, Loader2 } from "lucide-react";

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
import { useActiveConnection } from "@/features/connections/hooks";
import { purgeStream } from "@/features/streams/actions";
import { useConfirm } from "@/components/providers/confirm-provider";

const purgeSchema = z.object({
    filter: z.string().optional(),
    seq: z.number().min(0).optional(),
    keep: z.number().min(0).optional(),
});

type PurgeFormValues = z.infer<typeof purgeSchema>;

interface PurgeStreamDialogProps {
    streamName: string;
    onPurged?: () => void;
    trigger?: React.ReactNode;
}

export function PurgeStreamDialog({ streamName, onPurged, trigger }: PurgeStreamDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const form = useForm<PurgeFormValues>({
        resolver: zodResolver(purgeSchema),
        defaultValues: {
            filter: "",
            seq: 0,
            keep: 0,
        },
    });

    async function onSubmit(values: PurgeFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        const filter = values.filter?.trim() || undefined;
        const seq = values.seq && values.seq > 0 ? values.seq : undefined;
        const keep = values.keep && values.keep > 0 ? values.keep : undefined;

        const scope =
            filter || seq || keep
                ? [
                      filter ? `subject "${filter}"` : null,
                      seq ? `up to seq ${seq}` : null,
                      keep ? `keeping last ${keep}` : null,
                  ]
                      .filter(Boolean)
                      .join(", ")
                : "all messages";

        const ok = await confirm({
            title: `Purge stream "${streamName}"?`,
            description: `This will permanently remove ${scope}. This cannot be undone.`,
            confirmText: "Purge Stream",
            typedName: streamName,
        });
        if (!ok) return;

        setIsSubmitting(true);
        const result = await purgeStream(activeConnection, streamName, {
            filter,
            seq,
            keep,
        });
        setIsSubmitting(false);

        if (result.success) {
            toast.success(`Purged ${result.data.purged.toLocaleString()} message(s)`);
            setOpen(false);
            form.reset();
            onPurged?.();
        } else {
            toast.error("Failed to purge stream", { description: result.error });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm" className="bg-card border-border text-foreground/80">
                        <Eraser className="size-4 mr-2" /> Purge
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] bg-background border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eraser className="size-5 text-amber-500" />
                        Purge Stream
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Remove messages from <span className="font-mono text-foreground">{streamName}</span>.
                        Leave fields empty to purge everything.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField
                            control={form.control}
                            name="filter"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Subject filter (optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="orders.*"
                                            {...field}
                                            className="bg-card border-border font-mono"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[10px]">
                                        Only purge messages matching this subject.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="seq"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Up to sequence</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">0 = ignore</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="keep"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Keep last N</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="bg-card border-border"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">0 = ignore</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                                variant="destructive"
                                className="min-w-[120px]"
                            >
                                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Purge"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
