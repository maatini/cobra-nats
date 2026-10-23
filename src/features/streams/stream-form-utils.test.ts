import { describe, expect, it } from "vitest";

import {
    StreamConfigImportSchema,
    ageToNs,
    exportStreamConfig,
    nsToAgeFields,
} from "@/features/streams/stream-form-utils";

describe("stream config form utilities", () => {
    it("round-trips supported max-age units", () => {
        expect(nsToAgeFields(2 * 86_400_000_000_000)).toEqual({ value: 2, unit: "d" });
        expect(ageToNs(2, "d")).toBe(172_800_000_000_000);
        expect(nsToAgeFields(0)).toEqual({ value: 0, unit: "h" });
    });

    it("exports serializable stream config without null fields or sealed", () => {
        expect(exportStreamConfig({ name: "ORDERS", sealed: true, description: null, subjects: ["orders.>"] })).toEqual({
            name: "ORDERS",
            subjects: ["orders.>"],
        });
    });

    it("accepts only valid stream configuration import data and strips unrelated properties", () => {
        const result = StreamConfigImportSchema.safeParse({
            name: " ORDERS ",
            subjects: ["orders.>"],
            retention: "limits",
            storage: "file",
            messages: [{ seq: 1, data: "not-restored" }],
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe("ORDERS");
            expect("messages" in result.data).toBe(false);
        }
        expect(StreamConfigImportSchema.safeParse({ name: "", retention: "unknown" }).success).toBe(false);
    });
});
