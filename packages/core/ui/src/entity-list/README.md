# EntityList Component System

This directory contains the universal `EntityList` component system designed for displaying collections of data with features like search, filtering, pagination, and switchable views.

## Components

### Core Components

- **EntityList**: The main component that integrates all the subcomponents
- **ListView**: Table-based view for displaying data in rows and columns
- **GridView**: Card-based view for displaying data in a grid layout
- **Search**: Debounced search input with loading indicator and clear button
- **EntityListView**: Wrapper that toggles between List and Grid views
- **EntityListHeader**: Header section with title, search, and view toggles
- **EntityListFilters**: Advanced filtering options
- **EntityListPagination**: Pagination controls

## ListView Features

The `ListView` component provides the following features:

- **Dynamic Columns**: Configurable columns with custom cell renderers
- **Sorting**: Click column headers to sort data
- **Row Actions**: Configure actions for each row with buttons
- **Row Selection**: Optional checkbox-based row selection
- **Customizable**: All aspects of the table can be customized

## GridView Features

The `GridView` component provides the following features:

- **Card-Based Layout**: Displays data in a responsive grid of cards
- **Customizable Grid**: Configure the number of columns at different breakpoints
- **Card Actions**: Add action buttons to each card
- **Card Selection**: Optional checkbox-based card selection
- **Custom Rendering**: Optionally provide a custom card renderer for complete control
- **Responsive Design**: Automatically adapts to different screen sizes

## Search Features

The `Search` component provides the following features:

- **Debounced Input**: Prevents excessive filtering operations while typing
- **Loading Indicator**: Shows a spinner when search is in progress
- **Clear Button**: One-click clearing of the search field
- **Accessibility**: Fully accessible with proper ARIA labels
- **Immediate Feedback**: Provides immediate visual feedback on input

## Usage

### ListView Example

```tsx
import type { ColumnDefinition } from "@/components/shared/EntityList";
import { ListView } from "@/components/shared/EntityList";

// Define your data structure
interface User {
  id: string;
  name: string;
  email: string;
}

// Sample data
const users: User[] = [
  { id: "1", name: "John Doe", email: "john@example.com" },
  { id: "2", name: "Jane Smith", email: "jane@example.com" },
];

// Define columns
const columns: ColumnDefinition<User>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sortable: true,
  },
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
  },
];

// Component implementation
export default function UserList() {
  return (
    <ListView
      data={users}
      columns={columns}
      onRowClick={(user) => console.log("Row clicked:", user)}
    />
  );
}
```

### GridView Example

```tsx
import type { ColumnDefinition } from "@/components/shared/EntityList";
import { GridView } from "@/components/shared/EntityList";

// Define your data structure
interface Product {
  id: string;
  name: string;
  price: number;
}

// Sample data
const products: Product[] = [
  { id: "1", name: "Headphones", price: 99.99 },
  { id: "2", name: "Keyboard", price: 59.99 },
];

// Define columns
const columns: ColumnDefinition<Product>[] = [
  {
    id: "name",
    header: "Product",
    accessorKey: "name",
  },
  {
    id: "price",
    header: "Price",
    cell: (product) => `$${product.price.toFixed(2)}`,
  },
];

// Component implementation
export default function ProductGrid() {
  return (
    <GridView
      data={products}
      columns={columns}
      onCardClick={(product) => console.log("Card clicked:", product)}
      gridColumns={{ sm: 2, md: 3, lg: 4 }}
    />
  );
}
```

### Search Example

```tsx
import { useState } from "react";
import { Search } from "@/components/shared/EntityList";

export default function SearchExample() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setIsSearching(true);

    // Simulate API call
    setTimeout(() => {
      // Filter your data here
      setIsSearching(false);
    }, 500);
  };

  return (
    <Search
      value={searchTerm}
      onChange={handleSearch}
      isSearching={isSearching}
      placeholder="Search..."
    />
  );
}
```

For more advanced usage, see the example files in the `examples` directory:

- `BasicExample.tsx`: Shows the full EntityList with all features
- `ListViewExample.tsx`: Demonstrates the ListView component specifically
- `GridViewExample.tsx`: Demonstrates the GridView component specifically
- `SearchExample.tsx`: Demonstrates the Search component specifically

## Props

### ListView Props

| Prop                | Type                           | Description                          |
| ------------------- | ------------------------------ | ------------------------------------ |
| `data`              | `T[]`                          | Array of items to display            |
| `columns`           | `ColumnDefinition<T>[]`        | Column configuration                 |
| `onRowClick`        | `(item: T) => void`            | Optional click handler for rows      |
| `entityActions`     | `EntityAction<T>[]`            | Actions to display for each row      |
| `sortConfig`        | `SortConfig`                   | Current sort configuration           |
| `onSortChange`      | `(config: SortConfig) => void` | Handler for sort changes             |
| `selectable`        | `boolean`                      | Whether to show selection checkboxes |
| `selectedIds`       | `string[]`                     | Currently selected row IDs           |
| `onSelectionChange` | `(ids: string[]) => void`      | Handler for selection changes        |
| `idField`           | `keyof T`                      | Field to use as ID (default: 'id')   |

### GridView Props

| Prop                | Type                                | Description                           |
| ------------------- | ----------------------------------- | ------------------------------------- |
| `data`              | `T[]`                               | Array of items to display             |
| `columns`           | `ColumnDefinition<T>[]`             | Column configuration                  |
| `onCardClick`       | `(item: T) => void`                 | Optional click handler for cards      |
| `entityActions`     | `EntityAction<T>[]`                 | Actions to display for each card      |
| `gridColumns`       | `{ sm?: number, md?: number, ... }` | Responsive grid columns configuration |
| `selectable`        | `boolean`                           | Whether to show selection checkboxes  |
| `selectedIds`       | `string[]`                          | Currently selected card IDs           |
| `onSelectionChange` | `(ids: string[]) => void`           | Handler for selection changes         |
| `idField`           | `keyof T`                           | Field to use as ID (default: 'id')    |
| `cardRenderer`      | `(item: T) => ReactNode`            | Custom card content renderer          |

### Search Props

| Prop          | Type                      | Description                             |
| ------------- | ------------------------- | --------------------------------------- |
| `value`       | `string`                  | Current search value                    |
| `onChange`    | `(value: string) => void` | Handler for search changes              |
| `placeholder` | `string`                  | Placeholder text (default: "Search...") |
| `isSearching` | `boolean`                 | Whether search is in progress           |
| `debounceMs`  | `number`                  | Debounce delay (default: 300ms)         |
| `className`   | `string`                  | Custom CSS class                        |
| `ariaLabel`   | `string`                  | Accessibility label (default: "Search") |

### Column Definition

| Property      | Type                     | Description                      |
| ------------- | ------------------------ | -------------------------------- |
| `id`          | `string`                 | Unique identifier for the column |
| `header`      | `string`                 | Header text                      |
| `accessorKey` | `keyof T`                | Key to access data (optional)    |
| `cell`        | `(item: T) => ReactNode` | Custom cell renderer (optional)  |
| `sortable`    | `boolean`                | Whether column is sortable       |

## Testing

Tests are located in the `__tests__` directory and cover:

- Rendering data correctly
- Sorting functionality
- Selection behavior
- Action button behavior
- Error states
- Search functionality

Run tests with:

```
npm test
```
