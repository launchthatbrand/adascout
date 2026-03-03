"use client";

import type { MouseEvent, ReactElement } from "react";
import { cloneElement, isValidElement, useMemo } from "react";

import { Button } from "@acme/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@acme/ui/card";
import { Checkbox } from "@acme/ui/checkbox";

import type { ColumnDefinition, EntityAction } from "./types";

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

export interface GridViewProps<T extends Record<string, unknown>> {
  data: T[];
  columns: ColumnDefinition<T>[];
  onCardClick?: (item: T) => void;
  entityActions?: EntityAction<T>[];
  gridColumns?: { sm?: number; md?: number; lg?: number; xl?: number };
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  idField?: keyof T;
  cardRenderer?: (item: T) => React.ReactNode;
}

function renderCellValue<T extends Record<string, unknown>>(
  column: ColumnDefinition<T>,
  item: T,
) {
  if (column.cell) {
    try {
      return (column.cell as (value: T) => React.ReactNode)(item);
    } catch (error) {
      if (shouldFallbackToLegacyRenderer(error)) {
        return (column.cell as LegacyCellRenderer<T>)({
          row: { original: item },
        });
      }
      throw error;
    }
  }
  const key = column.accessorKey;
  return key ? String(item[key] ?? "") : "";
}

export function GridView<T extends Record<string, unknown>>({
  data,
  columns,
  onCardClick,
  entityActions,
  gridColumns = { sm: 1, md: 2, lg: 3, xl: 4 },
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  idField = "id" as keyof T,
  cardRenderer,
}: GridViewProps<T>) {
  const gridClasses = useMemo(() => {
    const classes = ["grid", "gap-4"];
    classes.push(`grid-cols-1`);
    if (gridColumns.sm) classes.push(`sm:grid-cols-${gridColumns.sm}`);
    if (gridColumns.md) classes.push(`md:grid-cols-${gridColumns.md}`);
    if (gridColumns.lg) classes.push(`lg:grid-cols-${gridColumns.lg}`);
    if (gridColumns.xl) classes.push(`xl:grid-cols-${gridColumns.xl}`);
    return classes.join(" ");
  }, [gridColumns]);

  const handleSelectCard = (item: T) => {
    if (!onSelectionChange || !idField) return;
    const id = String(item[idField]);
    const newSelectedIds = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelectedIds);
  };

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No items found
      </div>
    );
  }

  return (
    <div className={gridClasses}>
      {data.map((item, index) => {
        if (cardRenderer) {
          const renderedCard = cardRenderer(item);

          if (isValidElement(renderedCard)) {
            const cardElement = renderedCard as ReactElement<{
              onClick?: (event: MouseEvent) => void;
            }>;
            const existingOnClick = cardElement.props.onClick;

            const mergedOnClick = (event: MouseEvent) => {
              existingOnClick?.(event);
              if (!event.defaultPrevented && onCardClick) {
                onCardClick(item);
              }
            };

            const elementProps: Record<string, unknown> = {
              key: cardElement.key ?? `card-${index}`,
            };

            if (onCardClick) {
              elementProps.onClick = mergedOnClick;
            }

            return cloneElement(cardElement, elementProps);
          }

          return (
            <div
              key={`card-${index}`}
              onClick={() => onCardClick && onCardClick(item)}
              className={onCardClick ? "cursor-pointer" : ""}
            >
              {renderedCard}
            </div>
          );
        }
        return (
          <Card
            key={index}
            className={
              onCardClick
                ? "cursor-pointer transition-shadow hover:shadow-md"
                : ""
            }
            onClick={() => onCardClick && onCardClick(item)}
          >
            {selectable && (
              <div className="absolute top-2 right-2 z-10">
                <Checkbox
                  checked={selectedIds.includes(String(item[idField]))}
                  onCheckedChange={() => handleSelectCard(item)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select item"
                />
              </div>
            )}

            <CardHeader className="pb-2">
              {columns[0] && (
                <h3 className="text-lg font-semibold">
                  {renderCellValue(columns[0], item)}
                </h3>
              )}
            </CardHeader>

            <CardContent className="space-y-2 pb-4">
              {columns.slice(1).map((column) => (
                <div key={column.id as string}>
                  <div className="text-muted-foreground text-sm font-medium">
                    {typeof column.header === "string"
                      ? column.header
                      : String(
                          (column.id as string) ??
                            (column as { accessorKey?: string }).accessorKey ??
                            "",
                        )}
                  </div>
                  <div>{renderCellValue(column, item)}</div>
                </div>
              ))}
            </CardContent>

            {entityActions && entityActions.length > 0 && (
              <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
                {entityActions.map((action) => {
                  const isDisabled =
                    typeof action.isDisabled === "function"
                      ? action.isDisabled(item)
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
                        action.onClick(item);
                      }}
                      disabled={isDisabled}
                    >
                      {action.icon && (
                        <span className="mr-1">{action.icon}</span>
                      )}
                      {typeof action.label === "function"
                        ? action.label(item)
                        : action.label}
                    </Button>
                  );
                })}
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>
  );
}
