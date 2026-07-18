"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveConnection } from "@/features/connections/hooks";
import {
    listObjects,
    downloadObject,
    deleteObject,
    deleteOSBucket,
} from "@/features/os/actions";
import type { OsObjectInfo } from "@/types/nats";
import { toast } from "sonner";
import {
    ChevronLeft,
    RefreshCcw,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ObjectList } from "@/features/os/components/object-list";
import { ObjectPreviewSheet } from "@/features/os/components/object-preview-sheet";
import { UploadObjectDialog } from "@/features/os/components/upload-object-dialog";
import { useConfirm } from "@/components/providers/confirm-provider";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import Link from "next/link";

export function OSDetailView() {
    const { bucket } = useParams();
    const router = useRouter();
    const activeConnection = useActiveConnection();
    const confirm = useConfirm();

    const [objects, setObjects] = React.useState<OsObjectInfo[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [previewObject, setPreviewObject] = React.useState<OsObjectInfo | null>(null);
    const [previewOpen, setPreviewOpen] = React.useState(false);

    const fetchObjects = React.useCallback(async () => {
        if (!activeConnection || !bucket) return;

        setIsLoading(true);
        const result = await listObjects(activeConnection, bucket as string);
        if (result.success) {
            setObjects(result.data.objects || []);
        } else {
            toast.error("Failed to load objects", {
                description: result.error,
            });
        }
        setIsLoading(false);
    }, [activeConnection, bucket]);

    React.useEffect(() => {
        fetchObjects();
    }, [fetchObjects]);

    /** Download object as a browser file-save. */
    const handleDownload = async (name: string) => {
        if (!activeConnection || !bucket) return;

        toast.loading(`Downloading ${name}...`, { id: `dl-${name}` });

        const result = await downloadObject(activeConnection, bucket as string, name);
        if (result.success) {
            // Decode base64 → blob → trigger download
            const binaryString = atob(result.data.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                a.remove();
            }, 100);

            toast.success(`Downloaded ${name}`, { id: `dl-${name}` });
        } else {
            toast.error(`Failed to download ${name}`, { id: `dl-${name}` });
        }
    };

    /** Preview an object in the slide-in viewer. */
    const handlePreview = (name: string) => {
        const obj = objects.find((o) => o.name === name);
        if (obj) {
            setPreviewObject(obj);
            setPreviewOpen(true);
        }
    };

    /** Delete a single object. */
    const handleDeleteObject = async (name: string) => {
        if (!activeConnection || !bucket) return;
        const ok = await confirm({
            title: `Delete object "${name}"?`,
            description: "The object will be removed from this Object Store.",
            confirmText: "Delete Object",
        });
        if (!ok) return;

        const result = await deleteObject(activeConnection, bucket as string, name);
        if (result.success) {
            toast.success(`Object "${name}" deleted`);
            fetchObjects();
        } else {
            toast.error(`Failed to delete object: ${result.error}`);
        }
    };

    /** Delete the entire bucket. */
    const handleDeleteBucket = async () => {
        if (!activeConnection || !bucket) return;
        const ok = await confirm({
            title: `Delete bucket "${bucket}"?`,
            description: "All objects and their chunks will be permanently removed.",
            confirmText: "Delete Bucket",
            typedName: bucket as string,
        });
        if (!ok) return;

        const result = await deleteOSBucket(activeConnection, bucket as string);
        if (result.success) {
            toast.success("Bucket deleted");
            router.push("/os");
        } else {
            toast.error("Failed to delete bucket");
        }
    };

    if (!activeConnection) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                No active connection
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Link href="/os">
                            <ChevronLeft className="size-5" />
                        </Link>
                    </Button>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                {bucket}
                            </h1>
                            <Badge
                                variant="outline"
                                className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
                            >
                                Object Store
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <UploadObjectDialog
                        bucket={bucket as string}
                        onUploaded={fetchObjects}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchObjects}
                        className="bg-card border-border text-foreground/80"
                    >
                        <RefreshCcw
                            className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteBucket}
                    >
                        <Trash2 className="size-4 mr-2" />
                        Delete Bucket
                    </Button>
                </div>
            </div>

            {/* Object table */}
            {isLoading && objects.length === 0 ? (
                <DataTableSkeleton rows={6} columns={5} />
            ) : (
                <ObjectList
                    objects={objects}
                    onDownload={handleDownload}
                    onDelete={handleDeleteObject}
                    onPreview={handlePreview}
                />
            )}

            {/* Object preview sheet */}
            <ObjectPreviewSheet
                bucket={bucket as string}
                object={previewObject}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
            />
        </div>
    );
}
