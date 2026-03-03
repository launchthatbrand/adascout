"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";

import { Button } from "@acme/ui/button";

import type { ColumnDefinition, FilterConfig, FilterValue } from "../types";
import { EntityList } from "../EntityList";

// Sample data interface
interface GroupData {
  id: string;
  name: string;
  description: string;
  privacy: "public" | "private" | "restricted";
  memberCount: number;
  categoryTags: string[];
  createdAt: Date;
}

// Sample data
const sampleGroups: GroupData[] = [
  {
    id: "1",
    name: "Marketing Team",
    description: "For marketing team collaboration",
    privacy: "public",
    memberCount: 12,
    categoryTags: ["Marketing", "Communication"],
    createdAt: new Date("2023-01-15"),
  },
  {
    id: "2",
    name: "Engineering",
    description: "For engineering discussions",
    privacy: "restricted",
    memberCount: 25,
    categoryTags: ["Development", "Tech"],
    createdAt: new Date("2023-02-10"),
  },
  {
    id: "3",
    name: "Leadership",
    description: "For company leadership",
    privacy: "private",
    memberCount: 5,
    categoryTags: ["Management"],
    createdAt: new Date("2023-03-05"),
  },
  {
    id: "4",
    name: "Product Design",
    description: "For design team collaboration",
    privacy: "public",
    memberCount: 8,
    categoryTags: ["Design", "UX"],
    createdAt: new Date("2023-04-20"),
  },
];

export default function MigrationExample() {
  // State for active filters
  const [_activeFilters, setActiveFilters] = useState<
    Record<string, FilterValue>
  >({});

  // Define column configurations
  const columns: ColumnDefinition<GroupData>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sortable: true,
    },
    {
      id: "privacy",
      header: "Privacy",
      accessorKey: "privacy",
      cell: (group) => {
        const labels = {
          public: "Public",
          private: "Private",
          restricted: "Restricted",
        };
        return labels[group.privacy];
      },
      sortable: true,
    },
    {
      id: "memberCount",
      header: "Members",
      accessorKey: "memberCount",
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      cell: (group) => group.createdAt.toLocaleDateString(),
      sortable: true,
    },
  ];

  // Define filter configurations
  const filters: FilterConfig<GroupData>[] = [
    {
      id: "name",
      label: "Name",
      type: "text",
      field: "name",
    },
    {
      id: "privacy",
      label: "Privacy",
      type: "select",
      field: "privacy",
      options: [
        { label: "Public", value: "public" },
        { label: "Private", value: "private" },
        { label: "Restricted", value: "restricted" },
      ],
    },
    {
      id: "memberCount",
      label: "Member Count",
      type: "number",
      field: "memberCount",
    },
    {
      id: "createdAt",
      label: "Created At",
      type: "date",
      field: "createdAt",
    },
  ];

  // Handle filter changes
  const _handleFilterChange = (newFilters: Record<string, FilterValue>) => {
    setActiveFilters(newFilters);
    // In a real implementation, you might want to apply these filters to your data fetching
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="mb-4 text-xl font-bold">
          Migration from Simple to Advanced EntityList
        </h2>
        <p className="mb-4 text-gray-600">
          This example demonstrates how to migrate from the simple EntityList
          implementation in the UI package to the more advanced filtering system
          in the shared components.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      {/* Advanced EntityList implementation */}
      <EntityList<GroupData>
        data={sampleGroups}
        columns={columns}
        filters={filters}
        title="Groups"
        description="Manage and browse groups"
        defaultViewMode="list"
        viewModes={["list", "grid"]}
        emptyState={
          <div className="flex h-32 flex-col items-center justify-center space-y-2">
            <p className="text-sm text-muted-foreground">No groups found</p>
            <Button variant="outline" size="sm">
              Create a group
            </Button>
          </div>
        }
        entityActions={[
          {
            id: "view",
            label: "View",
            onClick: (item) => alert(`View ${item.name}`),
            variant: "outline",
          },
          {
            id: "edit",
            label: "Edit",
            onClick: (item) => alert(`Edit ${item.name}`),
            variant: "outline",
          },
          {
            id: "delete",
            label: "Delete",
            onClick: (item) => alert(`Delete ${item.name}`),
            variant: "destructive",
            isDisabled: (item) => item.memberCount > 0,
          },
        ]}
      />

      {/* Code example section */}
      <div className="rounded-md border p-4">
        <h3 className="mb-2 font-semibold">Migration Guide</h3>
        <p className="mb-4 text-sm text-gray-600">
          To migrate from the simple EntityList to the advanced one:
        </p>
        <ol className="ml-6 list-decimal space-y-2 text-sm text-gray-700">
          <li>
            Import the EntityList from "../EntityList" instead of
            "@acme/ui/advanced/entity-list"
          </li>
          <li>
            Define column configurations with header, accessorKey, and cell
            renderer
          </li>
          <li>Create filter configurations for each filterable field</li>
          <li>
            Maintain filter state with useState and pass it to the EntityList
          </li>
          <li>
            Use the activeFilters and onFilterChange props for filter management
          </li>
        </ol>
      </div>
    </div>
  );
}
