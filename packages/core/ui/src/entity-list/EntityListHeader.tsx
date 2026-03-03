"use client";

import { LayoutGrid, List, Rows } from "lucide-react";

import { Button } from "@acme/ui/button";
import type { EntityListHeaderProps } from "./types";
import { Search } from "./Search";
import { cn } from "@acme/ui";

export function EntityListHeader({
  title,
  description,
  searchTerm,
  onSearchChange,
  viewMode,
  viewModes,
  onViewModeChange,
  actions,
  isSearching,
  enableSearch,
  customViewLabel,
}: EntityListHeaderProps) {
  const availableModes = [
    viewModes.includes("list") ? ("list" as const) : null,
    viewModes.includes("grid") ? ("grid" as const) : null,
    viewModes.includes("custom") ? ("custom" as const) : null,
  ].filter(Boolean) as Array<"list" | "grid" | "custom">;

  return (
    <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
      <div>
        {title && <h2 className="text-xl font-bold tracking-tight">{title}</h2>}
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>

      <div className={cn("flex flex-1 flex-col items-end space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-end gap-3 md:items-center")}>
        {enableSearch && (
          <Search
            value={searchTerm}
            onChange={onSearchChange}
            isSearching={isSearching}
            placeholder="Search..."
            className="w-full md:max-w-xs"
          />
        )}
        <div className="flex items-center space-x-2">

          {availableModes.length >= 1 && (
            <div className="flex rounded-md border">
              {availableModes.map((mode, index) => {
                const isFirst = index === 0;
                const isLast = index === availableModes.length - 1;
                const shapeClass = isFirst
                  ? "rounded-none rounded-l-md"
                  : isLast
                    ? "rounded-none rounded-r-md"
                    : "rounded-none";

                if (mode === "list") {
                  return (
                    <Button
                      key="list"
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      className={shapeClass}
                      onClick={() => onViewModeChange("list")}
                    >
                      <List className="h-4 w-4" />
                      <span className="sr-only">List view</span>
                    </Button>
                  );
                }

                if (mode === "grid") {
                  return (
                    <Button
                      key="grid"
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      className={shapeClass}
                      onClick={() => onViewModeChange("grid")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      <span className="sr-only">Grid view</span>
                    </Button>
                  );
                }

                return (
                  <Button
                    key="custom"
                    variant={viewMode === "custom" ? "default" : "ghost"}
                    size="sm"
                    className={shapeClass}
                    onClick={() => onViewModeChange("custom")}
                    title={customViewLabel ?? "Custom view"}
                  >
                    <Rows className="h-4 w-4" />
                    <span className="sr-only">
                      {customViewLabel ?? "Custom view"}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}

          {actions && (
            <div className="flex items-center space-x-2">{actions}</div>
          )}
        </div>
      </div>
    </div>
  );
}
