"use client";

import { useState } from "react";

import { Button } from "@acme/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";

import { FilterBar } from "../../FilterBar";
import { FilterConfig } from "../config";
import { FilterPopover } from "../FilterPopover";
import { FilterOperation } from "../types";
import { FilterItem, formatFilterValue } from "../values";

// Sample filter configuration
const sampleFilterConfig: FilterConfig = {
  fields: [
    { id: "name", label: "Product Name", type: "text" },
    { id: "price", label: "Price", type: "number" },
    { id: "createdAt", label: "Created At", type: "date" },
    {
      id: "category",
      label: "Category",
      type: "select",
      options: [
        { value: "electronics", label: "Electronics" },
        { value: "clothing", label: "Clothing" },
        { value: "books", label: "Books" },
        { value: "furniture", label: "Furniture" },
      ],
    },
    { id: "inStock", label: "In Stock", type: "boolean" },
    {
      id: "tags",
      label: "Tags",
      type: "select",
      allowMultiple: true,
      options: [
        { value: "new", label: "New" },
        { value: "sale", label: "Sale" },
        { value: "bestseller", label: "Bestseller" },
        { value: "limited", label: "Limited Edition" },
      ],
    },
  ],
};

export default function FilterPopoverExample() {
  // State for active filters
  const [filters, setFilters] = useState<FilterItem[]>([]);

  // Handle adding a new filter
  const handleAddFilter = (
    fieldId: string,
    operation: FilterOperation,
    value: unknown,
  ) => {
    // Find field config
    const field = sampleFilterConfig.fields.find((f) => f.id === fieldId);
    if (!field) return;

    // Create filter ID (using fieldId as base, with a unique suffix)
    const id = `${fieldId}_${Date.now()}`;

    // Format the display value
    const displayValue = formatFilterValue(value, operation);

    // Add new filter
    const newFilter: FilterItem = {
      id,
      fieldId,
      label: field.label,
      operation,
      value,
      displayValue,
    };

    setFilters((prev) => [...prev, newFilter]);
  };

  // Handle removing a filter
  const handleRemoveFilter = (filterId: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== filterId));
  };

  // Handle clearing all filters
  const handleClearAll = () => {
    setFilters([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter Popover Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <FilterPopover
              config={sampleFilterConfig}
              onAddFilter={handleAddFilter}
              existingFilters={filters.map((f) => ({ fieldId: f.fieldId }))}
            />

            <FilterPopover
              config={sampleFilterConfig}
              onAddFilter={handleAddFilter}
              existingFilters={filters.map((f) => ({ fieldId: f.fieldId }))}
              trigger={
                <Button variant="outline" size="sm" className="h-8">
                  Custom Trigger
                </Button>
              }
            />
          </div>

          <div className="mt-4">
            <FilterBar
              filters={filters.map((filter) => ({
                id: filter.id,
                label: filter.label,
                value: filter.displayValue,
              }))}
              onFilterRemove={handleRemoveFilter}
              onClearAll={handleClearAll}
            />
          </div>

          {filters.length > 0 && (
            <div className="mt-4 rounded-md bg-muted p-4">
              <h3 className="mb-2 font-medium">Current Filters:</h3>
              <pre className="text-sm">{JSON.stringify(filters, null, 2)}</pre>
            </div>
          )}

          {filters.length === 0 && (
            <p className="text-muted-foreground">
              No filters applied. Click "Add filter" to add a filter.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
