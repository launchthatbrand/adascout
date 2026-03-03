"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";

import { FilterChip } from "../FilterChip";

interface ExampleFilter {
  id: string;
  label: string;
  value: string;
}

export default function FilterChipExample() {
  const [filters, setFilters] = useState<ExampleFilter[]>([
    { id: "category", label: "Category", value: "Electronics" },
    { id: "price", label: "Price", value: "$100-$200" },
    { id: "status", label: "Status", value: "In Stock" },
  ]);

  const handleRemove = (filterId: string) => {
    setFilters((prevFilters) =>
      prevFilters.filter((filter) => filter.id !== filterId),
    );
  };

  const handleResetFilters = () => {
    setFilters([
      { id: "category", label: "Category", value: "Electronics" },
      { id: "price", label: "Price", value: "$100-$200" },
      { id: "status", label: "Status", value: "In Stock" },
    ]);
  };

  // Empty function for examples with no action
  const handleNoAction = () => {
    // No action needed for demonstration purposes
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filter Chips Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <FilterChip
                key={filter.id}
                label={filter.label}
                value={filter.value}
                onRemove={() => handleRemove(filter.id)}
              />
            ))}
          </div>

          {filters.length === 0 && (
            <p className="text-muted-foreground">
              All filters have been removed. Click "Reset Filters" to add them
              back.
            </p>
          )}

          <button
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={handleResetFilters}
          >
            Reset Filters
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter Chip Variants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="Default"
              value="Example"
              variant="default"
              onRemove={handleNoAction}
            />
            <FilterChip
              label="Secondary"
              value="Example"
              variant="secondary"
              onRemove={handleNoAction}
            />
            <FilterChip
              label="Outline"
              value="Example"
              variant="outline"
              onRemove={handleNoAction}
            />
            <FilterChip
              label="Destructive"
              value="Example"
              variant="destructive"
              onRemove={handleNoAction}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
