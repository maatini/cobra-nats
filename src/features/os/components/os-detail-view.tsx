"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useActiveConnection } from "@/features/connections/hooks";
import {
    listObjects,
    deleteObject,
    deleteOSBucket,
    sealOSBucket,
    getOSBucket,
} from "@/features/os/actions";
import type { OsObjectInfo } from "@/types/nats";
import { toast } from "sonner";
import {
    ChevronLeft,
    RefreshCcw,
    Trash2,
    Lock,
    FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    const [sealed, setSealed] = React.useState(false);
    /** Prefix path segments for folder-style browse (joined with /). */
    const [prefixParts, setPrefixParts] = React.useState<string[]>([]);
    const [prefixFilter, setPrefixFilter] = React.useState("");

    const fetchObjects = React.useCallback(async () => {
        if (!activeConnection || !bucket) return;

        setIsLoading(true);
        const [objectsResult, bucketResult] = await Promise.all([
            listObjects(activeConnection, bucket as string),
            getOSBucket(activeConnection, bucket as string),
        ]);
        if (objectsResult.success) {
            setObjects(objectsResult.data.objects || []);
        } else {
            toast.error("Failed to load objects", {
                description: objectsResult.error,
            });
        }
        if (bucketResult.success) {
            setSealed(bucketResult.data.sealed);
        }
        setIsLoading(false);
    }, [activeConnection, bucket]);

    React.useEffect(() => {
        fetchObjects();
    }, [fetchObjects]);

    /** Stream download via POST /api/os/download (avoids base64 in memory). */
    const handleDownload = async (name: string) => {
        if (!activeConnection || !bucket) return;

        toast.loading(`Downloading ${name}...`, { id: `dl-${name}` });

        try {
            const res = await fetch("/api/os/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    config: activeConnection,
                    bucket,
                    name,
                }),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "Download failed");
                toast.error(`Failed to download ${name}`, {
                    id: `dl-${name}`,
                    description: text,
                });
                return;
            }

            const blob = await res.blob();
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
        } catch (err: unknown) {
            toast.error(`Failed to download ${name}`, {
                id: `dl-${name}`,
                description: err instanceof Error ? err.message : String(err),
            });
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

    /** Seal the bucket (irreversible read-only). */
    const handleSealBucket = async () => {
        if (!activeConnection || !bucket) return;
        const ok = await confirm({
            title: `Seal bucket "${bucket}"?`,
            description: "Sealing is irreversible. No further uploads or deletes will be allowed.",
            confirmText: "Seal Bucket",
            typedName: bucket as string,
        });
        if (!ok) return;

        const result = await sealOSBucket(activeConnection, bucket as string);
        if (result.success) {
            toast.success(`Bucket "${bucket}" sealed`);
            setSealed(true);
            fetchObjects();
        } else {
            toast.error("Failed to seal bucket", { description: result.error });
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
                            {sealed && (
                                <Badge
                                    variant="outline"
                                    className="bg-amber-500/10 text-amber-500 border-amber-500/20"
                                >
                                    Sealed
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!sealed && (
                        <UploadObjectDialog
                            bucket={bucket as string}
                            onUploaded={fetchObjects}
                        />
                    )}
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
                    {!sealed && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSealBucket}
                            className="bg-card border-border text-amber-500 hover:text-amber-400"
                        >
                            <Lock className="size-4 mr-2" />
                            Seal
                        </Button>
                    )}
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

            {/* Prefix / folder browse */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1 text-xs font-mono text-muted-foreground">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                        onClick={() => {
                            setPrefixParts([]);
                            setPrefixFilter("");
                        }}
                    >
                        <FolderOpen className="size-3.5" />
                        /
                    </button>
                    {prefixParts.map((part, i) => (
                        <React.Fragment key={`${part}-${i}`}>
                            <span className="text-muted-foreground/50">/</span>
                            <button
                                type="button"
                                className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                                onClick={() => {
                                    const next = prefixParts.slice(0, i + 1);
                                    setPrefixParts(next);
                                    setPrefixFilter(next.join("/") + "/");
                                }}
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
                <Input
                    value={prefixFilter}
                    onChange={(e) => {
                        const v = e.target.value;
                        setPrefixFilter(v);
                        const cleaned = v.replace(/^\/+|\/+$/g, "");
                        setPrefixParts(cleaned ? cleaned.split("/").filter(Boolean) : []);
                    }}
                    placeholder="Filter by prefix (e.g. logs/2024/)"
                    className="sm:max-w-xs h-8 bg-card border-border font-mono text-xs"
                />
            </div>

            {/* Object table */}
            {isLoading && objects.length === 0 ? (
                <DataTableSkeleton rows={6} columns={5} />
            ) : (
                <ObjectList
                    objects={objects}
                    prefix={prefixFilter}
                    onEnterPrefix={(p) => {
                        setPrefixFilter(p.endsWith("/") ? p : `${p}/`);
                        setPrefixParts(
                            p
                                .replace(/\/+$/, "")
                                .split("/")
                                .filter(Boolean)
                        );
                    }}
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
