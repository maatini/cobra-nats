"use client";

import * as React from "react";

/**
 * SSR-safe typed localStorage hook. Returns a React state tuple backed by
 * `window.localStorage`. Initial render returns `initialValue` on the server
 * and during the first client render to avoid hydration mismatch; the stored
 * value is adopted in a post-mount effect.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
    const [value, setValue] = React.useState<T>(initialValue);

    React.useEffect(() => {
        try {
            const raw = window.localStorage.getItem(key);
            if (raw !== null) setValue(JSON.parse(raw) as T);
        } catch {
            // ignore corrupted JSON
        }
    }, [key]);

    const setAndStore = React.useCallback(
        (next: T | ((prev: T) => T)) => {
            setValue(prev => {
                const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
                try {
                    window.localStorage.setItem(key, JSON.stringify(resolved));
                } catch {
                    // quota exceeded etc.
                }
                return resolved;
            });
        },
        [key]
    );

    return [value, setAndStore] as const;
}
