"use client";

import { useState } from "react";

import type { FilterConfig, FilterValue } from "../types";
import { EntityListFilters } from "../EntityListFilters";

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  createdAt: Date;
  status: "active" | "inactive" | "pending";
  isVerified: boolean;
}

export default function EntityListFiltersExample() {
  // Define filter configurations
  const filterConfigs: FilterConfig<User>[] = [
    {
      id: "name",
      label: "Name",
      type: "text",
      field: "name",
    },
    {
      id: "email",
      label: "Email",
      type: "text",
      field: "email",
    },
    {
      id: "age",
      label: "Age",
      type: "number",
      field: "age",
    },
    {
      id: "createdAt",
      label: "Created At",
      type: "date",
      field: "createdAt",
    },
    {
      id: "status",
      label: "Status",
      type: "select",
      field: "status",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "pending", label: "Pending" },
      ],
    },
    {
      id: "isVerified",
      label: "Verified",
      type: "boolean",
      field: "isVerified",
    },
  ];

  // State to track active filters
  const [activeFilters, setActiveFilters] = useState<
    Record<string, FilterValue>
  >({
    name: "John",
    isVerified: true,
  });

  // Handler for filter changes
  const handleFilterChange = (newFilters: Record<string, FilterValue>) => {
    setActiveFilters(newFilters);
    console.log("Filters updated:", newFilters);
  };

  // Display active filters for demonstration
  const renderActiveFilters = () => {
    return Object.entries(activeFilters).map(([key, value]) => {
      const filterConfig = filterConfigs.find((f) => f.id === key);
      const label = filterConfig?.label ?? key;

      // Format the value based on its type
      let displayValue: string;
      if (value instanceof Date) {
        displayValue = value.toLocaleDateString();
      } else if (typeof value === "boolean") {
        displayValue = value ? "Yes" : "No";
      } else {
        displayValue = String(value);
      }

      return (
        <div key={key} className="rounded-md bg-gray-100 p-2">
          <strong>{label}:</strong> {displayValue}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="mb-4 text-xl font-bold">EntityListFilters Example</h2>
        <p className="mb-4 text-gray-600">
          This example demonstrates the EntityListFilters component with various
          filter types. Try adding, removing, and clearing filters to see how it
          works.
        </p>
      </div>

      {/* Render the EntityListFilters component */}
      <div className="rounded-md border p-4">
        <h3 className="mb-2 font-semibold">Filter Controls</h3>
        <EntityListFilters
          filters={filterConfigs}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Display active filters for demonstration */}
      <div className="rounded-md border p-4">
        <h3 className="mb-2 font-semibold">Current Active Filters</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {Object.keys(activeFilters).length > 0 ? (
            renderActiveFilters()
          ) : (
            <p className="text-gray-500">No active filters</p>
          )}
        </div>
      </div>

      {/* Code example */}
      <div className="rounded-md border p-4">
        <h3 className="mb-2 font-semibold">Code Example</h3>
        <pre className="overflow-auto rounded-md bg-gray-800 p-4 text-sm text-gray-100">
          {`// Define filter configurations
const filterConfigs: FilterConfig<User>[] = [
  {
    id: "name",
    label: "Name",
    type: "text",
    field: "name",
  },
  // ... more filters

  {
    id: "status",
    label: "Status",
    type: "select",
    field: "status",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "pending", label: "Pending" },
    ],
  },
];

// State to track active filters
const [activeFilters, setActiveFilters] = useState<Record<string, FilterValue>>({});

// Handler for filter changes
const handleFilterChange = (newFilters: Record<string, FilterValue>) => {
  setActiveFilters(newFilters);
};

// Render the EntityListFilters component
<EntityListFilters
  filters={filterConfigs}
  activeFilters={activeFilters}
  onFilterChange={handleFilterChange}
/>`}
        </pre>
      </div>
    </div>
  );
}
