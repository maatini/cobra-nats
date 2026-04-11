"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/providers/confirm-provider";
import { useState } from "react";

export function RootProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <ConfirmProvider>
                    {children}
                </ConfirmProvider>
                <Toaster position="top-right" richColors />
            </TooltipProvider>
        </QueryClientProvider>
    );
}
