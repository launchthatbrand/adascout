"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { clsx } from "clsx";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@acme/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@acme/ui/tabs";

import type {
  ColumnDefinition,
  EntityAction,
  EntityListProps,
  FilterConfig,
  FilterValue,
  SortConfig,
  TabHookResult,
  ViewMode,
} from "./types";
import { EntityListFilters } from "./EntityListFilters";
import { EntityListHeader } from "./EntityListHeader";
import { EntityListPagination } from "./EntityListPagination";
import { EntityListView } from "./EntityListView";

/**
 * EntityList is a universal component for displaying collections of data
 * with features like search, filtering, pagination, and switchable views.
 *
 * @template T - The type of data items being displayed (must be an object)
 */
export function EntityList<T extends Record<string, unknown>>({
  gridColumns,
  data,
  columns,
  enableRowSelection,
  enableVirtualization = false,
  virtualRowHeight = 72,
  virtualOverscan = 8,
  getRowId,
  bulkActions,
  filters,
  filterType = "default",
  customFilterComponent,
  tabOptions,
  tabFilterKey,
  isLoading = false,
  viewModes = ["list", "grid"],
  defaultViewMode = "list",
  title,
  mode,
  description,
  onRowClick,
  actions,
  itemRender,
  emptyState,
  pagination,
  entityActions,
  initialSort,
  error,
  hideFilters = false,
  initialFilters = {},
  onFiltersChange,
  tabRender: _tabRender,
  tabHooks = [],
  className,
  selectedId,
  enableSearch,
  enableFooter,
  customRender,
  customViewLabel,
  customViewRender,
}: EntityListProps<T>) {
  // State for view mode
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);

  // State for search
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // State for active filters
  const [activeFilters, setActiveFilters] =
    useState<Record<string, FilterValue>>(initialFilters);

  // State for sorting
  const [sorting, setSorting] = useState<SortConfig | undefined>(initialSort);

  // Add state for tab hook overrides
  const [hookData, setHookData] = useState<T[] | undefined>();
  const [hookRender, setHookRender] = useState<React.ReactNode | undefined>();
  const [hookFilters, setHookFilters] = useState<
    Record<string, FilterValue> | undefined
  >();

  // State for selected tab
  const [selectedTab, setSelectedTab] = useState<string>("all");

  // Handle search term changes with isSearching state
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setIsSearching(true);

    // Clear search state after a short delay to show loading indicator
    setTimeout(() => {
      setIsSearching(false);
    }, 300);
  };

  // Clear isSearching state when data changes
  useEffect(() => {
    setIsSearching(false);
  }, [data]);

  // Sync with external filter changes
  useEffect(() => {
    if (Object.keys(initialFilters).length > 0) {
      setActiveFilters(initialFilters);
    }
  }, [initialFilters]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Record<string, FilterValue>) => {
    setActiveFilters(newFilters);
    // Notify parent component if callback provided
    if (onFiltersChange) {
      onFiltersChange(newFilters);
      return;
    }
  };

  // For tabs filterType, always use 'all' as the default tab value
  const firstTabValue = "all";

  // Compose full tab list
  const combinedTabs = useMemo(() => {
    const base = tabOptions ?? [];
    const hooksAsTabs = tabHooks.map((h) => ({ label: h.label, value: h.id }));
    return [...base, ...hooksAsTabs];
  }, [tabOptions, tabHooks]);

  // Compute the selected tab value (string)
  const selectedTabValue = selectedTab;

  // Whenever selected tab changes, evaluate hooks
  useEffect(() => {
    if (filterType !== "tabs") return;
    if (!selectedTab || selectedTab === firstTabValue) {
      setHookData(undefined);
      setHookRender(undefined);
      setHookFilters(undefined);
      return;
    }
    const hook = tabHooks.find((h) => h.id === selectedTab);
    if (hook?.onActivate) {
      const result = hook.onActivate({
        currentData: data,
        currentFilters: activeFilters,
      });
      if (!result) {
        setHookRender(undefined);
        setHookData(undefined);
        setHookFilters(undefined);
        return;
      }
      if ("render" in result) {
        setHookRender(result.render);
      } else {
        setHookRender(undefined);
        setHookData(result.data);
        setHookFilters(result.filters);
      }
    } else {
      setHookData(undefined);
      setHookRender(undefined);
      setHookFilters(undefined);
    }
  }, [selectedTab, filterType, tabHooks, data, activeFilters]);

  // Handle sorting change
  const handleSortChange = (newSortConfig: SortConfig) => {
    setSorting(newSortConfig);
  };

  // Tabs filterType support
  let filterUI = null;
  if (filterType === "tabs" && tabFilterKey) {
    filterUI = (
      <Tabs
        value={selectedTab}
        onValueChange={(val: string) => {
          setSelectedTab(val);
          if (val === "all") {
            handleFilterChange({});
          } else {
            const hookExists = tabHooks.some((h) => h.id === val);
            if (hookExists) {
              // do not alter filters
            } else {
              handleFilterChange({ ...activeFilters, [tabFilterKey]: val });
            }
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {combinedTabs.map((opt) => (
            <TabsTrigger key={opt.value} value={String(opt.value)}>
              {opt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  } else if (filterType === "custom" && customFilterComponent) {
    filterUI = customFilterComponent;
  } else if (
    filterType === "default" &&
    filters &&
    filters.length > 0 &&
    !hideFilters
  ) {
    filterUI = (
      <EntityListFilters
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
      />
    );
  }

  // Prepare baseData considering hookData override
  const baseData = hookData ?? data;
  // Prepare filter source merging hookFilters with activeFilters
  const effectiveFilters = hookFilters
    ? { ...activeFilters, ...hookFilters }
    : activeFilters;

  const filteredData = useMemo(() => {
    if (!baseData?.length) return [];
    let filtered: T[] = [...baseData];
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((item) =>
        columns.some((col) => {
          const accessorKey =
            typeof col === "object" &&
            col !== null &&
            "accessorKey" in col &&
            typeof (col as { accessorKey?: unknown }).accessorKey === "string"
              ? ((col as { accessorKey?: string }).accessorKey as string)
              : undefined;
          if (!accessorKey) return false;
          const val = (item as Record<string, unknown>)[accessorKey];
          return val != null && String(val).toLowerCase().includes(lower);
        }),
      );
    }
    if (Object.keys(effectiveFilters).length && filters?.length) {
      Object.entries(effectiveFilters).forEach(([filterId, val]) => {
        const fc = filters.find((f) => f.id === filterId);
        if (!fc) return;
        filtered = filtered.filter((item) => {
          if (typeof fc.field === "function") return fc.field(item);
          return item[fc.field] === val;
        });
      });
    }
    return filtered;
  }, [baseData, searchTerm, effectiveFilters, columns, filters]);

  // Handle error state AFTER hooks are declared to satisfy ESLint hooks rules
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {typeof error === "string"
            ? error
            : "An error occurred while loading data."}
        </AlertDescription>
      </Alert>
    );
  }

  const headerSection = (
    <EntityListHeader
      title={title}
      description={description}
      searchTerm={searchTerm}
      onSearchChange={handleSearchChange}
      viewMode={viewMode}
      viewModes={viewModes}
      onViewModeChange={setViewMode}
      actions={actions}
      isSearching={isSearching || isLoading}
      enableSearch={enableSearch}
      customViewLabel={customViewLabel}
    />
  );

  // If hook provided custom render, show it
  if (hookRender) {
    return (
      <div className={clsx("w-full space-y-4", className)}>
        {headerSection}
        {filterUI}
        {hookRender}
      </div>
    );
  }

  const mainContent = (() => {
    if (customRender) {
      return customRender(filteredData);
    }
    if (viewMode === "custom") {
      return customViewRender ? customViewRender(filteredData) : null;
    }
    return (
      <EntityListView
        data={filteredData}
        columns={columns}
        gridColumns={gridColumns}
        viewMode={viewMode}
        isLoading={isLoading}
        onRowClick={onRowClick}
        emptyState={emptyState}
        entityActions={entityActions}
        enableFooter={enableFooter}
        sortConfig={sorting}
        onSortChange={handleSortChange}
        selectedId={selectedId}
        itemRender={itemRender}
        enableRowSelection={enableRowSelection}
        enableVirtualization={enableVirtualization}
        virtualRowHeight={virtualRowHeight}
        virtualOverscan={virtualOverscan}
        getRowId={getRowId}
        bulkActions={bulkActions}
      />
    );
  })();

  // Default: render filtered list view
  return (
    <div className={clsx("w-full space-y-4", className)}>
      {headerSection}
      {filterUI}
      {mainContent}
      {viewMode !== "custom" &&
        !customRender &&
        pagination && <EntityListPagination {...pagination} />}
    </div>
  );
}

// Re-export types for ease of use
export type { ColumnDef };
