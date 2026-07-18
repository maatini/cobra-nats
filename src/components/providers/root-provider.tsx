"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/providers/confirm-provider";

export function RootProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <TooltipProvider>
                <ConfirmProvider>
                    {children}
                </ConfirmProvider>
                <Toaster position="top-right" richColors />
            </TooltipProvider>
        </ThemeProvider>
    );
}
