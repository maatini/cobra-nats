"use client";

import * as React from "react";
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

interface StreamTableProps {
    data: StreamInfo[];
    onDelete: (name: string) => void;
    onRefresh: () => void;
    isLoading: boolean;
}

export function StreamTable({ data, onDelete, onRefresh, isLoading }: StreamTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [filter, setFilter] = React.useState("");

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
                        <span className="font-medium text-slate-200">{name}</span>
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
                            <Badge key={s} variant="outline" className="text-[10px] bg-slate-800 border-slate-700 text-slate-400">
                                {s}
                            </Badge>
                        ))}
                        {subjects.length > 2 && (
                            <Badge variant="outline" className="text-[10px] bg-slate-800 border-slate-700 text-slate-500">
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
                <span className="text-slate-300 tabular-nums">
                    {row.original.state.messages.toLocaleString()}
                </span>
            ),
        },
        {
            accessorKey: "state.bytes",
            header: "Size",
            cell: ({ row }) => {
                const bytes = row.original.state.bytes;
                const mb = bytes / (1024 * 1024);
                return (
                    <span className="text-slate-400 tabular-nums text-xs">
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
                        <span className="text-slate-500 text-xs">
                            {formatDistanceToNow(date, { addSuffix: true })}
                        </span>
                    );
                } catch {
                    return <span className="text-slate-500 text-xs">--</span>;
                }
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const stream = row.original;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-200">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild className="focus:bg-indigo-600">
                                <Link href={`/streams/${stream.config.name}`} className="flex items-center gap-2 cursor-pointer">
                                    <Eye className="size-4" />
                                    View Details
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-800" />
                            <DropdownMenuItem
                                onClick={() => onDelete(stream.config.name)}
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
        },
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Search streams..."
                        className="pl-9 bg-slate-900 border-slate-800 focus:border-amber-500"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="bg-slate-900 border-slate-800 hover:bg-slate-800 hover:text-amber-400"
                >
                    <RefreshCcw className={cn("size-4", isLoading && "animate-spin")} />
                </Button>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-900/50">
                <Table>
                    <TableHeader className="bg-slate-900">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-slate-800 hover:bg-transparent">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="text-slate-400 font-medium h-10">
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
                                    className="border-slate-800 hover:bg-slate-800/50 transition-colors"
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
                                <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">
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
                    className="bg-slate-900 border-slate-800 text-slate-300"
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="bg-slate-900 border-slate-800 text-slate-300"
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
