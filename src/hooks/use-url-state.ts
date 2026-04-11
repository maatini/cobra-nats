"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Primitive = string | number | boolean | null | undefined;
type UrlStateValues = Record<string, Primitive>;

/**
 * Keeps local React state as the source of truth for table filter/sort/page,
 * seeded once from the URL on mount and mirrored back to the URL via
 * `router.replace` as a side-effect.
 *
 * Using local state avoids the race where fast keystrokes read stale
 * `useSearchParams()` before `router.replace` has propagated.
 */
export function useUrlState<T extends UrlStateValues>(defaults: T) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const initial = React.useMemo(() => {
        const result: Record<string, Primitive> = { ...defaults };
        for (const key of Object.keys(defaults)) {
            const raw = params.get(key);
            if (raw === null) continue;
            const def = defaults[key];
            if (typeof def === "number") {
                const n = Number(raw);
                result[key] = Number.isFinite(n) ? n : def;
            } else if (typeof def === "boolean") {
                result[key] = raw === "true";
            } else {
                result[key] = raw;
            }
        }
        return result as T;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [state, setStateRaw] = React.useState<T>(initial);

    React.useEffect(() => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(state)) {
            const def = defaults[key as keyof T];
            if (value === undefined || value === null || value === "" || value === def) continue;
            search.set(key, String(value));
        }
        const qs = search.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, pathname]);

    const setState = React.useCallback((patch: Partial<T>) => {
        setStateRaw(prev => ({ ...prev, ...patch }));
    }, []);

    return [state, setState] as const;
}
