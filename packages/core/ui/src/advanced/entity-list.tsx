"use client";

import * as React from "react";

import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

import { Button } from "../button";
import { Card } from "../card";
import { Input } from "../input";
import { ScrollArea } from "../scroll-area";
import { cn } from "../lib/utils";

// Types
export type ViewMode = "list" | "grid";
export type SortDirection = "asc" | "desc";

export interface SortOption<T> {
  id: string;
  label: string;
  accessor: (item: T) => string | number | Date | boolean | null | undefined;
}

export interface FilterOption<T> {
  id: string;
  label: string;
  options: {
    id: string;
    label: string;
    value: unknown;
    getIsMatch: (item: T) => boolean;
  }[];
}

export interface EntityListProps<T> {
  items: T[];
  renderItem: (item: T, viewMode: ViewMode) => React.ReactNode;
  filterOptions?: FilterOption<T>[];
  sortOptions?: SortOption<T>[];
  defaultViewMode?: ViewMode;
  defaultSort?: {
    option: string;
    direction: SortDirection;
  };
  searchPlaceholder?: string;
  searchPredicate?: (item: T, searchValue: string) => boolean;
  emptyMessage?: string;
  gridClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  gridItemClassName?: string;
  listItemClassName?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  showViewModeToggle?: boolean;
  showSearch?: boolean;
  showSort?: boolean;
  showFilters?: boolean;
}

// Main component
export function EntityList<T>({
  items,
  renderItem,
  filterOptions = [],
  sortOptions = [],
  defaultViewMode = "grid",
  defaultSort,
  searchPlaceholder = "Search...",
  searchPredicate,
  emptyMessage = "No items found",
  gridClassName,
  listClassName,
  itemClassName,
  gridItemClassName,
  listItemClassName,
  isLoading = false,
  loadingMessage = "Loading...",
  showViewModeToggle = true,
  showSearch = true,
  showSort = true,
  showFilters = true,
}: EntityListProps<T>) {
  // State
  const [viewMode, setViewMode] = React.useState<ViewMode>(defaultViewMode);
  const [searchValue, setSearchValue] = React.useState<string>("");
  const [sortOption, setSortOption] = React.useState<string | null>(
    defaultSort?.option ?? null,
  );
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(
    defaultSort?.direction ?? "asc",
  );
  const [activeFilters, setActiveFilters] = React.useState<
    Record<string, Set<string>>
  >({});

  // Initialize active filters
  React.useEffect(() => {
    const initialFilters: Record<string, Set<string>> = {};
    filterOptions.forEach((filter) => {
      initialFilters[filter.id] = new Set();
    });
    setActiveFilters(initialFilters);
  }, [filterOptions]);

  // Toggle filter option
  const toggleFilter = (filterId: string, optionId: string) => {
    setActiveFilters((prev) => {
      const newFilters = { ...prev };
      const filterSet = new Set(newFilters[filterId]);

      if (filterSet.has(optionId)) {
        filterSet.delete(optionId);
      } else {
        filterSet.add(optionId);
      }

      newFilters[filterId] = filterSet;
      return newFilters;
    });
  };

  // Apply filters, search, and sorting
  const filteredAndSortedItems = React.useMemo(() => {
    // Start with all items
    let result = [...items];

    // Apply search if provided
    if (searchValue && searchPredicate) {
      result = result.filter((item) => searchPredicate(item, searchValue));
    }

    // Apply filters
    filterOptions.forEach((filter) => {
      const activeOptions = activeFilters[filter.id];
      if (activeOptions && activeOptions.size > 0) {
        result = result.filter((item) => {
          // At least one of the filter options must match
          return filter.options.some(
            (option) => activeOptions.has(option.id) && option.getIsMatch(item),
          );
        });
      }
    });

    // Apply sorting
    if (sortOption) {
      const sortOpt = sortOptions.find((opt) => opt.id === sortOption);
      if (sortOpt) {
        result.sort((a, b) => {
          const aValue = sortOpt.accessor(a);
          const bValue = sortOpt.accessor(b);

          // Handle null/undefined values
          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return sortDirection === "asc" ? -1 : 1;
          if (bValue == null) return sortDirection === "asc" ? 1 : -1;

          // Compare based on value type
          if (aValue instanceof Date && bValue instanceof Date) {
            return sortDirection === "asc"
              ? aValue.getTime() - bValue.getTime()
              : bValue.getTime() - aValue.getTime();
          }

          if (typeof aValue === "string" && typeof bValue === "string") {
            return sortDirection === "asc"
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }

          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
          }

          if (typeof aValue === "boolean" && typeof bValue === "boolean") {
            return sortDirection === "asc"
              ? (aValue ? 1 : 0) - (bValue ? 1 : 0)
              : (bValue ? 1 : 0) - (aValue ? 1 : 0);
          }

          // Fallback for mixed types
          const aStr = String(aValue);
          const bStr = String(bValue);
          return sortDirection === "asc"
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        });
      }
    }

    return result;
  }, [
    items,
    searchValue,
    searchPredicate,
    activeFilters,
    sortOption,
    sortDirection,
    filterOptions,
    sortOptions,
  ]);

  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  // Clear all active filters
  const clearFilters = () => {
    const clearedFilters: Record<string, Set<string>> = {};
    filterOptions.forEach((filter) => {
      clearedFilters[filter.id] = new Set();
    });
    setActiveFilters(clearedFilters);
  };

  // Calculate total active filters count
  const activeFiltersCount = Object.values(activeFilters).reduce(
    (count, filterSet) => count + filterSet.size,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        {showSearch && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-8"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Filters */}
          {showFilters && filterOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  Filter
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Filter By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-80">
                  {filterOptions.map((filter) => (
                    <React.Fragment key={filter.id}>
                      <DropdownMenuLabel className="font-bold">
                        {filter.label}
                      </DropdownMenuLabel>
                      {filter.options.map((option) => (
                        <DropdownMenuCheckboxItem
                          key={option.id}
                          checked={activeFilters[filter.id]?.has(option.id)}
                          onCheckedChange={() =>
                            toggleFilter(filter.id, option.id)
                          }
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                    </React.Fragment>
                  ))}
                </ScrollArea>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort */}
          {showSort && sortOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  Sort
                  {sortOption && (
                    <>
                      :{" "}
                      {sortOptions.find((opt) => opt.id === sortOption)?.label}
                      {sortDirection === "asc" ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </>
                  )}
                  {!sortOption && <ChevronsUpDown className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sortOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.id}
                    checked={sortOption === option.id}
                    onCheckedChange={() => {
                      if (sortOption !== option.id) {
                        setSortOption(option.id);
                      } else {
                        toggleSortDirection();
                      }
                    }}
                  >
                    {option.label}
                    {sortOption === option.id && (
                      <span className="ml-2">
                        {sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* View Mode */}
          {showViewModeToggle && (
            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              className="h-8"
            >
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="h-7 px-3">
                  Grid
                </TabsTrigger>
                <TabsTrigger value="list" className="h-7 px-3">
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      {/* List/Grid Content */}
      {isLoading ? (
        <Card className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">{loadingMessage}</p>
        </Card>
      ) : filteredAndSortedItems.length === 0 ? (
        <Card className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </Card>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              : "flex flex-col space-y-2",
            viewMode === "grid" ? gridClassName : listClassName,
          )}
        >
          {filteredAndSortedItems.map((item, index) => (
            <div
              key={index}
              className={cn(
                itemClassName,
                viewMode === "grid" ? gridItemClassName : listItemClassName,
              )}
            >
              {renderItem(item, viewMode)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
