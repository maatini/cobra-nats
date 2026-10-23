import { describe, expect, it } from "vitest";

import {
    bytesFromBase64,
    bytesToBase64,
    decodeProtobuf,
    inspectPayload,
} from "@/lib/payload-format";

describe("payload format inspection", () => {
    it("pretty-prints JSON payloads and preserves their bytes", () => {
        const inspection = inspectPayload('{"ok":true,"count":2}');

        expect(inspection.format).toBe("json");
        expect(inspection.prettyJson).toBe('{\n  "ok": true,\n  "count": 2\n}');
        expect(inspection.text).toBe('{"ok":true,"count":2}');
        expect(inspection.hex).toBe("7b 22 6f 6b 22 3a 74 72 75 65 2c 22 63 6f 75 6e 74 22 3a 32 7d");
    });

    it("renders non-UTF-8 bytes as hex when base64 bytes are provided", () => {
        const base64 = bytesToBase64(Uint8Array.from([0xff, 0x00, 0x41]));
        const inspection = inspectPayload("display fallback", base64);

        expect(bytesFromBase64(base64)).toEqual(Uint8Array.from([0xff, 0x00, 0x41]));
        expect(inspection.format).toBe("binary");
        expect(inspection.hex).toBe("ff 00 41");
    });

    it("decodes a definite-length CBOR map", () => {
        const inspection = inspectPayload("", bytesToBase64(Uint8Array.from([0xa1, 0x61, 0x61, 0x01])));

        expect(inspection.format).toBe("cbor");
        expect(inspection.cborValue).toEqual({ a: 1 });
    });

    it("decodes protobuf fields according to the supplied schema", () => {
        const decoded = decodeProtobuf(Uint8Array.from([0x08, 0x2a, 0x12, 0x02, 0x68, 0x69]), {
            "1": { name: "id", type: "int32" },
            "2": { name: "label", type: "string" },
        });

        expect(decoded).toEqual({ id: 42, label: "hi" });
    });

    it("rejects protobuf data that has no matching schema field", () => {
        expect(() => decodeProtobuf(Uint8Array.from([0x08, 0x2a]), {})).toThrow("Schema is missing protobuf field 1");
    });
});
