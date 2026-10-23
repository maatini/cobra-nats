import { describe, expect, it } from "vitest";
import { createMonitoringEndpointUrl } from "./monitoring-url-policy";

describe("monitoring URL policy", () => {
    it.each(["http://169.254.169.254/latest/meta-data/", "http://metadata.google.internal/varz", "https://instance-data/varz"])(
        "rejects metadata endpoint %s", (url) => {
            expect(createMonitoringEndpointUrl(url, "varz").success).toBe(false);
        },
    );

    it.each(["file:///etc/passwd", "ftp://example.com/varz", "javascript:alert(1)"])(
        "rejects non-HTTP scheme %s", (url) => {
            expect(createMonitoringEndpointUrl(url, "varz").success).toBe(false);
        },
    );

    it("allows local NATS monitoring", () => {
        expect(createMonitoringEndpointUrl("http://localhost:8222/varz", "varz")).toEqual({
            success: true,
            url: "http://localhost:8222/varz",
        });
    });
});
