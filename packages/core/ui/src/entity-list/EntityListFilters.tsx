"use client";

import { useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import type { FilterConfig, FilterFieldConfig } from "./filters/config";
import type { FilterOperation } from "./filters/types";
import type { FilterItem } from "./filters/values";
import type { EntityListFiltersProps, FilterValue } from "./types";
import { FilterBar } from "./FilterBar";
import { getFieldById } from "./filters/config";
import { FilterPopover } from "./filters/FilterPopover";
import { formatFilterValue } from "./filters/values";

/**
 * EntityListFilters component that provides advanced filtering capabilities
 */
export function EntityListFilters<T>({
  filters,
  activeFilters,
  onFilterChange,
}: EntityListFiltersProps<T>) {
  // Convert the old filter format to the new FilterConfig format
  const filterConfig = useMemo<FilterConfig>(() => {
    return {
      fields: filters.map((filter) => {
        // Map filter type to valid FilterDataType and create appropriate config
        switch (filter.type) {
          case "select":
            if (filter.options) {
              return {
                id: filter.id,
                label: filter.label,
                type: "select" as const,
                options: filter.options.map((opt) => ({
                  value: String(opt.value),
                  label: opt.label,
                })),
                allowMultiple: false,
              };
            }
            break;
          case "text":
          case "number":
          case "date":
          case "boolean":
            return {
              id: filter.id,
              label: filter.label,
              type: filter.type,
              allowMultiple: false,
            } as FilterFieldConfig;
        }

        // Default to text type if not recognized
        return {
          id: filter.id,
          label: filter.label,
          type: "text" as const,
          allowMultiple: false,
        };
      }),
    };
  }, [filters]);

  // Convert activeFilters to the new format (array of FilterItem objects)
  const [filterItems, setFilterItems] = useState<FilterItem[]>(
    Object.entries(activeFilters).map(([fieldId, value]) => {
      const field = filters.find((f) => f.id === fieldId);
      return {
        id: `${fieldId}_${uuidv4()}`,
        fieldId,
        label: field?.label ?? fieldId,
        operation: "equals", // Default operation
        value,
        displayValue: String(value),
      };
    }),
  );

  // Handle adding a new filter
  const handleAddFilter = useCallback(
    (fieldId: string, operation: FilterOperation, value: unknown) => {
      const field = getFieldById(filterConfig, fieldId);
      if (!field) return;

      const displayValue = formatFilterValue(value, operation);

      const newFilter: FilterItem = {
        id: `${fieldId}_${uuidv4()}`,
        fieldId,
        label: field.label,
        operation,
        value,
        displayValue,
      };

      setFilterItems((prev) => [...prev, newFilter]);

      // Update the activeFilters in the parent component
      const newActiveFilters = { ...activeFilters };
      newActiveFilters[fieldId] = value as FilterValue;
      onFilterChange(newActiveFilters);
    },
    [filterConfig, activeFilters, onFilterChange],
  );

  // Handle removing a filter
  const handleRemoveFilter = useCallback(
    (filterId: string) => {
      const filterToRemove = filterItems.find((f) => f.id === filterId);
      if (!filterToRemove) return;

      setFilterItems((prev) => prev.filter((f) => f.id !== filterId));

      // Update the activeFilters in the parent component
      const newActiveFilters = { ...activeFilters };
      delete newActiveFilters[filterToRemove.fieldId];
      onFilterChange(newActiveFilters);
    },
    [filterItems, activeFilters, onFilterChange],
  );

  // Handle clearing all filters
  const handleClearAll = useCallback(() => {
    setFilterItems([]);
    onFilterChange({});
  }, [onFilterChange]);

  // Existing filters for the FilterPopover (to determine which fields are already filtered)
  const existingFilters = useMemo(
    () => filterItems.map((item) => ({ fieldId: item.fieldId })),
    [filterItems],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPopover
          config={filterConfig}
          onAddFilter={handleAddFilter}
          existingFilters={existingFilters}
        />

        <FilterBar
          filters={filterItems.map((filter) => ({
            id: filter.id,
            label: filter.label,
            value: filter.displayValue,
          }))}
          onFilterRemove={handleRemoveFilter}
          onClearAll={handleClearAll}
        />
      </div>
    </div>
  );
}
