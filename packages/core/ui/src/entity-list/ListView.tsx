"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@acme/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@acme/ui/table";

import type { ColumnDefinition, EntityAction, SortConfig } from "./types";

type LegacyCellRenderer<T extends Record<string, unknown>> = (context: {
  row: { original: T };
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

const renderCellValue = <T extends Record<string, unknown>>(
  column: ColumnDefinition<T>,
  row: T,
) => {
  if (!column.cell) {
    return column.accessorKey
      ? String(row[column.accessorKey as keyof T] ?? "")
      : "";
  }

  try {
    return (column.cell as (value: T) => React.ReactNode)(row);
  } catch (error) {
    if (shouldFallbackToLegacyRenderer(error)) {
      return (column.cell as LegacyCellRenderer<T>)({
        row: { original: row },
      });
    }
    throw error;
  }
};

export interface ListViewProps<T extends Record<string, unknown>> {
  /** Data to display in the table */
  data: T[];

  /** Column definitions */
  columns: ColumnDefinition<T>[];

  /** Optional handler for row clicks */
  onRowClick?: (item: T) => void;

  /** Actions that can be performed on each entity */
  entityActions?: EntityAction<T>[];

  /** Current sort configuration */
  sortConfig?: SortConfig;

  /** Handler for sort changes */
  onSortChange?: (sortConfig: SortConfig) => void;

  /** Whether to display a checkbox column for row selection */
  selectable?: boolean;

  /** Currently selected row IDs */
  selectedIds?: string[];

  /** Handler for selection changes */
  onSelectionChange?: (ids: string[]) => void;

  /** ID field in data items (for selection) */
  idField?: keyof T;
}

/**
 * ListView renders data in a table format with configurable columns, sorting, and row actions.
 *
 * @template T - The type of data items being displayed (must be an object)
 */
export function ListView<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  entityActions,
  sortConfig,
  onSortChange,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  idField = "id" as keyof T,
}: ListViewProps<T>) {
  // Memoize sorted data to prevent unnecessary recalculations
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const column = columns.find((col) => col.id === sortConfig.id);
      if (!column || !column.sortable || !column.accessorKey) {
        return 0;
      }

      const accessorKey = column.accessorKey as keyof T;

      const aValue = a[accessorKey];
      const bValue = b[accessorKey];

      if (aValue === bValue) return 0;

      // Handle different types of values
      const result =
        aValue === null || aValue === undefined
          ? -1
          : bValue === null || bValue === undefined
            ? 1
            : typeof aValue === "string"
              ? aValue.localeCompare(String(bValue))
              : Number(aValue) - Number(bValue);

      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [data, columns, sortConfig]);

  // Handle row selection toggle
  const handleSelectRow = (item: T) => {
    if (!onSelectionChange || !idField) return;

    const id = String(item[idField]);
    const newSelectedIds = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];

    onSelectionChange(newSelectedIds);
  };

  // Handle column header click for sorting
  const handleHeaderClick = (columnId: string) => {
    if (!onSortChange) return;

    const column = columns.find((col) => col.id === columnId);
    if (!column || !column.sortable) return;

    let direction: "asc" | "desc" = "asc";

    if (sortConfig?.id === columnId) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }

    onSortChange({ id: columnId, direction });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-[40px]">
                {/* Checkbox for "select all" functionality could be added here */}
              </TableHead>
            )}

            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={
                  column.sortable && onSortChange
                    ? "cursor-pointer select-none"
                    : ""
                }
                onClick={() => column.sortable && handleHeaderClick(column.id)}
              >
                <div className="flex items-center gap-1">
                  {column.header}

                  {column.sortable && sortConfig?.id === column.id && (
                    <span className="ml-1">
                      {sortConfig.direction === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}

            {entityActions && entityActions.length > 0 && (
              <TableHead className="text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={
                  columns.length +
                  (selectable ? 1 : 0) +
                  (entityActions && entityActions.length > 0 ? 1 : 0)
                }
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, index) => (
              <TableRow
                key={index}
                className={onRowClick ? "hover:bg-muted cursor-pointer" : ""}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <TableCell className="w-[40px] p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(row[idField]))}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectRow(row);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                )}

                {columns.map((column) => (
                  <TableCell key={column.id}>
                    {renderCellValue(column, row)}
                  </TableCell>
                ))}

                {entityActions && entityActions.length > 0 && (
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      {entityActions.map((action) => {
                        const isDisabled =
                          typeof action.isDisabled === "function"
                            ? action.isDisabled(row)
                            : action.isDisabled;
                        const resolvedVariant =
                          action.variant === "primary"
                            ? "default"
                            : (action.variant ?? "outline");

                        return (
                          <Button
                            key={action.id}
                            size="sm"
                            variant={resolvedVariant}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                            }}
                            disabled={isDisabled}
                          >
                            {action.icon && (
                              <span className="mr-1">{action.icon}</span>
                            )}
                            {typeof action.label === "function"
                              ? action.label(row)
                              : action.label}
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
