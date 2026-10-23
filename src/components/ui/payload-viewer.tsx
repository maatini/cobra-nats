"use client";

import * as React from "react";
import { inspectPayload, decodeProtobuf, type ProtobufField } from "@/lib/payload-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PayloadViewerProps {
    payload: string;
    base64?: string;
    className?: string;
    emptyLabel?: string;
}

const SAMPLE_PROTO_SCHEMA = '{\n  "1": { "name": "id", "type": "uint32" },\n  "2": { "name": "name", "type": "string" }\n}';

export function PayloadViewer({ payload, base64, className, emptyLabel = "(empty)" }: PayloadViewerProps) {
    const inspected = React.useMemo(() => inspectPayload(payload, base64), [payload, base64]);
    const [schemaOpen, setSchemaOpen] = React.useState(false);
    const [schemaText, setSchemaText] = React.useState(SAMPLE_PROTO_SCHEMA);
    const [protobufError, setProtobufError] = React.useState<string | null>(null);
    const [protobufValue, setProtobufValue] = React.useState<Record<string, unknown> | null>(null);

    function decodeWithSchema() {
        try {
            const schema = JSON.parse(schemaText) as Record<string, ProtobufField>;
            if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new Error("Schema must be a JSON object keyed by protobuf field number.");
            for (const [number, field] of Object.entries(schema)) {
                if (!/^\\d+$/.test(number) || !field || typeof field.name !== "string" || !["uint32", "int32", "bool", "string", "bytes", "float", "double"].includes(field.type)) {
                    throw new Error(`Invalid schema entry for field ${number}.`);
                }
            }
            setProtobufValue(decodeProtobuf(inspected.bytes, schema));
            setProtobufError(null);
        } catch (error) {
            setProtobufValue(null);
            setProtobufError(error instanceof Error ? error.message : "Unable to decode protobuf payload.");
        }
    }

    const display = inspected.format === "json"
        ? inspected.prettyJson
        : inspected.format === "cbor"
            ? JSON.stringify(inspected.cborValue, null, 2)
            : inspected.text;

    return (
        <div className={className}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[9px] uppercase">{inspected.format.toUpperCase()}</Badge>
                {inspected.format === "binary" && <Badge variant="outline" className="text-[9px]">Hex</Badge>}
                {(inspected.format === "binary" || inspected.format === "cbor") && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setSchemaOpen((open) => !open)}>
                        {schemaOpen ? "Hide protobuf schema" : "Decode as protobuf"}
                    </Button>
                )}
            </div>
            {inspected.format === "binary" ? (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-background p-3 font-mono text-[11px]" aria-label="Payload hexadecimal bytes">
                    {inspected.hex || emptyLabel}
                </pre>
            ) : (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-3 font-mono text-[11px]">
                    {display || emptyLabel}
                </pre>
            )}
            {schemaOpen && (
                <div className="mt-3 space-y-2 rounded border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Paste a JSON schema mapping protobuf field numbers to names and wire types. Decoding happens locally; no schema registry is used.</p>
                    <textarea
                        aria-label="Protobuf schema JSON"
                        value={schemaText}
                        onChange={(event) => setSchemaText(event.target.value)}
                        className="min-h-28 w-full rounded border border-border bg-card p-2 font-mono text-xs"
                    />
                    <Button type="button" size="sm" onClick={decodeWithSchema}>Decode protobuf</Button>
                    {protobufError && <p role="alert" className="text-xs text-destructive">{protobufError}</p>}
                    {protobufValue && <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-border p-2 font-mono text-xs">{JSON.stringify(protobufValue, null, 2)}</pre>}
                </div>
            )}
        </div>
    );
}
