"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Send, Plus, Trash2, Zap, Loader2, Info, MessageSquareQuote } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNatsStore } from "@/store/useNatsStore";
import { publishMessage, requestMessage } from "@/app/actions/publish-actions";
import { ScrollArea } from "@/components/ui/scroll-area";

const publishSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    payload: z.string().min(1, "Payload is required"),
    headers: z.array(z.object({
        key: z.string(),
        value: z.string(),
    })),
    isRequest: z.boolean(),
});

type PublishFormValues = z.infer<typeof publishSchema>;

export default function PublishPage() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [reply, setReply] = React.useState<{data: string, headers?: Record<string, string>} | null>(null);
    const { connections, activeConnectionId } = useNatsStore();
    const activeConnection = connections.find((c) => c.id === activeConnectionId);

    const form = useForm<PublishFormValues>({
        resolver: zodResolver(publishSchema),
        defaultValues: {
            subject: "",
            payload: '{\n  "msg": "hello nats"\n}',
            headers: [],
            isRequest: false,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "headers",
    });

    async function onSubmit(values: PublishFormValues) {
        if (!activeConnection) {
            toast.error("No active connection");
            return;
        }

        setIsSubmitting(true);
        setReply(null);

        const headerMap = values.headers.reduce((acc, curr) => {
            if (curr.key && curr.value) acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);

        if (values.isRequest) {
            const result = await requestMessage(activeConnection, values.subject, values.payload);
            setIsSubmitting(false);
            if (result.success) {
                setReply(result.data.reply);
                toast.success("Request successful");
            } else {
                toast.error("Request failed", { description: result.error });
            }
        } else {
            const result = await publishMessage(activeConnection, values.subject, values.payload, headerMap);
            setIsSubmitting(false);
            if (result.success) {
                toast.success("Message published");
            } else {
                toast.error("Publish failed", { description: result.error });
            }
        }
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                    <Send className="size-6 text-indigo-400" />
                    Publish Message
                </h1>
                <p className="text-slate-400">
                    Send messages or make requests to NATS subjects with custom headers and payloads.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-3">
                    <Card className="col-span-2 bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg">Message Content</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="subject"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Subject</FormLabel>
                                        <FormControl>
                                            <Input placeholder="orders.new" {...field} className="bg-slate-950 border-slate-800 font-mono" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="payload"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payload (JSON or Text)</FormLabel>
                                        <FormControl>
                                            <textarea
                                                {...field}
                                                className="min-h-[300px] w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-300 ring-offset-slate-950 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                placeholder='{"key": "value"}'
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="bg-slate-900 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-lg">Options</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="isRequest"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-800 p-3 shadow-sm bg-slate-950 hover:border-indigo-500/50 transition-colors cursor-pointer" onClick={() => field.onChange(!field.value)}>
                                            <div className="space-y-0.5">
                                                <FormLabel className="cursor-pointer">Request Mode</FormLabel>
                                                <FormDescription className="text-[10px]">Wait for a reply</FormDescription>
                                            </div>
                                            <FormControl>
                                                <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${field.value ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${field.value ? 'translate-x-4' : 'translate-x-1'}`} />
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Headers</FormLabel>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => append({ key: "", value: "" })} className="h-7 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800">
                                            <Plus className="size-3 mr-1" /> Add
                                        </Button>
                                    </div>
                                    <ScrollArea className="h-[200px] rounded-md border border-slate-800 bg-slate-950 p-2">
                                        {fields.length === 0 && (
                                            <div className="text-[10px] text-slate-600 text-center py-8">No headers added</div>
                                        )}
                                        <div className="space-y-2">
                                            {fields.map((field, index) => (
                                                <div key={field.id} className="flex gap-2">
                                                    <Input
                                                        {...form.register(`headers.${index}.key` as const)}
                                                        placeholder="Key"
                                                        className="h-8 text-xs bg-slate-900 border-slate-800"
                                                    />
                                                    <Input
                                                        {...form.register(`headers.${index}.value` as const)}
                                                        placeholder="Value"
                                                        className="h-8 text-xs bg-slate-900 border-slate-800"
                                                    />
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 text-rose-500 hover:bg-rose-500/10">
                                                        <Trash2 className="size-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>

                                <div className="rounded-md bg-amber-500/10 p-3 border border-amber-500/20 flex gap-2">
                                    <Info className="size-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-200/70 leading-relaxed">
                                        Make sure the target subjects are correctly configured on your NATS server.
                                    </p>
                                </div>

                                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" disabled={isSubmitting || !activeConnection}>
                                    {isSubmitting ? (
                                        <Loader2 className="size-4 mr-2 animate-spin" />
                                    ) : (
                                        form.watch("isRequest") ? "Send Request" : "Publish Message"
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {reply && (
                            <Card className="bg-slate-900 border-emerald-500/30 animate-in zoom-in-95 duration-300">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
                                        <MessageSquareQuote className="size-4" />
                                        Reply Received
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <pre className="text-[10px] font-mono p-2 bg-slate-950 rounded-md border border-slate-800 text-slate-300 overflow-auto max-h-[150px]">
                                        {reply.data}
                                    </pre>
                                    {reply.headers && Object.keys(reply.headers).length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            <span className="text-[10px] text-slate-500">Headers:</span>
                                            {Object.entries(reply.headers || {}).map(([k, v]) => (
                                                <div key={k} className="text-[9px] text-slate-400 flex gap-2">
                                                    <span className="font-bold">{k}:</span>
                                                    <span>{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </form>
            </Form>
        </div>
    );
}
