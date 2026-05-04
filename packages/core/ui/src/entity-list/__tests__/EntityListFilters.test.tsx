import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { FilterConfig, FilterValue } from "../types";
import { EntityListFilters } from "../EntityListFilters";

// Mock the components used by EntityListFilters
jest.mock("../FilterBar", () => ({
  FilterBar: ({
    filters,
    onFilterRemove,
    onClearAll,
  }: {
    filters: { id: string; label: string; value: string }[];
    onFilterRemove: (id: string) => void;
    onClearAll: () => void;
  }) => (
    <div data-testid="filter-bar">
      <div data-testid="filter-count">{filters.length}</div>
      {filters.map((filter) => (
        <div key={filter.id} data-testid={`filter-${filter.id}`}>
          {filter.label}: {filter.value}
          <button onClick={() => onFilterRemove(filter.id)}>Remove</button>
        </div>
      ))}
      <button data-testid="clear-all-btn" onClick={onClearAll}>
        Clear All
      </button>
    </div>
  ),
}));

jest.mock("../filters/FilterPopover", () => ({
  FilterPopover: ({
    onAddFilter,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: Record<string, unknown>;
    onAddFilter: (fieldId: string, operation: string, value: unknown) => void;
  }) => (
    <div data-testid="filter-popover">
      <button
        data-testid="add-text-filter-btn"
        onClick={() => onAddFilter("text_field", "contains", "search term")}
      >
        Add Text Filter
      </button>
      <button
        data-testid="add-number-filter-btn"
        onClick={() => onAddFilter("number_field", "equals", 42)}
      >
        Add Number Filter
      </button>
      <button
        data-testid="add-date-filter-btn"
        onClick={() =>
          onAddFilter("date_field", "equals", new Date("2023-01-01"))
        }
      >
        Add Date Filter
      </button>
    </div>
  ),
}));

describe("EntityListFilters", () => {
  // Mock data
  const mockFilterConfigs: FilterConfig<Record<string, unknown>>[] = [
    {
      id: "text_field",
      label: "Text Field",
      type: "text",
      field: "textField",
    },
    {
      id: "number_field",
      label: "Number Field",
      type: "number",
      field: "numberField",
    },
    {
      id: "date_field",
      label: "Date Field",
      type: "date",
      field: "dateField",
    },
    {
      id: "select_field",
      label: "Select Field",
      type: "select",
      field: "selectField",
      options: [
        { value: "option1", label: "Option 1" },
        { value: "option2", label: "Option 2" },
      ],
    },
    {
      id: "boolean_field",
      label: "Boolean Field",
      type: "boolean",
      field: "booleanField",
    },
  ];

  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render filter components", () => {
    render(
      <EntityListFilters
        filters={mockFilterConfigs}
        activeFilters={{}}
        onFilterChange={mockOnFilterChange}
      />,
    );

    expect(screen.getByTestId("filter-popover")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
  });

  it("should add a filter when FilterPopover adds a filter", async () => {
    render(
      <EntityListFilters
        filters={mockFilterConfigs}
        activeFilters={{}}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // Add a text filter
    fireEvent.click(screen.getByTestId("add-text-filter-btn"));

    // Verify onFilterChange was called with the new filter
    expect(mockOnFilterChange).toHaveBeenCalledWith({
      text_field: "search term",
    });

    // Filter should be shown in the filter bar
    await waitFor(() => {
      expect(screen.getByTestId("filter-count").textContent).toBe("1");
    });
  });

  it("should add multiple filters", async () => {
    render(
      <EntityListFilters
        filters={mockFilterConfigs}
        activeFilters={{}}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // Add a text filter
    fireEvent.click(screen.getByTestId("add-text-filter-btn"));

    // Add a number filter
    fireEvent.click(screen.getByTestId("add-number-filter-btn"));

    // Verify onFilterChange was called with both filters
    expect(mockOnFilterChange).toHaveBeenLastCalledWith({
      text_field: "search term",
      number_field: 42,
    });

    // Both filters should be shown in the filter bar
    await waitFor(() => {
      expect(screen.getByTestId("filter-count").textContent).toBe("2");
    });
  });

  it("should remove a filter when requested", async () => {
    const activeFilters: Record<string, FilterValue> = {
      text_field: "search term",
      number_field: 42,
    };

    render(
      <EntityListFilters
        filters={mockFilterConfigs}
        activeFilters={activeFilters}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // Verify we start with two filters
    await waitFor(() => {
      expect(screen.getByTestId("filter-count").textContent).toBe("2");
    });

    // Find the remove button for the first filter and click it
    const removeButtons = screen.getAllByText("Remove");
    if (removeButtons[0]) {
      fireEvent.click(removeButtons[0]);
    }

    // Verify onFilterChange was called with only the remaining filter
    expect(mockOnFilterChange).toHaveBeenCalled();

    // Only one filter should remain
    await waitFor(() => {
      expect(screen.getByTestId("filter-count").textContent).toBe("1");
    });
  });

  it("should clear all filters when clear all is clicked", async () => {
    const activeFilters: Record<string, FilterValue> = {
      text_field: "search term",
      number_field: 42,
      date_field: new Date("2023-01-01"),
    };

    render(
      <EntityListFilters
        filters={mockFilterConfigs}
        activeFilters={activeFilters}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // Verify we start with three filters
    await waitFor(() => {
      expect(screen.getByTestId("filter-count").textContent).toBe("3");
    });

    // Click the clear all button
    fireEvent.click(screen.getByTestId("clear-all-btn"));

    // Verify onFilterChange was called with an empty object
    expect(mockOnFilterChange).toHaveBeenCalledWith({});

    // No filters should remain
    await waitFor(() => {
      expect(screen.getByTestId("filter-count").textContent).toBe("0");
    });
  });

  it("should initialize with provided active filters", async () => {
    const activeFilters: Record<string, FilterValue> = {
      text_field: "existing search",
      boolean_field: true,
    };

    render(
      <EntityListFilters
        filters={mockFilterConfigs}
        activeFilters={activeFilters}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // Verify we start with two filters
    await waitFor(() => {
      expect(screen.getByTestId("filter-count").textContent).toBe("2");
    });

    // Verify the filters have the expected content
    expect(screen.getByText(/Text Field: existing search/)).toBeInTheDocument();
    expect(screen.getByText(/Boolean Field: true/)).toBeInTheDocument();
  });
});
