import type { ColumnDef } from "@tanstack/react-table";
import { ReactNode } from "react";

/**
 * Possible view modes for the EntityList
 * - list: Traditional table-like view
 * - grid: Card-based grid layout
 */
export type ViewMode = "list" | "grid" | "custom";

/**
 * Configuration for a column in the EntityList
 * @template T - The type of data being displayed
 */
type LegacyCellRenderer<T> = (context: { row: { original: T } }) => ReactNode;
type ModernCellRenderer<T> = (item: T) => ReactNode;

export interface ColumnDefinition<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  header: ReactNode;
  accessorKey?: keyof T;
  cell?: ModernCellRenderer<T> | LegacyCellRenderer<T>;
  sortable?: boolean;
  description?: string;
  minWidth?: string;
}

/**
 * Configuration for a filter option in the EntityList
 * @template T - The type of data being filtered
 */
export interface FilterConfig<T> {
  /** Unique identifier for the filter */
  id: string;

  /** Display label for the filter */
  label: string;

  /** Type of input to use for the filter */
  type: "text" | "select" | "date" | "boolean" | "number";

  /** Options for select-type filters */
  options?: { label: string; value: string | number | boolean }[];

  /** Field to filter on - either a key in T or a function that returns boolean */
  field: keyof T | ((item: T) => boolean);
}

/**
 * Configuration for an action that can be performed on an entity
 * @template T - The type of entity the action applies to
 */
export interface EntityAction<T> {
  /** Unique identifier for the action */
  id: string;

  /** Display label for the action (string or function that returns a string) */
  label: string | ((item: T) => string);

  /** Icon to display with the action (optional) */
  icon?: ReactNode;

  /** Handler function for the action */
  onClick: (item: T) => void;

  /** Whether the action should be disabled */
  isDisabled?: boolean | ((item: T) => boolean);

  /** Visual variant of the action (maps to button variants) */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
}

/**
 * Configuration for sorting
 */
export interface SortConfig {
  /** The column ID to sort by */
  id: string;

  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  /** Current page index (0-based) */
  pageIndex: number;

  /** Number of items per page */
  pageSize: number;

  /** Total number of pages */
  pageCount: number;

  /** Handler for page changes */
  onPageChange: (page: number) => void;

  /** Handler for page size changes (optional) */
  onPageSizeChange?: (size: number) => void;
}

/**
 * Props for the EntityList component
 * @template T - The type of data being displayed (must be an object)
 */
export interface EntityListProps<T extends Record<string, unknown>> {
  /** Number of columns at different breakpoints */
  gridColumns?: {
    sm?: number; // Small screens (default: 1)
    md?: number; // Medium screens (default: 2)
    lg?: number; // Large screens (default: 3)
    xl?: number; // Extra large screens (default: 4)
  };
  /** Array of data items to display */
  data: T[];

  /** Whether search is enabled */
  enableSearch?: boolean;

  /** Whether to show the footer */
  enableFooter?: boolean;

  /** Column configurations */
  columns: ColumnDefinition<T>[];

  /** Whether list view should include a checkbox selection column */
  enableRowSelection?: boolean;

  /** Enable row virtualization for large list datasets */
  enableVirtualization?: boolean;

  /** Estimated row height used by virtualization (px) */
  virtualRowHeight?: number;

  /** Overscan rows above/below viewport for virtualization */
  virtualOverscan?: number;

  /**
   * Provide a stable row id for selection (defaults to `String(item.id)` if present).
   * This should match the primary key used by your dataset.
   */
  getRowId?: (item: T) => string;

  /**
   * Optional bulk actions UI, shown when one or more rows are selected.
   * Receives selected items and helpers to clear selection.
   */
  bulkActions?: (args: {
    selectedItems: T[];
    clearSelection: () => void;
  }) => ReactNode;

  /** Filter configurations (optional) */
  filters?: FilterConfig<T>[];

