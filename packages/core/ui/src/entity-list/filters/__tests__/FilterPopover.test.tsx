import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FilterPopover } from "../FilterPopover";

// Mock filter components
jest.mock("../TextFilter", () => ({
  TextFilter: ({ onOperationChange, onValueChange }: any) => (
    <div data-testid="text-filter">
      <button
        data-testid="text-operation-button"
        onClick={() => onOperationChange("contains")}
      >
        Set Operation
      </button>
      <input
        data-testid="text-value-input"
        onChange={(e) => onValueChange(e.target.value)}
      />
    </div>
  ),
  createDefaultTextFilterProps: () => ({}),
}));

jest.mock("../NumberFilter", () => ({
  NumberFilter: () => <div data-testid="number-filter" />,
  createDefaultNumberFilterProps: () => ({}),
}));

jest.mock("../DateFilter", () => ({
  DateFilter: () => <div data-testid="date-filter" />,
  createDefaultDateFilterProps: () => ({}),
}));

jest.mock("../SelectFilter", () => ({
  SelectFilter: () => <div data-testid="select-filter" />,
  createDefaultSelectFilterProps: () => ({}),
}));

jest.mock("../BooleanFilter", () => ({
  BooleanFilter: () => <div data-testid="boolean-filter" />,
  createDefaultBooleanFilterProps: () => ({}),
}));

describe("FilterPopover Component", () => {
  const mockConfig = {
    fields: [
      { id: "name", label: "Name", type: "text" as const },
      { id: "age", label: "Age", type: "number" as const },
      { id: "createdAt", label: "Created At", type: "date" as const },
      {
        id: "status",
        label: "Status",
        type: "select" as const,
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      { id: "isVerified", label: "Is Verified", type: "boolean" as const },
    ],
  };

  const mockOnAddFilter = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with a default trigger button", () => {
    render(<FilterPopover config={mockConfig} onAddFilter={mockOnAddFilter} />);

    expect(screen.getByText("Add filter")).toBeInTheDocument();
  });

  it("renders with a custom trigger", () => {
    render(
      <FilterPopover
        config={mockConfig}
        onAddFilter={mockOnAddFilter}
        trigger={<button>Custom Trigger</button>}
      />,
    );

    expect(screen.getByText("Custom Trigger")).toBeInTheDocument();
  });

  it("opens popover when trigger is clicked", async () => {
    render(<FilterPopover config={mockConfig} onAddFilter={mockOnAddFilter} />);

    // Click the trigger button
    const user = userEvent.setup();
    await user.click(screen.getByText("Add filter"));

    // Check if popover content is visible
    expect(screen.getByText("Add Filter")).toBeInTheDocument();
    expect(screen.getByText("Field")).toBeInTheDocument();
  });

  it("displays field options in the dropdown", async () => {
    render(<FilterPopover config={mockConfig} onAddFilter={mockOnAddFilter} />);

    // Open the popover
    const user = userEvent.setup();
    await user.click(screen.getByText("Add filter"));

    // Open the field dropdown
    await user.click(screen.getByText("Select field"));

    // Check if field options are displayed
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("Created At")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Is Verified")).toBeInTheDocument();
  });

  it("excludes already filtered fields when allowMultiple is false", async () => {
    render(
      <FilterPopover
        config={mockConfig}
        onAddFilter={mockOnAddFilter}
        existingFilters={[{ fieldId: "name" }]}
      />,
    );

    // Open the popover
    const user = userEvent.setup();
    await user.click(screen.getByText("Add filter"));

    // Open the field dropdown
    await user.click(screen.getByText("Select field"));

    // "Name" field should not be in the dropdown
    expect(screen.queryByText("Name")).not.toBeInTheDocument();

    // Other fields should still be present
    expect(screen.getByText("Age")).toBeInTheDocument();
  });

  it("allows fields with allowMultiple=true even if already filtered", async () => {
    const configWithAllowMultiple = {
      fields: [
        ...mockConfig.fields,
        {
          id: "tags",
          label: "Tags",
          type: "select" as const,
          allowMultiple: true,
        },
      ],
    };

    render(
      <FilterPopover
        config={configWithAllowMultiple}
        onAddFilter={mockOnAddFilter}
        existingFilters={[{ fieldId: "tags" }]}
      />,
    );

    // Open the popover
    const user = userEvent.setup();
    await user.click(screen.getByText("Add filter"));

    // Open the field dropdown
    await user.click(screen.getByText("Select field"));

    // "Tags" field should still be in the dropdown because allowMultiple is true
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("renders the correct filter component based on field type", async () => {
    render(<FilterPopover config={mockConfig} onAddFilter={mockOnAddFilter} />);

    // Open the popover
    const user = userEvent.setup();
    await user.click(screen.getByText("Add filter"));

    // Select the "Name" field (text type)
    await user.click(screen.getByText("Select field"));
    await user.click(screen.getByText("Name"));

    // Check if text filter component is rendered
    expect(screen.getByTestId("text-filter")).toBeInTheDocument();
  });

  it("calls onAddFilter with correct values when form is submitted", async () => {
    render(<FilterPopover config={mockConfig} onAddFilter={mockOnAddFilter} />);

    // Open the popover
    const user = userEvent.setup();
    await user.click(screen.getByText("Add filter"));

    // Select the "Name" field (text type)
    await user.click(screen.getByText("Select field"));
    await user.click(screen.getByText("Name"));

    // Set operation and value
    await user.click(screen.getByTestId("text-operation-button"));
    await user.type(screen.getByTestId("text-value-input"), "test");

    // Submit the form
    await user.click(screen.getByText("Apply Filter"));

    // Check if onAddFilter was called with correct arguments
    expect(mockOnAddFilter).toHaveBeenCalledWith("name", "contains", "test");
  });

  it("closes the popover when Cancel button is clicked", async () => {
    render(<FilterPopover config={mockConfig} onAddFilter={mockOnAddFilter} />);

    // Open the popover
    const user = userEvent.setup();
    await user.click(screen.getByText("Add filter"));

    // Click Cancel button
    await user.click(screen.getByText("Cancel"));

    // Check if popover is closed
    await waitFor(() => {
      expect(screen.queryByText("Add Filter")).not.toBeInTheDocument();
    });
  });
});
