"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ActionResponse, NatsConnectionConfig } from "@/types/nats";
import { useActiveConnection } from "@/features/connections/hooks";

export type ServerActionQueryOptions<T> = {
    /** When false, skip loading (default true when connection exists). */
    enabled?: boolean;
    /** Toast title on failure. Omit to skip automatic error toasts. */
    errorToast?: string;
    /** Value used when there is no connection or load is skipped. Prefer a stable module-level constant. */
    emptyValue: T;
    /**
     * Extra dependencies that should trigger a reload (e.g. route params).
     * Connection changes always reload.
     */
    deps?: React.DependencyList;
};

export type ServerActionQueryResult<T> = {
    data: T;
    error: string | null;
    isLoading: boolean;
    reload: () => Promise<void>;
    connection: NatsConnectionConfig | null;
};

/**
 * Load data from a Server Action keyed by the active NATS connection.
 * Handles loading/error state and connection changes without React Query.
 */
export function useServerActionQuery<T>(
    loader: (config: NatsConnectionConfig) => Promise<ActionResponse<T>>,
    options: ServerActionQueryOptions<T>
): ServerActionQueryResult<T> {
    const connection = useActiveConnection();
    const { emptyValue, errorToast, enabled = true, deps = [] } = options;

    const [data, setData] = React.useState<T>(emptyValue);
    const [error, setError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Refs keep loader / emptyValue / toast title out of effect dependency churn.
    const loaderRef = React.useRef(loader);
    const emptyValueRef = React.useRef(emptyValue);
    const errorToastRef = React.useRef(errorToast);
    React.useEffect(() => {
        loaderRef.current = loader;
        emptyValueRef.current = emptyValue;
        errorToastRef.current = errorToast;
    });

    const reload = React.useCallback(async () => {
        if (!connection || !enabled) {
            setData(emptyValueRef.current);
            setError(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const result = await loaderRef.current(connection);
        if (result.success) {
            setData(result.data);
        } else {
            setError(result.error);
            setData(emptyValueRef.current);
            if (errorToastRef.current) {
                toast.error(errorToastRef.current, { description: result.error });
            }
        }
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is caller-controlled
    }, [connection, enabled, ...deps]);

    React.useEffect(() => {
        void reload();
    }, [reload]);

    return { data, error, isLoading, reload, connection: connection ?? null };
}