  /** Mode of the EntityList */
  mode?: "default" | "select";

  /** Advanced dynamic tabs injected via hook system */
  tabHooks?: TabHook<T>[];

  /**
   * Type of filter UI to use: 'default' (built-in), 'custom' (provide your own component), or 'tabs' (tabbed filter UI)
   */
  filterType?: "default" | "custom" | "tabs";

  /**
   * Tab options for 'tabs' filterType. Each option has a label and value.
   */
  tabOptions?: { label: string; value: string }[];

  /**
   * Optional custom tab renderer. If provided and returns a non-null value for the selected tab,
   * EntityList will render that component instead of the filtered list. Useful for special tabs
   * (e.g., 'Vimeo') that need to display custom content.
   *
   * @param tabValue The value of the currently selected tab
   * @returns ReactNode to render, or null/undefined to render the default filtered list
   */
  tabRender?: (tabValue: string) => React.ReactNode;

  /**
   * The filter key to update when a tab is selected (e.g., 'category').
   */
  tabFilterKey?: string;

  /** Custom filter component to render when filterType is 'custom' */
  customFilterComponent?: ReactNode;

  /** Whether the data is currently loading */
  isLoading?: boolean;

  /** Error state (optional) */
  error?: string | Error | null;

  /** Available view modes (default: ["list", "grid"]) */
  viewModes?: ViewMode[];

  /** Custom item renderer (optional) */
  itemRender?: (item: T) => ReactNode;

  /** Custom renderer for replacing the default list/grid view */
  customRender?: (items: T[]) => ReactNode;

  /**
   * Optional third view mode ("custom") rendered when viewMode === "custom".
   * This still uses EntityList's search/filter/sort state, but lets callers
   * provide a bespoke layout.
   */
  customViewLabel?: string;
  customViewRender?: (items: T[]) => ReactNode;

  /** Default view mode (default: "list") */
  defaultViewMode?: ViewMode;

  /** Title for the list (optional) */
  title?: string;

  /** Description text (optional) */
  description?: string;

  /** Handler for row/item clicks (optional) */
  onRowClick?: (item: T) => void;

  /** UI elements for actions like "Add" button (optional) */
  actions?: ReactNode;

  /** Custom empty state UI (optional) */
  emptyState?: ReactNode;

  /** Pagination configuration (optional) */
  pagination?: PaginationConfig;

  /** Entity actions configuration (optional) */
  entityActions?: EntityAction<T>[];

  /** Initial sort configuration (optional) */
  initialSort?: SortConfig;

  /** Initial number of rows per page when pagination footer is enabled (default: 20) */
  initialPageSize?: number;

  /** Always render a compact record-count line above and below the table, independent of pagination. */
  showRowCount?: boolean;

  /** Hide the built-in filters section (default: false) */
  hideFilters?: boolean;

  /** Initial filter values */
  initialFilters?: Record<string, FilterValue>;

  /** Handler for filter changes (optional) */
  onFiltersChange?: (filters: Record<string, FilterValue>) => void;

  /** Additional className passed to wrapper */
  className?: string;

  /** The currently selected item ID, if any. Used for highlighting. */
  selectedId?: string | null;
}

/**
 * Props for the EntityListHeader component
 */
export interface EntityListHeaderProps {
  /** Title for the list (optional) */
  title?: string;

  /** Description text (optional) */
  description?: string;

  /** Whether search is enabled */
  enableSearch?: boolean;

  /** Current search term */
  searchTerm: string;

  /** Handler for search term changes */
  onSearchChange: (value: string) => void;

  /** Current view mode */
  viewMode: ViewMode;

  /** Available view modes */
  viewModes: ViewMode[];

  /** Handler for view mode changes */
  onViewModeChange: (mode: ViewMode) => void;

  /** UI elements for actions (optional) */
  actions?: ReactNode;

  /** Whether search is currently in progress */
  isSearching?: boolean;

