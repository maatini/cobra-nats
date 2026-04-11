"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Options supplied to a single `confirm()` invocation.
 */
export interface ConfirmOptions {
    title: string;
    description?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    /** Style of the confirm button. `destructive` is the default and uses rose. */
    variant?: "destructive" | "default";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

/**
 * Hook returning a promise-based confirm function. Replaces `window.confirm`
 * with a styled Radix-powered dialog that matches the rest of the UI.
 */
export function useConfirm(): ConfirmFn {
    const ctx = React.useContext(ConfirmContext);
    if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
    return ctx;
}

interface PendingRequest {
    opts: ConfirmOptions;
    resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [request, setRequest] = React.useState<PendingRequest | null>(null);

    const confirm = React.useCallback<ConfirmFn>(opts => {
        return new Promise<boolean>(resolve => {
            setRequest({ opts, resolve });
        });
    }, []);

    const close = (result: boolean) => {
        if (request) {
            request.resolve(result);
            setRequest(null);
        }
    };

    const opts = request?.opts;
    const variant = opts?.variant ?? "destructive";

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Dialog
                open={request !== null}
                onOpenChange={open => {
                    if (!open) close(false);
                }}
            >
                <DialogContent className="sm:max-w-[440px] bg-slate-950 border-slate-800 text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle
                                className={
                                    variant === "destructive"
                                        ? "size-5 text-rose-500"
                                        : "size-5 text-amber-500"
                                }
                            />
                            {opts?.title}
                        </DialogTitle>
                        {opts?.description && (
                            <DialogDescription className="text-slate-400 pt-2">
                                {opts.description}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => close(false)}
                            className="text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                        >
                            {opts?.cancelText ?? "Cancel"}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => close(true)}
                            className={
                                variant === "destructive"
                                    ? "bg-rose-600 hover:bg-rose-700 text-white min-w-[110px]"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white min-w-[110px]"
                            }
                        >
                            {opts?.confirmText ?? "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ConfirmContext.Provider>
    );
}
