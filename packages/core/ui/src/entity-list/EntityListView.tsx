"use client";

import * as React from "react";

import type {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import type { ColumnDefinition, EntityListViewProps } from "./types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@launchthatapp/ui/table";
import {
  Table as TanstackTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { ArrowUpDown } from "lucide-react";
import { Button } from "@launchthatapp/ui/button";
import { Checkbox } from "@launchthatapp/ui/checkbox";
import { EmptyState } from "./EmptyState";
import { GridView } from "./GridView";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@launchthatapp/ui/skeleton";

type LegacyCellRenderer<T extends Record<string, unknown>> = (context: {
  row: Row<T>;
}) => React.ReactNode;

const shouldFallbackToLegacyRenderer = (error: unknown) => {
  if (!(error instanceof TypeError)) return false;
  const message = error.message ?? "";
  if (typeof message !== "string") return false;
  return (
    message.includes("reading 'original'") ||
    message.includes("reading 'row'") ||
    message.includes("Cannot destructure property 'row'")
  );
};

const renderCellWithFallback = <T extends Record<string, unknown>>(
  cell: ColumnDefinition<T>["cell"],
  row: Row<T>,
) => {
  if (!cell) return undefined;
  try {
    return (cell as (item: T) => React.ReactNode)(row.original as T);
  } catch (error) {
    if (shouldFallbackToLegacyRenderer(error)) {
      return (cell as LegacyCellRenderer<T>)({ row });
    }
    throw error;
  }
};

export function EntityListView<T extends Record<string, unknown>>({
  data,
  columns,
  viewMode,
  isLoading,
  onRowClick,
  gridColumns,
  selectedId,
  emptyState,
  entityActions,
  enableFooter = true,
  sortConfig,
  onSortChange,
  itemRender,
  enableRowSelection = false,
  enableVirtualization = false,
  virtualRowHeight = 72,
  virtualOverscan = 8,
  getRowId,
  bulkActions,
  initialPageSize = 20,
  showRowCount = false,
}: EntityListViewProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const virtualScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [virtualScrollTop, setVirtualScrollTop] = React.useState(0);
  const [virtualViewportHeight, setVirtualViewportHeight] = React.useState(0);

  // Use ColumnDef directly and add actions column if needed
  const tableColumns: ColumnDef<T>[] = React.useMemo(() => {
    const cols: ColumnDef<T>[] = columns.map((column) => {
      const baseColumn: ColumnDef<T> = {
        id: column.id,
        header: ({ column: tanstackColumn }) => {
          if (!column.sortable) return column.header;

          return (
            <Button
              variant="ghost"
              className="-ml-3 h-8 px-2"
              onClick={() =>
                tanstackColumn.toggleSorting(
                  tanstackColumn.getIsSorted() === "asc",
                )
              }
            >
              <span>{column.header}</span>
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        enableSorting: column.sortable ?? false,
        cell: column.cell
          ? ({ row }) => renderCellWithFallback(column.cell, row)
          : column.accessorKey
            ? ({ row }) =>
              String(row.original[column.accessorKey as keyof T] ?? "")
            : undefined,
      };

      if (column.accessorKey) {
        return {
          ...baseColumn,
          accessorKey: column.accessorKey as string,
        };
      }

      return baseColumn;
    });

    if (enableRowSelection) {
      cols.unshift({
        id: "select",
        header: ({ table }) => (
          <div
            className="flex items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
              className="border-black rounded-sm!"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="border-black rounded-sm!"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      });
    }

    // Add actions column if entityActions exist
    if (entityActions && entityActions.length > 0) {
      cols.push({
        id: "actions",
        header: () => <div className="pr-8 text-right">Actions</div>,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 pr-8">
            {entityActions.map((action, index) => (
              <button
                key={index}
                onClick={() => action.onClick(row.original)}
                className="rounded p-1 hover:bg-gray-100"
                title={
                  typeof action.label === "function"
                    ? action.label(row.original)
                    : action.label
                }
              >
                {action.icon}
              </button>
            ))}
          </div>
        ),
      });
    }

    return cols;
  }, [columns, enableRowSelection, entityActions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enableFooter ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    getRowId: (row) =>
      typeof getRowId === "function"
        ? getRowId(row)
        : "id" in row
          ? String((row as unknown as { id: unknown }).id)
          : JSON.stringify(row),
    initialState: enableFooter
      ? {
        pagination: {
          pageSize: initialPageSize,
        },
      }
      : undefined,
    enableRowSelection,
  });

  const selectedItems = React.useMemo(() => {
    if (!enableRowSelection) return [];
    return table.getSelectedRowModel().rows.map((row) => row.original);
  }, [enableRowSelection, table, rowSelection]);

  React.useEffect(() => {
    if (!enableVirtualization || viewMode !== "list") return;
    const element = virtualScrollRef.current;
    if (!element) return;

    const updateViewport = () => {
      setVirtualViewportHeight(element.clientHeight);
    };

    updateViewport();
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [enableVirtualization, viewMode]);

  if (isLoading) {
    return (
      <div className="min-w-0 w-full max-w-full">
        {viewMode === "list" ? (
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-md border">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  {enableRowSelection ? (
                    <TableHead className="w-11">
                      <Skeleton className="h-4 w-4" />
                    </TableHead>
                  ) : null}
                  {columns.map((column, index) => (
                    <TableHead key={column.id ?? index}>
                      <Skeleton className="h-4 w-full" />
                    </TableHead>
                  ))}
                  {entityActions && entityActions.length > 0 && (
                    <TableHead>
                      <Skeleton className="h-4 w-16" />
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((column, index) => (
                      <TableCell key={column.id ?? index}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                    {entityActions && entityActions.length > 0 && (
                      <TableCell>
                        <Skeleton className="h-6 w-24" />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 shadow-sm">
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-4">
        {emptyState ?? (
          <EmptyState
            icon={<Loader2 className="text-muted-foreground h-10 w-10" />}
            title="No items found"
            description="Try adjusting your search or filters."
          />
        )}
      </div>
    );
  }

  if (viewMode === "list") {
    const tableRows = table.getRowModel().rows;
    const useVirtualRows = enableVirtualization && tableRows.length > 100;
    const safeRowHeight = Math.max(virtualRowHeight, 36);
    const safeOverscan = Math.max(virtualOverscan, 2);
    const viewportHeight =
      virtualViewportHeight > 0 ? virtualViewportHeight : safeRowHeight * 10;
    const startIndex = useVirtualRows
      ? Math.max(Math.floor(virtualScrollTop / safeRowHeight) - safeOverscan, 0)
      : 0;
    const visibleRowCount = useVirtualRows
      ? Math.ceil(viewportHeight / safeRowHeight) + safeOverscan * 2
      : tableRows.length;
    const endIndex = useVirtualRows
      ? Math.min(startIndex + visibleRowCount, tableRows.length)
      : tableRows.length;
    const visibleRows = useVirtualRows
      ? tableRows.slice(startIndex, endIndex)
      : tableRows;
    const topSpacerHeight = useVirtualRows ? startIndex * safeRowHeight : 0;
    const bottomSpacerHeight = useVirtualRows
      ? Math.max(tableRows.length - endIndex, 0) * safeRowHeight
      : 0;

    const totalRows = table.getFilteredRowModel().rows.length;
    const pageRows = enableFooter ? table.getRowModel().rows.length : totalRows;

    return (
      <div className="min-w-0 w-full max-w-full">
        {showRowCount ? (
          <p className="text-muted-foreground mb-1.5 text-xs">
            {enableFooter && pageRows < totalRows
              ? `Showing ${pageRows} of ${totalRows} records`
              : `${totalRows} record${totalRows === 1 ? "" : "s"}`}
          </p>
        ) : null}
        {enableRowSelection && selectedItems.length > 0 && bulkActions ? (
          <div className="bg-muted/40 border-input mb-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            {bulkActions({
              selectedItems,
              clearSelection: () => table.resetRowSelection(),
            })}
          </div>
        ) : null}
        <div
          ref={virtualScrollRef}
          className="w-full max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain rounded-md border touch-pan-x [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:overflow-auto md:overscroll-y-contain"
          onScroll={(event) => {
            if (!useVirtualRows) return;
            setVirtualScrollTop(event.currentTarget.scrollTop);
          }}
        >
          <Table className="min-w-max" containerClassName="overflow-visible">
            <TableHeader className="bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, headerIndex) => {
                    const isLastHeader =
                      headerIndex === headerGroup.headers.length - 1;
                    return (
                      <TableHead
                        key={header.id}
                        className={`bg-background supports-backdrop-filter:bg-background/95 border-border/40 sticky top-0 z-20 shadow-[0_2px_6px_-6px_rgba(0,0,0,0.25)] ${isLastHeader ? "" : "border-r"
                          }`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tableRows?.length ? (
                <>
                  {useVirtualRows && topSpacerHeight > 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={tableColumns.length}
                        style={{ height: `${topSpacerHeight}px`, padding: 0 }}
                      />
                    </TableRow>
                  ) : null}
                  {visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={onRowClick ? "cursor-pointer" : ""}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell, cellIndex) => {
                        const isLastCell =
                          cellIndex === row.getVisibleCells().length - 1;
                        return (
                          <TableCell
                            key={cell.id}
                            className={`border-border/30 ${isLastCell ? "" : "border-r"}`}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {useVirtualRows && bottomSpacerHeight > 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={tableColumns.length}
                        style={{
                          height: `${bottomSpacerHeight}px`,
                          padding: 0,
                        }}
                      />
                    </TableRow>
                  ) : null}
                </>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {enableFooter && <EntityListFooter table={table} />}
        {showRowCount && !enableFooter ? (
          <p className="text-muted-foreground mt-1.5 text-xs">
            {totalRows} record{totalRows === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <GridView
      data={data}
      columns={columns}
      onCardClick={onRowClick}
      selectedIds={selectedId ? [selectedId] : []}
      entityActions={entityActions}
      cardRenderer={itemRender}
      gridColumns={gridColumns}
    />
  );
}

export const EntityListFooter = <T extends Record<string, unknown>>({
  table,
}: {
  table: TanstackTable<T>;
}) => {
  return (
    <div className="flex items-center justify-end space-x-2 py-4">
      <div className="text-muted-foreground flex-1 text-sm">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