  /** Optional label for custom view mode toggle */
  customViewLabel?: string;
}

/**
 * Allowed filter value types
 */
export type FilterValue = string | number | boolean | Date | null;

/**
 * Props for the EntityListFilters component
 * @template T - The type of data being filtered
 */
export interface EntityListFiltersProps<T> {
  /** Filter configurations */
  filters: FilterConfig<T>[];

  /** Currently active filters */
  activeFilters: Record<string, FilterValue>;

  /** Handler for filter changes */
  onFilterChange: (filters: Record<string, FilterValue>) => void;
}

/**
 * Props for the EntityListView component
 * @template T - The type of data being displayed
 */
export interface EntityListViewProps<T extends Record<string, unknown>> {
  /** Number of columns at different breakpoints */
  gridColumns?: {
    sm?: number; // Small screens (default: 1)
    md?: number; // Medium screens (default: 2)
    lg?: number; // Large screens (default: 3)
    xl?: number; // Extra large screens (default: 4)
  };

  /** Array of data items to display */
  data: T[];

  /** Column configurations */
  columns: ColumnDefinition<T>[];

  /** Current view mode */
  viewMode: ViewMode;

  /** Whether the data is currently loading */
  isLoading?: boolean;

  /** Handler for row/item clicks (optional) */
  onRowClick?: (item: T) => void;

  /** Custom empty state UI (optional) */
  emptyState?: ReactNode;

  /** Entity actions configuration (optional) */
  entityActions?: EntityAction<T>[];

  /** Current sort configuration (optional) */
  sortConfig?: SortConfig;

  /** Handler for sort changes (optional) */
  onSortChange?: (config: SortConfig) => void;

  /** The currently selected item ID, if any. Used for highlighting. */
  selectedId?: string | null;

  /** Custom item renderer (optional) */
  itemRender?: (item: T) => ReactNode;

  /** Whether to show the footer */
  enableFooter?: boolean;

  /** Whether list view should include a checkbox selection column */
  enableRowSelection?: boolean;

  /** Enable row virtualization for large list datasets */
  enableVirtualization?: boolean;

  /** Estimated row height used by virtualization (px) */
  virtualRowHeight?: number;

  /** Overscan rows above/below viewport for virtualization */
  virtualOverscan?: number;

  /** Provide a stable row id for selection */
  getRowId?: (item: T) => string;

  /** Optional bulk actions UI, shown when one or more rows are selected */
  bulkActions?: (args: {
    selectedItems: T[];
    clearSelection: () => void;
  }) => ReactNode;

  /** Initial number of rows per page (default: 20). Ignored when enableFooter is false. */
  initialPageSize?: number;

  /** Always render a compact record-count line above and below the table, independent of pagination. */
  showRowCount?: boolean;
}

/**
 * Props for the EntityListPagination component
 */
export interface EntityListPaginationProps {
  /** Current page index (0-based) */
  pageIndex: number;

  /** Number of items per page */
  pageSize: number;

  /** Total number of pages */
  pageCount: number;

  /** Handler for page changes */
  onPageChange: (page: number) => void;

  /** Handler for page size changes (optional) */
  onPageSizeChange?: (size: number) => void;
}

// Hook system for dynamic tabs injected by parent components
export interface TabHookContext<T> {
  currentData: T[];
  currentFilters: Record<string, FilterValue>;
}

export type TabHookResult<T> =
  | {
      /** Replace dataset used by EntityList */
      data?: T[];
      /** Merge/override filters */
      filters?: Record<string, FilterValue>;
    }
  | {
      /** Completely custom render instead of default list */
      render: React.ReactNode;
    };

export interface TabHook<T> {
  /** Unique id (matches TabsTrigger value) */
  id: string;
  /** Display label */
  label: string;
  /** Optional sort order */
  order?: number;
  /** Called when tab activated */
  onActivate?: (ctx: TabHookContext<T>) => TabHookResult<T> | void;
}
