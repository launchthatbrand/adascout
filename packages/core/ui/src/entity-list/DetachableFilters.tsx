"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@acme/ui/command";
import { Input } from "@acme/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";

import type { FilterConfig, FilterValue } from "./types";

interface DetachableFiltersProps<T> {
  /** Filter configurations */
  filters: FilterConfig<T>[];

  /** Currently active filters */
  activeFilters: Record<string, FilterValue>;

  /** Handler for filter changes */
  onFilterChange: (filters: Record<string, FilterValue>) => void;

  /** Optional CSS class name */
  className?: string;
}

/**
 * A detachable version of EntityListFilters that can be used anywhere in the application
 * with the same filter configurations
 */
export function DetachableFilters<T>({
  filters,
  activeFilters,
  onFilterChange,
  className = "",
}: DetachableFiltersProps<T>) {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Helper to determine which filters are currently active
  const isFilterActive = (filter: FilterConfig<T>) => {
    return activeFilters[filter.id] !== undefined;
  };

  // Get list of available filters (not yet applied)
  const availableFilters = filters.filter((filter) => !isFilterActive(filter));

  // Handle removing a filter
  const handleRemoveFilter = (filterId: string) => {
    const newFilters = { ...activeFilters };
    delete newFilters[filterId];
    onFilterChange(newFilters);
  };

  // Handle changing a filter value
  const handleFilterValueChange = (filterId: string, value: FilterValue) => {
    // If the value is null or undefined, remove the filter
    if (value === null || value === undefined || value === "") {
      handleRemoveFilter(filterId);
      return;
    }

    // Otherwise update the filter value
    onFilterChange({
      ...activeFilters,
      [filterId]: value,
    });
  };

  // Format filter value for display
  const formatFilterValue = (filter: FilterConfig<T>, value: FilterValue) => {
    if (filter.type === "select" && filter.options) {
      const option = filter.options.find((opt) => opt.value === value);
      return option?.label ?? String(value);
    }
    return String(value);
  };

  // Render active filters as badges
  const renderActiveFilters = () => {
    return Object.entries(activeFilters).map(([filterId, value]) => {
      const filter = filters.find((f) => f.id === filterId);
      if (!filter) return null;

      return (
        <Badge
          key={filterId}
          variant="outline"
          className="flex items-center gap-1"
        >
          <span className="font-semibold">{filter.label}:</span>
          <span>{formatFilterValue(filter, value)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-auto p-0"
            onClick={() => handleRemoveFilter(filterId)}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove filter</span>
          </Button>
        </Badge>
      );
    });
  };

  // Render filter selector for a specific filter
  const renderFilterSelector = (filter: FilterConfig<T>) => {
    const value = activeFilters[filter.id];

    switch (filter.type) {
      case "text":
        return (
          <div className="grid gap-2">
            <Input
              placeholder={`Filter by ${filter.label.toLowerCase()}`}
              value={(value as string) ?? ""}
              onChange={(e) =>
                handleFilterValueChange(filter.id, e.target.value)
              }
              className="h-8"
            />
          </div>
        );
      case "select":
        return (
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-between px-3 py-1 text-sm"
                >
                  {value !== undefined
                    ? formatFilterValue(filter, value)
                    : `Select ${filter.label.toLowerCase()}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={`Search ${filter.label.toLowerCase()}...`}
                  />
                  <CommandEmpty>No results found</CommandEmpty>
                  <CommandGroup>
                    {filter.options?.map((option) => (
                      <CommandItem
                        key={String(option.value)}
                        onSelect={() => {
                          handleFilterValueChange(filter.id, option.value);
                        }}
                      >
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        );
      case "boolean":
        return (
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-between px-3 py-1 text-sm"
                >
                  {value !== undefined
                    ? value
                      ? "True"
                      : "False"
                    : `Select ${filter.label.toLowerCase()}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleFilterValueChange(filter.id, true)}
                    >
                      True
                    </CommandItem>
                    <CommandItem
                      onSelect={() => handleFilterValueChange(filter.id, false)}
                    >
                      False
                    </CommandItem>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        );
      // Add more filter types as needed
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Render active filters as badges */}
        {renderActiveFilters()}

        {/* Add filter button */}
        {availableFilters.length > 0 && (
          <Popover open={isFilterMenuOpen} onOpenChange={setIsFilterMenuOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Command>
                <CommandInput placeholder="Search filters..." />
                <CommandEmpty>No filters found</CommandEmpty>
                <CommandGroup>
                  {availableFilters.map((filter) => (
                    <CommandItem
                      key={filter.id}
                      onSelect={() => {
                        // For select filters, don't close the menu yet
                        if (filter.type !== "select") {
                          setIsFilterMenuOpen(false);
                        }

                        // For text filters, set an empty string as initial value
                        if (filter.type === "text") {
                          handleFilterValueChange(filter.id, "");
                        } else if (filter.type === "select") {
                          const firstOption = filter.options?.[0];
                          if (firstOption) {
                            handleFilterValueChange(
                              filter.id,
                              firstOption.value,
                            );
                          }
                        }
                      }}
                    >
                      {filter.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear all filters button */}
        {Object.keys(activeFilters).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange({})}
            className="h-8 px-2 text-xs"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Render inputs for active filters */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(activeFilters).map(([filterId]) => {
          const filter = filters.find((f) => f.id === filterId);
          if (!filter) return null;

          return (
            <div key={filterId} className="flex items-center gap-2">
              <span className="text-sm font-medium">{filter.label}:</span>
              {renderFilterSelector(filter)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
