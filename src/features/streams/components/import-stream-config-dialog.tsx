"use client";

import * as React from "react";
import { FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveConnection } from "@/features/connections/hooks";
import { importStreamConfig } from "@/features/streams/actions";
import { StreamConfigImportSchema } from "@/features/streams/stream-form-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export function ImportStreamConfigDialog({ onImported }: { onImported: () => void }) {
    const connection = useActiveConnection();
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState<unknown>(null);
    const [fileName, setFileName] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [isImporting, setIsImporting] = React.useState(false);

    async function readFile(file: File | undefined) {
        setConfig(null);
        setFileName(file?.name ?? "");
        setError(null);
        if (!file) return;
        try {
            const parsed: unknown = JSON.parse(await file.text());
            const result = StreamConfigImportSchema.safeParse(parsed);
            if (!result.success) {
                setError(result.error.issues.map((issue) => issue.message).join("; "));
                return;
            }
            setConfig(result.data);
        } catch {
            setError("Choose a valid stream configuration JSON file.");
        }
    }

    async function submit() {
        if (!connection || !config) return;
        setIsImporting(true);
        const result = await importStreamConfig(connection, config);
        setIsImporting(false);
        if (!result.success) {
            toast.error("Failed to import stream configuration", { description: result.error });
            return;
        }
        toast.success(`Stream "${result.data.config.name}" created from configuration`);
        setOpen(false);
        setConfig(null);
        setFileName("");
        onImported();
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!connection}>
                    <FileJson className="mr-2 size-4" /> Import Config JSON
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import stream configuration</DialogTitle>
                    <DialogDescription>
                        Creates a new stream from exported configuration JSON. Messages are not restored.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Input
                        type="file"
                        accept=".json,application/json"
                        aria-label="Stream configuration JSON file"
                        onChange={(event) => void readFile(event.target.files?.[0])}
                    />
                    {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    {config !== null && <p className="text-sm text-emerald-500">Configuration is valid and ready to create.</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => void submit()} disabled={!config || !connection || isImporting}>
                        {isImporting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Create Stream
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
