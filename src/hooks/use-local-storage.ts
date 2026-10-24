"use client";

import * as React from "react";

type Listener = () => void;
type CacheEntry = { raw: string | null; value: unknown };

/**
 * Parsed snapshot per key. Re-used as long as the raw stored string is
 * unchanged so `getSnapshot` stays referentially stable across renders.
 */
const snapshotCache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<Listener>>();

function readRaw(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function readSnapshot<T>(key: string, initialValue: T): T {
    if (typeof window === "undefined") return initialValue;
    const raw = readRaw(key);
    const cached = snapshotCache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;
    let value: unknown = initialValue;
    if (raw !== null) {
        try {
            value = JSON.parse(raw);
        } catch {
            // ignore corrupted JSON
        }
    }
    snapshotCache.set(key, { raw, value });
    return value as T;
}

function subscribe(key: string, listener: Listener) {
    let keyListeners = listeners.get(key);
    if (!keyListeners) {
        keyListeners = new Set();
        listeners.set(key, keyListeners);
    }
    keyListeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener("storage", onStorage);
        keyListeners.delete(listener);
        if (keyListeners.size === 0) listeners.delete(key);
    };
}

function notify(key: string) {
    const keyListeners = listeners.get(key);
    if (!keyListeners) return;
    for (const listener of keyListeners) listener();
}

/**
 * SSR-safe typed localStorage hook. Returns a React state tuple backed by
 * `window.localStorage`. The server snapshot and the hydration render return
 * `initialValue` to avoid hydration mismatch; the stored value is adopted
 * right after hydration via `useSyncExternalStore`.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
    const subscribeToKey = React.useCallback(
        (listener: Listener) => subscribe(key, listener),
        [key]
    );

    const getSnapshot = React.useCallback(
        () => readSnapshot(key, initialValue),
        [key, initialValue]
    );

    const getServerSnapshot = React.useCallback(() => initialValue, [initialValue]);

    const value = React.useSyncExternalStore(subscribeToKey, getSnapshot, getServerSnapshot);

    const setAndStore = React.useCallback(
        (next: T | ((prev: T) => T)) => {
            const prev = readSnapshot(key, initialValue);
            const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
            const serialized = JSON.stringify(resolved);
            try {
                if (serialized === undefined) window.localStorage.removeItem(key);
                else window.localStorage.setItem(key, serialized);
            } catch {
                // quota exceeded etc.
            }
            // Re-read the raw string so a failed write still keeps the in-memory value.
            snapshotCache.set(key, { raw: readRaw(key), value: resolved });
            notify(key);
        },
        [key, initialValue]
    );

    return [value, setAndStore] as const;
}
