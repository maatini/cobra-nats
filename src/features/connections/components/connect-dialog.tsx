"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { NatsAuthType, NatsConnectionConfig } from "@/types/nats";
import { useNatsStore } from "@/features/connections/store";
import { testConnection } from "@/features/connections/actions";

const AUTH_TYPES = ["none", "user_pass", "token", "nkey", "jwt", "creds"] as const;

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    servers: z.string().min(1, "At least one server is required"),
    authType: z.enum(AUTH_TYPES),
    user: z.string().optional(),
    pass: z.string().optional(),
    token: z.string().optional(),
    nkeySeed: z.string().optional(),
    jwt: z.string().optional(),
    creds: z.string().optional(),
    tlsEnabled: z.boolean(),
    tlsCa: z.string().optional(),
    tlsCert: z.string().optional(),
    tlsKey: z.string().optional(),
    monitoringUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const pemTextareaClass =
    "min-h-[88px] w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-mono text-foreground/80 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

function buildConfigFields(values: FormValues): Omit<NatsConnectionConfig, "id"> {
    const authType = values.authType as NatsAuthType;
    const config: Omit<NatsConnectionConfig, "id"> = {
        name: values.name,
        servers: values.servers.split(",").map((s) => s.trim()).filter(Boolean),
        authType,
    };

    switch (authType) {
        case "user_pass":
            config.user = values.user || undefined;
            config.pass = values.pass || undefined;
            break;
        case "token":
            config.token = values.token || undefined;
            break;
        case "nkey":
            config.nkeySeed = values.nkeySeed?.trim() || undefined;
            break;
        case "jwt":
            config.jwt = values.jwt?.trim() || undefined;
            config.nkeySeed = values.nkeySeed?.trim() || undefined;
            break;
        case "creds":
            config.creds = values.creds || undefined;
            break;
        default:
            break;
    }

    const hasTlsMaterial =
        values.tlsEnabled ||
        Boolean(values.tlsCa?.trim()) ||
        Boolean(values.tlsCert?.trim()) ||
        Boolean(values.tlsKey?.trim());

    if (hasTlsMaterial) {
        config.tls = {
            enabled: values.tlsEnabled || undefined,
            ca: values.tlsCa?.trim() || undefined,
            cert: values.tlsCert?.trim() || undefined,
            key: values.tlsKey?.trim() || undefined,
        };
    }

    if (values.monitoringUrl?.trim()) {
        config.monitoringUrl = values.monitoringUrl.trim();
    }

    return config;
}

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
            authType: (editingConfig?.authType as FormValues["authType"]) || "none",
            user: editingConfig?.user || "",
            pass: editingConfig?.pass || "",
            token: editingConfig?.token || "",
            nkeySeed: editingConfig?.nkeySeed || "",
            jwt: editingConfig?.jwt || "",
            creds: editingConfig?.creds || "",
            tlsEnabled: editingConfig?.tls?.enabled ?? false,
            tlsCa: editingConfig?.tls?.ca || "",
            tlsCert: editingConfig?.tls?.cert || "",
            tlsKey: editingConfig?.tls?.key || "",
            monitoringUrl: editingConfig?.monitoringUrl || "",
        },
    });

    const authType = form.watch("authType");
    const tlsEnabled = form.watch("tlsEnabled");

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        onOpenChange?.(newOpen);
        if (!newOpen) form.reset();
    };

    async function onTest() {
        const values = form.getValues();
        setIsTesting(true);

        const result = await testConnection(buildConfigFields(values));

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
        const id =
            editingConfig?.id ||
            (typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
        const config: NatsConnectionConfig = { id, ...buildConfigFields(values) };

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
            <DialogContent className="sm:max-w-[520px] bg-background border-border text-foreground max-h-[90vh] flex flex-col gap-0 p-0">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>{editingConfig ? "Edit Connection" : "New Connection"}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Enter the details for your NATS server. Secrets are stored in this browser&apos;s localStorage.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
                        <ScrollArea className="max-h-[min(60vh,520px)] px-6">
                            <div className="space-y-4 pb-4 pt-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Connection Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Local NATS"
                                                    {...field}
                                                    className="bg-card border-border focus:border-indigo-500"
                                                />
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
                                                <Input
                                                    placeholder="nats://localhost:4222, tls://nats.example.com:4222"
                                                    {...field}
                                                    className="bg-card border-border focus:border-indigo-500"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-[10px] text-muted-foreground">
                                                Comma-separated URLs. Use tls:// or wss:// for TLS endpoints.
                                            </FormDescription>
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
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-card border-border focus:ring-indigo-500 text-foreground">
                                                        <SelectValue placeholder="Select auth type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-card border-border text-foreground">
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="user_pass">Username / Password</SelectItem>
                                                    <SelectItem value="token">Token</SelectItem>
                                                    <SelectItem value="nkey">NKey seed</SelectItem>
                                                    <SelectItem value="jwt">JWT (+ optional seed)</SelectItem>
                                                    <SelectItem value="creds">Credentials file (.creds)</SelectItem>
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
                                                        <Input
                                                            placeholder="user"
                                                            {...field}
                                                            className="bg-card border-border"
                                                        />
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
                                                        <Input
                                                            type="password"
                                                            placeholder="••••••••"
                                                            {...field}
                                                            className="bg-card border-border"
                                                        />
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
                                                    <Input
                                                        type="password"
                                                        placeholder="secret-token"
                                                        {...field}
                                                        className="bg-card border-border"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {authType === "nkey" && (
                                    <FormField
                                        control={form.control}
                                        name="nkeySeed"
                                        render={({ field }) => (
                                            <FormItem className="animate-in slide-in-from-top-2 duration-200">
                                                <FormLabel>NKey seed</FormLabel>
                                                <FormControl>
                                                    <textarea
                                                        {...field}
                                                        className={pemTextareaClass}
                                                        placeholder="SU…"
                                                        spellCheck={false}
                                                        autoComplete="off"
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[10px] text-muted-foreground">
                                                    User seed starting with SU…
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {authType === "jwt" && (
                                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                                        <FormField
                                            control={form.control}
                                            name="jwt"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>User JWT</FormLabel>
                                                    <FormControl>
                                                        <textarea
                                                            {...field}
                                                            className={pemTextareaClass}
                                                            placeholder="eyJ…"
                                                            spellCheck={false}
                                                            autoComplete="off"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="nkeySeed"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>NKey seed (optional)</FormLabel>
                                                    <FormControl>
                                                        <textarea
                                                            {...field}
                                                            className={pemTextareaClass}
                                                            placeholder="SU… (required if JWT is not a bearer token)"
                                                            spellCheck={false}
                                                            autoComplete="off"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}

                                {authType === "creds" && (
                                    <FormField
                                        control={form.control}
                                        name="creds"
                                        render={({ field }) => (
                                            <FormItem className="animate-in slide-in-from-top-2 duration-200">
                                                <FormLabel>Credentials file content</FormLabel>
                                                <FormControl>
                                                    <textarea
                                                        {...field}
                                                        className={`${pemTextareaClass} min-h-[140px]`}
                                                        placeholder={"-----BEGIN NATS USER JWT-----\n…\n-----END NATS USER JWT-----\n\n-----BEGIN USER NKEY SEED-----\n…\n-----END USER NKEY SEED-----"}
                                                        spellCheck={false}
                                                        autoComplete="off"
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[10px] text-muted-foreground">
                                                    Paste the full contents of a NATS .creds file
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <FormField
                                    control={form.control}
                                    name="monitoringUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>HTTP monitoring URL (optional)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="http://localhost:8222"
                                                    {...field}
                                                    className="bg-card border-border font-mono text-sm"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-[10px] text-muted-foreground">
                                                NATS monitoring port for varz/jsz/connz on the dashboard.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-3">
                                    <FormField
                                        control={form.control}
                                        name="tlsEnabled"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={(checked) =>
                                                            field.onChange(checked === true)
                                                        }
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel className="cursor-pointer">
                                                        Enable TLS options
                                                    </FormLabel>
                                                    <FormDescription className="text-[10px] text-muted-foreground">
                                                        Force TLS and/or supply CA / client certificate PEMs.
                                                        tls:// and wss:// URLs enable TLS automatically.
                                                    </FormDescription>
                                                </div>
                                            </FormItem>
                                        )}
                                    />

                                    {tlsEnabled && (
                                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <FormField
                                                control={form.control}
                                                name="tlsCa"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>CA certificate (PEM)</FormLabel>
                                                        <FormControl>
                                                            <textarea
                                                                {...field}
                                                                className={pemTextareaClass}
                                                                placeholder="-----BEGIN CERTIFICATE-----"
                                                                spellCheck={false}
                                                                autoComplete="off"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="tlsCert"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Client certificate (PEM)</FormLabel>
                                                        <FormControl>
                                                            <textarea
                                                                {...field}
                                                                className={pemTextareaClass}
                                                                placeholder="-----BEGIN CERTIFICATE-----"
                                                                spellCheck={false}
                                                                autoComplete="off"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="tlsKey"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Client private key (PEM)</FormLabel>
                                                        <FormControl>
                                                            <textarea
                                                                {...field}
                                                                className={pemTextareaClass}
                                                                placeholder="-----BEGIN PRIVATE KEY-----"
                                                                spellCheck={false}
                                                                autoComplete="off"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>

                        <DialogFooter className="px-6 py-4 border-t border-border gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onTest}
                                disabled={isTesting}
                                className="bg-muted text-foreground hover:bg-muted"
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
