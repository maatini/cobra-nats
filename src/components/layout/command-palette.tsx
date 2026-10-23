"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Layers,
    Database,
    HardDrive,
    Send,
    Monitor,
    Settings,
    Keyboard,
    Plus,
    Trash2,
    Eraser,
    Plug,
} from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { useNatsStore } from "@/features/connections/store";
import { useActiveConnection } from "@/features/connections/hooks";
import { ConnectDialog } from "@/features/connections/components/connect-dialog";
import { useConfirm } from "@/components/providers/confirm-provider";
import { deleteStream, purgeStream } from "@/features/streams/actions";
import { deleteKVBucket } from "@/features/kv/actions";
import { deleteOSBucket } from "@/features/os/actions";
import { toast } from "sonner";

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onShowHelp: () => void;
}

const NAV_ITEMS = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/streams", label: "Streams", icon: Layers },
    { href: "/kv", label: "KV Stores", icon: Database },
    { href: "/os", label: "Object Stores", icon: HardDrive },
    { href: "/publish", label: "Publish Message", icon: Send },
    { href: "/monitor", label: "Subject Monitor", icon: Monitor },
    { href: "/settings", label: "Settings", icon: Settings },
];

function detailName(pathname: string, resource: "streams" | "kv" | "os"): string | null {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0] !== resource) return null;
    try { return decodeURIComponent(parts[1]); } catch { return parts[1]; }
}

export function CommandPalette({ open, onOpenChange, onShowHelp }: CommandPaletteProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { connections, activeConnectionId, setActiveConnection } = useNatsStore();
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();
    const [connectOpen, setConnectOpen] = React.useState(false);

    const go = (href: string) => {
        onOpenChange(false);
        router.push(href);
    };

    const runAction = async (action: () => Promise<void>) => {
        onOpenChange(false);
        await action();
    };

    const streamName = detailName(pathname, "streams");
    const bucketName = detailName(pathname, "kv") ?? detailName(pathname, "os");
    const bucketType = detailName(pathname, "kv") ? "KV" : detailName(pathname, "os") ? "Object Store" : null;

    async function purgeCurrentStream() {
        if (!activeConnection || !streamName) return;
        const ok = await confirm({
            title: `Purge stream "${streamName}"?`,
            description: "This permanently removes all messages from this stream. This cannot be undone.",
            confirmText: "Purge Stream",
            typedName: streamName,
        });
        if (!ok) return;
        const result = await purgeStream(activeConnection, streamName);
        if (!result.success) { toast.error("Failed to purge stream", { description: result.error }); return; }
        toast.success(`Purged ${result.data.purged.toLocaleString()} message(s)`);
    }

    async function deleteCurrentDetail() {
        if (!activeConnection) return;
        if (streamName) {
            const ok = await confirm({ title: `Delete stream "${streamName}"?`, description: "This permanently removes the stream and all its messages.", confirmText: "Delete Stream", typedName: streamName });
            if (!ok) return;
            const result = await deleteStream(activeConnection, streamName);
            if (!result.success) { toast.error("Failed to delete stream", { description: result.error }); return; }
            toast.success("Stream deleted");
            router.push("/streams");
        } else if (bucketName && bucketType === "KV") {
            const ok = await confirm({ title: `Delete KV bucket "${bucketName}"?`, description: "This permanently removes this bucket and all keys and history.", confirmText: "Delete KV Bucket", typedName: bucketName });
            if (!ok) return;
            const result = await deleteKVBucket(activeConnection, bucketName);
            if (!result.success) { toast.error("Failed to delete KV bucket", { description: result.error }); return; }
            toast.success("KV bucket deleted");
            router.push("/kv");
        } else if (bucketName && bucketType === "Object Store") {
            const ok = await confirm({ title: `Delete Object Store bucket "${bucketName}"?`, description: "This permanently removes this bucket and its objects.", confirmText: "Delete Bucket", typedName: bucketName });
            if (!ok) return;
            const result = await deleteOSBucket(activeConnection, bucketName);
            if (!result.success) { toast.error("Failed to delete Object Store bucket", { description: result.error }); return; }
            toast.success("Object Store bucket deleted");
            router.push("/os");
        }
    }

    return (
        <>
            <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} trigger={<span className="hidden" />} />
            <CommandDialog open={open} onOpenChange={onOpenChange}>
                <CommandInput placeholder="Jump to a page, switch connection, or run a command..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Navigation">
                        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                            <CommandItem key={href} value={label} onSelect={() => go(href)}>
                                <Icon className="size-4" /> <span>{label}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="Actions">
                        <CommandItem value="New Connection add connection" onSelect={() => { onOpenChange(false); setConnectOpen(true); }}>
                            <Plug className="size-4" /><span>New Connection</span>
                        </CommandItem>
                        <CommandItem value="Publish message" onSelect={() => go("/publish")}>
                            <Send className="size-4" /><span>Publish</span>
                        </CommandItem>
                        {streamName && (
                            <>
                                <CommandItem value={`Purge stream ${streamName}`} disabled={!activeConnection} onSelect={() => void runAction(purgeCurrentStream)}>
                                    <Eraser className="size-4" /><span>Purge {streamName}</span>
                                </CommandItem>
                                <CommandItem value={`Delete stream ${streamName}`} disabled={!activeConnection} onSelect={() => void runAction(deleteCurrentDetail)}>
                                    <Trash2 className="size-4" /><span>Delete {streamName}</span>
                                </CommandItem>
                            </>
                        )}
                        {bucketName && bucketType && (
                            <CommandItem value={`Delete ${bucketType} ${bucketName}`} disabled={!activeConnection} onSelect={() => void runAction(deleteCurrentDetail)}>
                                <Trash2 className="size-4" /><span>Delete {bucketType}: {bucketName}</span>
                            </CommandItem>
                        )}
                    </CommandGroup>
                    {connections.length > 0 && (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading="Connections">
                                {connections.map((connection) => (
                                    <CommandItem key={connection.id} value={`connection ${connection.name}`} onSelect={() => { setActiveConnection(connection.id); onOpenChange(false); }}>
                                        <Plus className="size-4" /> <span>Switch to {connection.name}</span>
                                        {activeConnectionId === connection.id && <span className="ml-auto text-[10px] text-emerald-400">active</span>}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </>
                    )}
                    <CommandSeparator />
                    <CommandGroup heading="Help">
                        <CommandItem value="keyboard shortcuts help" onSelect={() => { onOpenChange(false); onShowHelp(); }}>
                            <Keyboard className="size-4" /><span>Keyboard shortcuts</span><span className="ml-auto text-[10px] text-muted-foreground">?</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
