export type PayloadFormat = "json" | "text" | "cbor" | "binary";

export interface PayloadInspection {
    format: PayloadFormat;
    text?: string;
    prettyJson?: string;
    cborValue?: unknown;
    hex: string;
    bytes: Uint8Array;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function bytesFromBase64(base64: string): Uint8Array {
    try {
        const binary = atob(base64);
        return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
        return new Uint8Array();
    }
}

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function decodeCbor(bytes: Uint8Array): unknown {
    let offset = 0;
    const readArgument = (additional: number): number | bigint => {
        if (additional < 24) return additional;
        const width = ({ 24: 1, 25: 2, 26: 4, 27: 8 } as Record<number, number>)[additional];
        if (!width || offset + width > bytes.length) throw new Error("Invalid CBOR argument");
        let value = BigInt(0);
        for (let i = 0; i < width; i++) value = (value << BigInt(8)) | BigInt(bytes[offset++]);
        return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
    };
    const count = (value: number | bigint): number => {
        if (typeof value === "bigint" || value > 100_000) throw new Error("CBOR item exceeds decode limit");
        return value;
    };
    const parse = (depth: number): unknown => {
        if (depth > 64 || offset >= bytes.length) throw new Error("Invalid CBOR payload");
        const initial = bytes[offset++];
        const major = initial >> 5;
        const additional = initial & 31;
        if (additional === 31) throw new Error("Indefinite CBOR values are unsupported");

        if (major === 7) {
            if (additional === 20) return false;
            if (additional === 21) return true;
            if (additional === 22 || additional === 23) return null;
            if (additional === 25 || additional === 26 || additional === 27) {
                const width = additional === 25 ? 2 : additional === 26 ? 4 : 8;
                if (offset + width > bytes.length) throw new Error("Invalid CBOR float");
                const view = new DataView(bytes.buffer, bytes.byteOffset + offset, width);
                let value: number;
                if (width === 2) {
                    const bits = view.getUint16(0, false);
                    const sign = bits & 0x8000 ? -1 : 1;
                    const exponent = (bits >> 10) & 31;
                    const fraction = bits & 1023;
                    value = exponent === 0 ? sign * 2 ** -14 * fraction / 1024 : exponent === 31 ? (fraction ? NaN : sign * Infinity) : sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
                } else value = width === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
                offset += width;
                return value;
            }
            if (additional < 20) return additional;
            throw new Error("Unsupported CBOR simple value");
        }

        const argument = readArgument(additional);
        switch (major) {
            case 0: return argument;
            case 1: return typeof argument === "bigint" ? BigInt(-1) - argument : -1 - argument;
            case 2: {
                const size = count(argument);
                if (offset + size > bytes.length) throw new Error("Invalid CBOR byte string");
                const data = bytes.subarray(offset, offset + size);
                offset += size;
                return { type: "bytes", hex: Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join(" ") };
            }
            case 3: {
                const size = count(argument);
                if (offset + size > bytes.length) throw new Error("Invalid CBOR text");
                const value = utf8.decode(bytes.subarray(offset, offset + size));
                offset += size;
                return value;
            }
            case 4: return Array.from({ length: count(argument) }, () => parse(depth + 1));
            case 5: {
                const result: Record<string, unknown> = {};
                for (let i = 0; i < count(argument); i++) result[String(parse(depth + 1))] = parse(depth + 1);
                return result;
            }
            case 6: return { tag: String(argument), value: parse(depth + 1) };
            default: throw new Error("Unsupported CBOR value");
        }
    };
    const result = parse(0);
    if (offset !== bytes.length) throw new Error("Trailing bytes after CBOR value");
    return result;
}

function looksLikeText(value: string): boolean {
    return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

export function inspectPayload(payload: string, base64?: string): PayloadInspection {
    const bytes = base64 !== undefined ? bytesFromBase64(base64) : new TextEncoder().encode(payload);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
    let text: string | undefined;
    try { text = utf8.decode(bytes); } catch { /* Binary bytes are represented by hex. */ }
    if (text !== undefined && looksLikeText(text)) {
        const trimmed = text.trim();
        if (trimmed && (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"'))) {
            try { return { format: "json", text, prettyJson: JSON.stringify(JSON.parse(text), null, 2), hex, bytes }; }
            catch { /* Check other supported payload formats. */ }
        }
    }
    try {
        const cborValue = decodeCbor(bytes);
        if (bytes.length > 0) return { format: "cbor", cborValue, hex, bytes };
    } catch { /* Unknown binary formats remain inspectable as hex. */ }
    if (text !== undefined && looksLikeText(text)) return { format: "text", text, hex, bytes };
    return { format: "binary", hex, bytes };
}

export interface ProtobufField {
    name: string;
    type: "uint32" | "int32" | "bool" | "string" | "bytes" | "float" | "double";
}

/** Decode protobuf wire fields from an explicit user-provided field-number JSON schema. */
export function decodeProtobuf(bytes: Uint8Array, schema: Record<string, ProtobufField>): Record<string, unknown> {
    let offset = 0;
    const result: Record<string, unknown> = {};
    const varint = (): bigint => {
        let value = BigInt(0);
        for (let shift = BigInt(0); shift < BigInt(70); shift += BigInt(7)) {
            if (offset >= bytes.length) throw new Error("Truncated protobuf varint");
            const byte = bytes[offset++];
            value |= BigInt(byte & 0x7f) << shift;
            if (!(byte & 0x80)) return value;
        }
        throw new Error("Invalid protobuf varint");
    };
    while (offset < bytes.length) {
        const key = Number(varint());
        const fieldNumber = key >>> 3;
        const wireType = key & 7;
        if (!fieldNumber) throw new Error("Invalid protobuf field number");
        const field = schema[String(fieldNumber)];
        if (!field) throw new Error(`Schema is missing protobuf field ${fieldNumber}`);
        let value: unknown;
        if (wireType === 0) {
            const raw = varint();
            value = field.type === "bool" ? raw !== BigInt(0) : field.type === "int32" ? Number(BigInt.asIntN(32, raw)) : Number(raw);
        } else if (wireType === 2) {
            const size = Number(varint());
            if (size > bytes.length - offset) throw new Error("Truncated protobuf field");
            const data = bytes.subarray(offset, offset + size); offset += size;
            if (field.type === "string") value = utf8.decode(data);
            else if (field.type === "bytes") value = Array.from(data);
            else throw new Error("Schema type does not match protobuf wire type");
        } else if (wireType === 5 && field.type === "float" && offset + 4 <= bytes.length) {
            value = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getFloat32(0, true); offset += 4;
        } else if (wireType === 1 && field.type === "double" && offset + 8 <= bytes.length) {
            value = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true); offset += 8;
        } else throw new Error(`Unsupported or schema-mismatched protobuf wire type ${wireType}`);
        const name = field.name || String(fieldNumber);
        const previous = result[name];
        result[name] = previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value];
    }
    return result;
}
