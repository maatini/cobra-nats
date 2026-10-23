/** Browser-local dashboard sampling contract. Samples are intentionally ephemeral. */
export const DASHBOARD_SAMPLE_LIMIT = 60;

export interface DashboardSample {
    sampledAt: number;
    streamCount: number | null;
    consumers: number | null;
    storageBytes: number | null;
    serverConnections: number | null;
    inboundMessages: number | null;
    outboundMessages: number | null;
}

export interface DashboardSampleHistory {
    connectionId: string | null;
    samples: DashboardSample[];
    monitoringEndpoint: string | null;
}

export const EMPTY_DASHBOARD_HISTORY: DashboardSampleHistory = {
    connectionId: null,
    samples: [],
    monitoringEndpoint: null,
};

/**
 * Append one successful snapshot, keeping the newest finite number of samples.
 * Null means the source metric was unavailable; it is never coerced to zero.
 * Changing connection identity starts a fresh segment.
 */
export function recordDashboardSample(
    history: DashboardSampleHistory,
    connectionId: string,
    sample: DashboardSample,
    monitoringEndpoint: string | null = history.monitoringEndpoint
): DashboardSampleHistory {
    const sameSegment = history.connectionId === connectionId && history.monitoringEndpoint === monitoringEndpoint;
    const current = sameSegment ? history.samples : [];

    return {
        connectionId,
        samples: [...current, sample].slice(-DASHBOARD_SAMPLE_LIMIT),
        monitoringEndpoint,
    };
}

/** Drop all history, used when there is no active connection. */
export function resetDashboardHistory(): DashboardSampleHistory {
    return { ...EMPTY_DASHBOARD_HISTORY };
}
