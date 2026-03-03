"use client";

import { X } from "lucide-react";

import { Button } from "@acme/ui/button";

import { FilterChip } from "./FilterChip";

export interface FilterItem {
  /** Unique identifier for the filter */
  id: string;

  /** Display label for the filter */
  label: string;

  /** Display value for the filter */
  value: string;
}

export interface FilterBarProps {
  /** Array of active filters */
  filters: FilterItem[];

  /** Callback when a filter is removed */
  onFilterRemove: (filterId: string) => void;

  /** Callback when all filters are cleared */
  onClearAll: () => void;

  /** Whether to show the clear all button */
  showClearAll?: boolean;

  /** Custom CSS class */
  className?: string;
}

/**
 * FilterBar component displays active filters as chips with a clear all button
 */
export function FilterBar({
  filters,
  onFilterRemove,
  onClearAll,
  showClearAll = true,
  className = "",
}: FilterBarProps) {
  // Don't render if there are no filters
  if (filters.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="region"
      aria-label="Active filters"
    >
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            value={filter.value}
            onRemove={() => onFilterRemove(filter.id)}
          />
        ))}
      </div>

      {showClearAll && filters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-8 gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={onClearAll}
        >
          <X className="h-3.5 w-3.5" />
          Clear all
          <span className="sr-only">Clear all filters</span>
        </Button>
      )}
    </div>
  );
}
