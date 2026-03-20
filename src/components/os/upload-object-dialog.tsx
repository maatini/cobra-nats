"use client";

import * as React from "react";
import { toast } from "sonner";
import { Upload, Loader2, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveConnection } from "@/hooks/use-active-connection";
import { uploadObject } from "@/app/actions/os-actions";

interface UploadObjectDialogProps {
    bucket: string;
    onUploaded?: () => void;
}

export function UploadObjectDialog({ bucket, onUploaded }: UploadObjectDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [objectName, setObjectName] = React.useState("");
    const activeConnection = useActiveConnection();

    /** Read file as base64 and upload. */
    async function handleUpload() {
        if (!activeConnection || !selectedFile) return;

        const name = objectName.trim() || selectedFile.name;
        setIsUploading(true);

        try {
            const buffer = await selectedFile.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            // Encode to base64
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            const result = await uploadObject(activeConnection, bucket, name, base64);

            if (result.success) {
                toast.success(`Object "${name}" uploaded successfully`);
                setOpen(false);
                setSelectedFile(null);
                setObjectName("");
                onUploaded?.();
            } else {
                toast.error("Upload failed", { description: result.error });
            }
        } catch (err) {
            toast.error("Upload failed", {
                description: err instanceof Error ? err.message : "Unknown error",
            });
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                    <Upload className="size-4" />
                    Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileUp className="size-5 text-cyan-500" />
                        Upload Object
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Upload a file to the <span className="font-mono text-cyan-400">{bucket}</span> bucket.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="file">File</Label>
                        <Input
                            id="file"
                            type="file"
                            className="bg-slate-900 border-slate-800 file:text-slate-300 file:bg-slate-800 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded-md cursor-pointer"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setSelectedFile(file);
                                if (file && !objectName) setObjectName(file.name);
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="objName">Object Name</Label>
                        <Input
                            id="objName"
                            placeholder="my-file.txt"
                            value={objectName}
                            onChange={(e) => setObjectName(e.target.value)}
                            className="bg-slate-900 border-slate-800"
                        />
                        <p className="text-[10px] text-slate-500">
                            Defaults to the file name if left empty.
                        </p>
                    </div>
                </div>

                <DialogFooter className="pt-4">
                    <Button
                        onClick={handleUpload}
                        disabled={isUploading || !selectedFile || !activeConnection}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white w-full"
                    >
                        {isUploading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            "Upload Object"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
