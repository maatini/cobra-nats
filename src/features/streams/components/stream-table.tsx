"use client";

import * as React from "react";
import type { ConsumerStats } from "@/features/streams/actions";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
} from "@tanstack/react-table";
import type { StreamInfo } from "nats";
import {
    MoreHorizontal,
    Trash2,
    Eye,
    RefreshCcw,
    Layers,
    Search
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/use-url-state";

interface StreamTableProps {
    data: StreamInfo[];
    consumerStats?: Record<string, ConsumerStats>;
    onDelete: (name: string) => void;
    onRefresh: () => void;
    isLoading: boolean;
}

const URL_DEFAULTS = { q: "", sort: "", dir: "asc", page: 0 };

export function StreamTable({ data, consumerStats, onDelete, onRefresh, isLoading }: StreamTableProps) {
    const router = useRouter();
    const [urlState, setUrlState] = useUrlState(URL_DEFAULTS);
    const filter = urlState.q;
    const setFilter = (q: string) => setUrlState({ q, page: 0 });

    const sorting: SortingState = React.useMemo(
        () => (urlState.sort ? [{ id: urlState.sort, desc: urlState.dir === "desc" }] : []),
        [urlState.sort, urlState.dir]
    );
    const setSorting = (updater: SortingState | ((old: SortingState) => SortingState)) => {
        const next = typeof updater === "function" ? updater(sorting) : updater;
        const head = next[0];
        setUrlState({ sort: head?.id ?? "", dir: head?.desc ? "desc" : "asc" });
    };

    const filteredData = React.useMemo(() => {
        return data.filter((s) =>
            s.config.name.toLowerCase().includes(filter.toLowerCase()) ||
            s.config.subjects?.some(subj => subj.toLowerCase().includes(filter.toLowerCase()))
        );
    }, [data, filter]);

    const columns: ColumnDef<StreamInfo>[] = [
        {
            accessorKey: "config.name",
            header: "Name",
            cell: ({ row }) => {
                const name = row.original.config.name;
                return (
                    <div className="flex items-center gap-2">
                        <Layers className="size-4 text-amber-400" />
                        <span className="font-medium text-foreground">{name}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: "config.subjects",
            header: "Subjects",
            cell: ({ row }) => {
                const subjects = row.original.config.subjects || [];
                return (
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {subjects.slice(0, 2).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground">
                                {s}
                            </Badge>
                        ))}
                        {subjects.length > 2 && (
                            <Badge variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground">
                                +{subjects.length - 2}
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "state.messages",
            header: "Messages",
            cell: ({ row }) => (
                <span className="text-foreground/80 tabular-nums">
                    {row.original.state.messages.toLocaleString()}
                </span>
            ),
        },
        {
            id: "consumers",
            header: "Consumers",
            cell: ({ row }) => {
                const name = row.original.config.name;
                const stats = consumerStats?.[name];
                return (
                    <span className="text-muted-foreground tabular-nums">
                        {stats != null ? stats.consumers.toLocaleString() : "–"}
                    </span>
                );
            },
        },
        {
            id: "pending",
            header: "Pending",
            cell: ({ row }) => {
                const name = row.original.config.name;
                const stats = consumerStats?.[name];
                return (
                    <span className="text-muted-foreground tabular-nums">
                        {stats != null ? stats.pending.toLocaleString() : "–"}
                    </span>
                );
            },
        },
        {
            id: "ackPending",
            header: "Ack Pending",
            cell: ({ row }) => {
                const name = row.original.config.name;
                const stats = consumerStats?.[name];
                if (stats == null) return <span className="text-muted-foreground tabular-nums">–</span>;
                return (
                    <span className={cn(
                        "tabular-nums",
                        stats.ackPending > 0 ? "text-amber-400" : "text-muted-foreground"
                    )}>
                        {stats.ackPending.toLocaleString()}
                    </span>
                );
            },
        },
        {
            accessorKey: "state.bytes",
            header: "Size",
            cell: ({ row }) => {
                const bytes = row.original.state.bytes;
                const mb = bytes / (1024 * 1024);
                return (
                    <span className="text-muted-foreground tabular-nums text-xs">
                        {mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`}
                    </span>
                );
            },
        },
        {
            accessorKey: "state.first_ts",
            header: "Created",
            cell: ({ row }) => {
                try {
                    const date = new Date(row.original.created);
                    return (
                        <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(date, { addSuffix: true })}
                        </span>
                    );
                } catch {
                    return <span className="text-muted-foreground text-xs">--</span>;
                }
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const stream = row.original;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border text-foreground" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild className="focus:bg-indigo-600">
                                <Link href={`/streams/${stream.config.name}`} className="flex items-center gap-2 cursor-pointer">
                                    <Eye className="size-4" />
                                    View Details
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-muted" />
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onDelete(stream.config.name); }}
                                className="flex items-center gap-2 text-rose-500 focus:bg-rose-600 focus:text-white cursor-pointer"
                            >
                                <Trash2 className="size-4" />
                                Delete Stream
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: {
            sorting,
            pagination: { pageIndex: urlState.page, pageSize: 10 },
        },
        onPaginationChange: updater => {
            const next = typeof updater === "function"
                ? updater({ pageIndex: urlState.page, pageSize: 10 })
                : updater;
            setUrlState({ page: next.pageIndex });
        },
        manualPagination: false,
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search streams..."
                        className="pl-9 bg-card border-border focus:border-amber-500"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="bg-card border-border hover:bg-muted hover:text-amber-400"
                >
                    <RefreshCcw className={cn("size-4", isLoading && "animate-spin")} />
                </Button>
            </div>

            <div className="rounded-md border border-border bg-card/50 overflow-x-auto">
                <Table className="min-w-[720px]">
                    <TableHeader className="bg-card">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-border hover:bg-transparent">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="text-muted-foreground font-medium h-10">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    onClick={() => router.push(`/streams/${row.original.config.name}`)}
                                    className="border-border hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    {isLoading ? "Loading streams..." : "No streams found."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="bg-card border-border text-foreground/80"
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="bg-card border-border text-foreground/80"
                >
                    Next
                </Button>
            </div>
        </div>
    );
}

function cn(...inputs: (string | undefined | null | false)[]) {
    return inputs.filter(Boolean).join(" ");
}
