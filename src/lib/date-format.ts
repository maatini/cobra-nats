/** Format a date with the platform's locale-aware date formatter. */
export function formatDate(date: Date | number | string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(date));
}

/** Format a date relative to now using the platform's locale-aware relative formatter. */
export function formatRelativeTime(date: Date | number | string, now = Date.now()): string {
    const deltaSeconds = (new Date(date).getTime() - now) / 1000;
    if (!Number.isFinite(deltaSeconds)) return "Invalid Date";

    const absoluteSeconds = Math.abs(deltaSeconds);
    const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
        { unit: "year", seconds: 365 * 24 * 60 * 60 },
        { unit: "month", seconds: 30 * 24 * 60 * 60 },
        { unit: "week", seconds: 7 * 24 * 60 * 60 },
        { unit: "day", seconds: 24 * 60 * 60 },
        { unit: "hour", seconds: 60 * 60 },
        { unit: "minute", seconds: 60 },
        { unit: "second", seconds: 1 },
    ];
    const { unit, seconds } = units.find(({ seconds: threshold }) => absoluteSeconds >= threshold) ?? units[units.length - 1];
    const value = Math.round(deltaSeconds / seconds);
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(value, unit);
}
