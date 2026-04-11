"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";

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
import type { NatsConnectionConfig } from "@/types/nats";
import { useNatsStore } from "@/features/connections/store";
import { testConnection } from "@/features/connections/actions";

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    servers: z.string().min(1, "At least one server is required"),
    authType: z.enum(["none", "user_pass", "token"]),
    user: z.string().optional(),
    pass: z.string().optional(),
    token: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectDialogProps {
    trigger?: React.ReactNode;
    editingConfig?: NatsConnectionConfig;
    onOpenChange?: (open: boolean) => void;
}

export function ConnectDialog({ trigger, editingConfig, onOpenChange }: ConnectDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isTesting, setIsTesting] = React.useState(false);
    const { addConnection, updateConnection } = useNatsStore();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: editingConfig?.name || "",
            servers: editingConfig?.servers.join(",") || "nats://localhost:4222",
            authType: editingConfig?.authType || "none",
            user: editingConfig?.user || "",
            pass: editingConfig?.pass || "",
            token: editingConfig?.token || "",
        },
    });

    const authType = form.watch("authType");

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        onOpenChange?.(newOpen);
        if (!newOpen) form.reset();
    };

    async function onTest() {
        const values = form.getValues();
        setIsTesting(true);

        const result = await testConnection({
            name: values.name,
            servers: values.servers.split(",").map(s => s.trim()),
            authType: values.authType,
            user: values.user,
            pass: values.pass,
            token: values.token,
        });

        setIsTesting(false);

        if (result.success) {
            toast.success("Connection successful!", {
                description: `Connected to ${values.name} (${result.data.serverInfo?.version})`,
                icon: <CheckCircle2 className="size-4 text-emerald-500" />,
            });
        } else {
            toast.error("Connection failed", {
                description: result.error,
                icon: <AlertCircle className="size-4 text-rose-500" />,
            });
        }
    }

    function onSubmit(values: FormValues) {
        const config: NatsConnectionConfig = {
            id: editingConfig?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`),
            name: values.name,
            servers: values.servers.split(",").map(s => s.trim()),
            authType: values.authType,
            user: values.authType === "user_pass" ? values.user : undefined,
            pass: values.authType === "user_pass" ? values.pass : undefined,
            token: values.authType === "token" ? values.token : undefined,
        };

        if (editingConfig) {
            updateConnection(editingConfig.id, config);
            toast.success("Connection updated");
        } else {
            addConnection(config);
            toast.success("Connection added");
        }

        handleOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Plus className="size-4" />
                        Add Connection
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle>{editingConfig ? "Edit Connection" : "New Connection"}</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Enter the details for your NATS server.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Connection Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Local NATS" {...field} className="bg-slate-900 border-slate-800 focus:border-indigo-500" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="servers"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Servers</FormLabel>
                                    <FormControl>
                                        <Input placeholder="nats://localhost:4222, nats://localhost:4223" {...field} className="bg-slate-900 border-slate-800 focus:border-indigo-500" />
                                    </FormControl>
                                    <FormDescription className="text-[10px] text-slate-500">Comma-separated URLs</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="authType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Authentication</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-slate-900 border-slate-800 focus:ring-indigo-500 text-slate-200">
                                                <SelectValue placeholder="Select auth type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="user_pass">Username / Password</SelectItem>
                                            <SelectItem value="token">Token</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {authType === "user_pass" && (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                                <FormField
                                    control={form.control}
                                    name="user"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input placeholder="user" {...field} className="bg-slate-900 border-slate-800" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="pass"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="••••••••" {...field} className="bg-slate-900 border-slate-800" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {authType === "token" && (
                            <FormField
                                control={form.control}
                                name="token"
                                render={({ field }) => (
                                    <FormItem className="animate-in slide-in-from-top-2 duration-200">
                                        <FormLabel>Token</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="secret-token" {...field} className="bg-slate-900 border-slate-800" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter className="pt-6 gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onTest}
                                disabled={isTesting}
                                className="bg-slate-800 text-slate-200 hover:bg-slate-700"
                            >
                                {isTesting ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Zap className="mr-2 size-4 text-indigo-400" />
                                )}
                                Test
                            </Button>
                            <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700">
                                {editingConfig ? "Update" : "Connect"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
