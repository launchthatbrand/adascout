# EntityList Filtering Implementation Guide

This guide explains how to implement and use the advanced filtering system for the EntityList component across the portal application.

## Overview

The EntityList filtering system provides a rich, flexible way to filter collections of data in your application. It supports various filter types including:

- Text filters (contains, equals, starts with, ends with, etc.)
- Number filters (equals, greater than, less than, between, etc.)
- Date filters (equals, before, after, between, etc.)
- Select filters (dropdown selection with single or multiple options)
- Boolean filters (yes/no values)

## Components Architecture

The filtering system consists of the following components:

1. **EntityListFilters**: Main component that integrates all filter components
2. **FilterBar**: Displays active filters as chips
3. **FilterChip**: Individual filter display with remove functionality
4. **FilterPopover**: UI for adding new filters
5. **Individual Filter Components**:
   - TextFilter
   - NumberFilter
   - DateFilter
   - SelectFilter
   - BooleanFilter

## Implementation Steps

### 1. Import the Required Components

```tsx
import type {
  ColumnDefinition,
  FilterConfig,
  FilterValue,
} from "@/components/shared/EntityList/types";
import { EntityList } from "@/components/shared/EntityList/EntityList";
```

### 2. Define Filter Configurations

Create filter configurations for each field you want to make filterable:

```tsx
const filters: FilterConfig<YourDataType>[] = [
  {
    id: "name",
    label: "Name",
    type: "text",
    field: "name",
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    field: "status",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
      { label: "Pending", value: "pending" },
    ],
  },
  {
    id: "createdAt",
    label: "Created At",
    type: "date",
    field: "createdAt",
  },
  {
    id: "count",
    label: "Count",
    type: "number",
    field: "count",
  },
  {
    id: "isVerified",
    label: "Verified",
    type: "boolean",
    field: "isVerified",
  },
];
```

### 3. Define Column Configurations

Define columns for the list view:

```tsx
const columns: ColumnDefinition<YourDataType>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sortable: true,
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    sortable: true,
  },
  // Add more columns as needed
];
```

### 4. Add State for Active Filters

```tsx
const [activeFilters, setActiveFilters] = useState<Record<string, FilterValue>>(
  {},
);

const handleFilterChange = (newFilters: Record<string, FilterValue>) => {
  setActiveFilters(newFilters);

  // Apply filters to your data fetching logic
  // For example:
  // refetchData({ filters: newFilters });
};
```

### 5. Use the EntityList Component

```tsx
<EntityList<YourDataType>
  data={yourData}
  columns={columns}
  filters={filters}
  title="Your List Title"
  description="Optional description text"
  defaultViewMode="list"
  viewModes={["list", "grid"]}
  isLoading={isLoading}
  emptyState={<YourEmptyStateComponent />}
  entityActions={[
    {
      id: "view",
      label: "View",
      onClick: (item) => handleView(item),
      variant: "outline",
    },
    {
      id: "edit",
      label: "Edit",
      onClick: (item) => handleEdit(item),
      variant: "outline",
    },
  ]}
/>
```

## Migration from UI Package EntityList

If you're currently using the simpler `EntityList` from `@acme/ui/advanced/entity-list`, you'll need to:

1. Import from the shared components instead
2. Convert filter options to the new format
3. Handle filter state with useState
4. Update your data fetching logic to use the new filter format

See the `MigrationExample.tsx` for a complete example of how to migrate.

## Filter Types and Operations

### Text Filters

Operations:

- contains
- equals
- startsWith
- endsWith
- empty
- notEmpty

### Number Filters

Operations:

- equals
- notEquals
- greaterThan
- lessThan
- greaterThanOrEqual
- lessThanOrEqual
- between

### Date Filters

Operations:

- equals
- before
- after
- between
- isEmpty
- isNotEmpty

### Select Filters

Operations:

- equals
- notEquals
- in
- notIn
- isEmpty
- isNotEmpty

### Boolean Filters

Operations:

- equals (Yes/No)

## Advanced Features

### Custom Filter Rendering

You can customize how filters are displayed by creating your own filter components that implement the `BaseFilterProps` interface.

### Multiple Filters for the Same Field

Set `allowMultiple: true` in your filter configuration to allow multiple filters for the same field:

```tsx
{
  id: "status",
  label: "Status",
  type: "select",
  field: "status",
  allowMultiple: true,
  options: [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
}
```

## Examples

Check out the example files in the `examples/` directory for more detailed implementations:

- BasicExample.tsx - Simple implementation
- EntityListFiltersExample.tsx - Focused on filter features
- MigrationExample.tsx - How to migrate from the UI package
