"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveConnection } from "@/hooks/use-active-connection";
import {
    listObjects,
    downloadObject,
    deleteObject,
    deleteOSBucket,
} from "@/app/actions/os-actions";
import type { OsObjectInfo } from "@/lib/nats/nats-types";
import { toast } from "sonner";
import {
    HardDrive,
    ChevronLeft,
    RefreshCcw,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ObjectList } from "@/components/os/object-list";
import { UploadObjectDialog } from "@/components/os/upload-object-dialog";
import Link from "next/link";

export default function OSDetailPage() {
    const { bucket } = useParams();
    const router = useRouter();
    const activeConnection = useActiveConnection();

    const [objects, setObjects] = React.useState<OsObjectInfo[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

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

    /** Delete a single object. */
    const handleDeleteObject = async (name: string) => {
        if (!activeConnection || !bucket) return;
        if (!confirm(`Delete object "${name}"?`)) return;

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
        if (!confirm(`Are you sure you want to delete the entire bucket "${bucket}"?`)) return;

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
            <div className="p-8 text-center text-slate-500">
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
                        className="text-slate-400 hover:text-slate-100"
                    >
                        <Link href="/os">
                            <ChevronLeft className="size-5" />
                        </Link>
                    </Button>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
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
                        className="bg-slate-900 border-slate-800 text-slate-300"
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
            <ObjectList
                objects={objects}
                onDownload={handleDownload}
                onDelete={handleDeleteObject}
            />
        </div>
    );
}
