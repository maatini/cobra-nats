import { describe, expect, it } from "vitest";

import {
    DASHBOARD_SAMPLE_LIMIT,
    EMPTY_DASHBOARD_HISTORY,
    recordDashboardSample,
    resetDashboardHistory,
} from "@/features/dashboard/sampler";

describe("dashboard sampler", () => {
    it("appends timestamped values and bounds the history", () => {
        let history = EMPTY_DASHBOARD_HISTORY;
        for (let index = 0; index < DASHBOARD_SAMPLE_LIMIT + 4; index += 1) {
            history = recordDashboardSample(history, "a", {
                sampledAt: index,
                streamCount: index,
                consumers: null,
                storageBytes: 0,
                serverConnections: null,
                inboundMessages: null,
                outboundMessages: null,
            });
        }

        expect(history.samples).toHaveLength(DASHBOARD_SAMPLE_LIMIT);
        expect(history.samples[0]?.sampledAt).toBe(4);
        expect(history.samples.at(-1)?.sampledAt).toBe(DASHBOARD_SAMPLE_LIMIT + 3);
        expect(history.samples.at(-1)?.consumers).toBeNull();
        expect(history.samples.at(-1)?.storageBytes).toBe(0);
    });

    it("starts a separate series after a connection change", () => {
        const prior = recordDashboardSample(EMPTY_DASHBOARD_HISTORY, "a", {
            sampledAt: 1,
            streamCount: 3,
            consumers: null,
            storageBytes: null,
            serverConnections: null,
            inboundMessages: null,
            outboundMessages: null,
        });
        const next = recordDashboardSample(prior, "b", {
            sampledAt: 2,
            streamCount: 0,
            consumers: 0,
            storageBytes: 0,
            serverConnections: null,
            inboundMessages: null,
            outboundMessages: null,
        });

        expect(next.connectionId).toBe("b");
        expect(next.samples).toHaveLength(1);
        expect(next.samples[0]?.sampledAt).toBe(2);
    });

    it("starts a separate series when the monitoring endpoint changes", () => {
        const prior = recordDashboardSample(EMPTY_DASHBOARD_HISTORY, "a", {
            sampledAt: 1,
            streamCount: null,
            consumers: 0,
            storageBytes: null,
            serverConnections: null,
            inboundMessages: null,
            outboundMessages: null,
        }, "varz");
        const next = recordDashboardSample(prior, "a", {
            sampledAt: 2,
            streamCount: 0,
            consumers: null,
            storageBytes: 0,
            serverConnections: 1,
            inboundMessages: 2,
            outboundMessages: 3,
        }, "jsz");

        expect(next.monitoringEndpoint).toBe("jsz");
        expect(next.samples).toHaveLength(1);
        expect(next.samples[0]?.sampledAt).toBe(2);
        expect(next.samples[0]?.streamCount).toBe(0);
        expect(next.samples[0]?.consumers).toBeNull();
    });

    it("resets history when there is no active connection", () => {
        expect(resetDashboardHistory()).toEqual(EMPTY_DASHBOARD_HISTORY);
    });
});
