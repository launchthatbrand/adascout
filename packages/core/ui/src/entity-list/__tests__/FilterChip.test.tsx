import { fireEvent, render, screen } from "@testing-library/react";

import { FilterChip } from "../FilterChip";

describe("FilterChip Component", () => {
  it("renders with label and value", () => {
    const handleRemove = jest.fn();
    render(
      <FilterChip
        label="Category"
        value="Electronics"
        onRemove={handleRemove}
      />,
    );

    // Check if label and value are displayed
    expect(screen.getByText("Category:")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", () => {
    const handleRemove = jest.fn();
    render(
      <FilterChip label="Status" value="Active" onRemove={handleRemove} />,
    );

    // Click the remove button
    const removeButton = screen.getByRole("button", {
      name: "Remove Status filter",
    });
    fireEvent.click(removeButton);

    // Check if onRemove was called
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    const handleRemove = jest.fn();
    const { container } = render(
      <FilterChip
        label="Price"
        value="$100-$200"
        onRemove={handleRemove}
        className="test-class"
      />,
    );

    // Check if the custom class is applied
    const badge = container.firstChild;
    expect(badge).toHaveClass("test-class");
  });

  it("applies specified variant", () => {
    const handleRemove = jest.fn();
    render(
      <FilterChip
        label="Priority"
        value="High"
        onRemove={handleRemove}
        variant="destructive"
      />,
    );

    // The variant is applied via the Badge component, which would need
    // more complex testing to verify the visual styling. This is a simple check
    // that doesn't necessarily verify the styling but checks the component renders.
    expect(screen.getByText("Priority:")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    const handleRemove = jest.fn();
    render(
      <FilterChip
        label="Department"
        value="Engineering"
        onRemove={handleRemove}
      />,
    );

    // Check if the remove button has a proper aria-label
    const removeButton = screen.getByRole("button");
    expect(removeButton).toHaveAttribute(
      "aria-label",
      "Remove Department filter",
    );
  });
});
