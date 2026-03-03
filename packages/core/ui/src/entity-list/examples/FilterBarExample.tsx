"use client";

import { useState } from "react";

import { Button } from "@acme/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";

import { FilterBar, FilterItem } from "../FilterBar";

export default function FilterBarExample() {
  const [filters, setFilters] = useState<FilterItem[]>([
    { id: "category", label: "Category", value: "Electronics" },
    { id: "price", label: "Price", value: "$100-$200" },
    { id: "status", label: "Status", value: "In Stock" },
    { id: "rating", label: "Rating", value: "4+ Stars" },
  ]);

  const handleFilterRemove = (filterId: string) => {
    setFilters((prevFilters) =>
      prevFilters.filter((filter) => filter.id !== filterId),
    );
  };

  const handleClearAll = () => {
    setFilters([]);
  };

  const handleReset = () => {
    setFilters([
      { id: "category", label: "Category", value: "Electronics" },
      { id: "price", label: "Price", value: "$100-$200" },
      { id: "status", label: "Status", value: "In Stock" },
      { id: "rating", label: "Rating", value: "4+ Stars" },
    ]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filter Bar Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar
            filters={filters}
            onFilterRemove={handleFilterRemove}
            onClearAll={handleClearAll}
          />

          {filters.length === 0 && (
            <p className="text-muted-foreground">
              All filters have been cleared. Click "Reset Filters" to add them
              back.
            </p>
          )}

          {filters.length === 0 && (
            <Button className="mt-4" onClick={handleReset}>
              Reset Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter Bar Without Clear All</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterBar
            filters={filters}
            onFilterRemove={handleFilterRemove}
            onClearAll={handleClearAll}
            showClearAll={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
