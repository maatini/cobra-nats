"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const subscribeToMount = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const mounted = React.useSyncExternalStore(
        subscribeToMount,
        getMountedSnapshot,
        getServerMountedSnapshot
    );

    const isDark = mounted && resolvedTheme === "dark";

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground"
        >
            {mounted ? (
                isDark ? <Sun className="size-4" /> : <Moon className="size-4" />
            ) : (
                <Sun className="size-4 opacity-0" />
            )}
        </Button>
    );
}
