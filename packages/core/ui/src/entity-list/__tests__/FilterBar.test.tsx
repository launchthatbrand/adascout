import { fireEvent, render, screen } from "@testing-library/react";

import type { FilterChipProps } from "../FilterChip";
import { FilterBar } from "../FilterBar";

// Mock the FilterChip component to simplify testing
jest.mock("../FilterChip", () => ({
  FilterChip: ({ label, value, onRemove }: FilterChipProps) => (
    <div data-testid={`filter-chip-${label}`}>
      {label}: {value}
      <button onClick={onRemove}>Remove</button>
    </div>
  ),
}));

describe("FilterBar Component", () => {
  const mockFilters = [
    { id: "category", label: "Category", value: "Electronics" },
    { id: "price", label: "Price", value: "$100-$200" },
  ];

  const mockOnFilterRemove = jest.fn();
  const mockOnClearAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders filter chips for each filter", () => {
    render(
      <FilterBar
        filters={mockFilters}
        onFilterRemove={mockOnFilterRemove}
        onClearAll={mockOnClearAll}
      />,
    );

    // Check if all filter chips are rendered
    expect(screen.getByTestId("filter-chip-Category")).toBeInTheDocument();
    expect(screen.getByTestId("filter-chip-Price")).toBeInTheDocument();
  });

  it("calls onFilterRemove with correct ID when a filter is removed", () => {
    render(
      <FilterBar
        filters={mockFilters}
        onFilterRemove={mockOnFilterRemove}
        onClearAll={mockOnClearAll}
      />,
    );

    // Click remove button on the first filter
    const removeButtons = screen.getAllByText("Remove");
    fireEvent.click(removeButtons[0]);

    // Check if onFilterRemove was called with the correct ID
    expect(mockOnFilterRemove).toHaveBeenCalledWith("category");
  });

  it("calls onClearAll when Clear all button is clicked", () => {
    render(
      <FilterBar
        filters={mockFilters}
        onFilterRemove={mockOnFilterRemove}
        onClearAll={mockOnClearAll}
      />,
    );

    // Click clear all button
    const clearAllButton = screen.getByText("Clear all");
    fireEvent.click(clearAllButton);

    // Check if onClearAll was called
    expect(mockOnClearAll).toHaveBeenCalledTimes(1);
  });

  it("does not render Clear all button when showClearAll is false", () => {
    render(
      <FilterBar
        filters={mockFilters}
        onFilterRemove={mockOnFilterRemove}
        onClearAll={mockOnClearAll}
        showClearAll={false}
      />,
    );

    // Check that clear all button is not present
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });

  it("does not render anything when filters array is empty", () => {
    const { container } = render(
      <FilterBar
        filters={[]}
        onFilterRemove={mockOnFilterRemove}
        onClearAll={mockOnClearAll}
      />,
    );

    // Check that the component didn't render anything
    expect(container.firstChild).toBeNull();
  });

  it("applies custom className", () => {
    render(
      <FilterBar
        filters={mockFilters}
        onFilterRemove={mockOnFilterRemove}
        onClearAll={mockOnClearAll}
        className="test-class"
      />,
    );

    // Check if the custom class is applied
    const filterBar = screen.getByRole("region", { name: "Active filters" });
    expect(filterBar).toHaveClass("test-class");
  });

  it("has correct accessibility attributes", () => {
    render(
      <FilterBar
        filters={mockFilters}
        onFilterRemove={mockOnFilterRemove}
        onClearAll={mockOnClearAll}
      />,
    );

    // Check if the component has proper role and aria-label
    expect(
      screen.getByRole("region", { name: "Active filters" }),
    ).toBeInTheDocument();
  });
});
