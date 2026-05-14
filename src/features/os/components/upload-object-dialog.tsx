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
import { useActiveConnection } from "@/features/connections/hooks";

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

    /** Upload file via API route (FormData) — bypasses RSC serialisation limits. */
    async function handleUpload() {
        if (!activeConnection || !selectedFile) return;

        const name = objectName.trim() || selectedFile.name;
        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.set("bucket", bucket);
            formData.set("connection", JSON.stringify({
                name: activeConnection.name,
                servers: activeConnection.servers,
                authType: activeConnection.authType,
                user: activeConnection.user,
                pass: activeConnection.pass,
                token: activeConnection.token,
            }));
            formData.set("file", selectedFile, name);

            const res = await fetch("/api/os/upload", { method: "POST", body: formData });
            const result = await res.json();

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
            <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileUp className="size-5 text-cyan-500" />
                        Upload Object
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Upload a file to the <span className="font-mono text-cyan-400">{bucket}</span> bucket.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="file">File</Label>
                        <Input
                            id="file"
                            type="file"
                            className="bg-card border-border file:text-foreground/80 file:bg-muted file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded-md cursor-pointer"
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
                            className="bg-card border-border"
                        />
                        <p className="text-[10px] text-muted-foreground">
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
