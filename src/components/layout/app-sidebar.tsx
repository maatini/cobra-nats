"use client";

import {
    LayoutDashboard,
    Layers,
    Database,
    HardDrive,
    Send,
    Monitor,
    Settings,
    Plus,
} from "lucide-react";
import * as React from "react";
import { ConnectDialog } from "@/features/connections/components/connect-dialog";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const items = [
    {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
    },
    {
        title: "Streams",
        url: "/streams",
        icon: Layers,
    },
    {
        title: "KV Stores",
        url: "/kv",
        icon: Database,
    },
    {
        title: "Object Store",
        url: "/os",
        icon: HardDrive,
    },
    {
        title: "Publish",
        url: "/publish",
        icon: Send,
    },
    {
        title: "Monitor",
        url: "/monitor",
        icon: Monitor,
    },
    {
        title: "Settings",
        url: "/settings",
        icon: Settings,
    },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname();

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-indigo-600 text-sidebar-primary-foreground">
                                    <Database className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold text-indigo-400">Cobra NATS</span>
                                    <span className="text-xs text-slate-500">v0.1.0</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const isActive = pathname === item.url;
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    tooltip={item.title}
                                    className={cn(
                                        "transition-colors",
                                        isActive
                                            ? "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 hover:text-indigo-300"
                                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                    )}
                                >
                                    <Link href={item.url}>
                                        <item.icon className="size-4" />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <ConnectDialog
                            trigger={
                                <SidebarMenuButton className="text-slate-400 hover:text-indigo-400">
                                    <Plus className="size-4" />
                                    <span>New Connection</span>
                                </SidebarMenuButton>
                            }
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
