import { toast } from "sonner";
import type { ActionResponse } from "@/types/nats";

type ToastActionMessages<T> = {
    loading: string;
    /** Called on success; return string for toast message, or void to skip success toast text override. */
    success: (data: T) => string;
    /** Optional prefix/description for failure toast. Defaults to a generic failure message. */
    error?: string | ((error: string) => string);
};

/**
 * Run a Server Action that returns `ActionResponse<T>` and surface the result via Sonner.
 *
 * Unlike `toast.promise`, this correctly handles actions that resolve with
 * `{ success: false }` instead of rejecting.
 */
export async function toastAction<T>(
    action: Promise<ActionResponse<T>>,
    messages: ToastActionMessages<T>
): Promise<ActionResponse<T>> {
    const toastId = toast.loading(messages.loading);

    try {
        const result = await action;
        if (result.success) {
            toast.success(messages.success(result.data), { id: toastId });
        } else {
            const errMsg =
                typeof messages.error === "function"
                    ? messages.error(result.error)
                    : messages.error ?? result.error;
            toast.error(errMsg, {
                id: toastId,
                description: typeof messages.error === "string" ? result.error : undefined,
            });
        }
        return result;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message, { id: toastId });
        return { success: false, error: message };
    }
}
