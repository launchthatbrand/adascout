import { fireEvent, render, screen } from "@testing-library/react";

import type { ColumnDefinition } from "../types";
import { GridView } from "../GridView";

// Mock data for testing
interface TestItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

const testData: TestItem[] = [
  { id: "1", name: "John Doe", email: "john@example.com", role: "Admin" },
  { id: "2", name: "Jane Smith", email: "jane@example.com", role: "User" },
  { id: "3", name: "Bob Johnson", email: "bob@example.com", role: "Editor" },
];

const columns: ColumnDefinition<TestItem>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
  },
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
  },
  {
    id: "role",
    header: "Role",
    accessorKey: "role",
  },
];

describe("GridView", () => {
  it("renders successfully with data", () => {
    render(<GridView data={testData} columns={columns} />);

    // Check if data is rendered
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument(); // Column header
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  it("renders the first column as a title", () => {
    render(<GridView data={testData} columns={columns} />);

    // Get all name instances (should be in title format)
    const johnDoeElements = screen.getAllByText("John Doe");
    const janeSmithElements = screen.getAllByText("Jane Smith");

    expect(johnDoeElements.length).toBeGreaterThan(0);
    expect(janeSmithElements.length).toBeGreaterThan(0);
  });

  it("calls onCardClick when a card is clicked", () => {
    const handleCardClick = jest.fn();
    render(
      <GridView
        data={testData}
        columns={columns}
        onCardClick={handleCardClick}
      />,
    );

    // Click the first card (contains John Doe)
    const johnDoeCard = screen.getByText("John Doe").closest(".cursor-pointer");
    if (johnDoeCard) {
      fireEvent.click(johnDoeCard);
    }

    // Check if onCardClick was called with the correct data
    expect(handleCardClick).toHaveBeenCalledWith(testData[0]);
  });

  it("displays entity actions", () => {
    const handleEdit = jest.fn();
    const handleDelete = jest.fn();

    const entityActions = [
      {
        id: "edit",
        label: "Edit",
        onClick: handleEdit,
      },
      {
        id: "delete",
        label: "Delete",
        onClick: handleDelete,
        variant: "destructive" as const,
      },
    ];

    render(
      <GridView
        data={testData}
        columns={columns}
        entityActions={entityActions}
      />,
    );

    // Check if actions are displayed
    const editButtons = screen.getAllByText("Edit");
    const deleteButtons = screen.getAllByText("Delete");

    expect(editButtons.length).toBe(3); // One for each card
    expect(deleteButtons.length).toBe(3);

    // Test clicking an action
    if (editButtons[0]) {
      fireEvent.click(editButtons[0]);
    }
    expect(handleEdit).toHaveBeenCalledWith(testData[0]);
  });

  it("handles selectable cards", () => {
    const handleSelectionChange = jest.fn();
    render(
      <GridView
        data={testData}
        columns={columns}
        selectable={true}
        selectedIds={[]}
        onSelectionChange={handleSelectionChange}
      />,
    );

    // Check for checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3); // One for each card

    // Select the first card
    if (checkboxes[0]) {
      fireEvent.click(checkboxes[0]);
    }
    expect(handleSelectionChange).toHaveBeenCalledWith(["1"]);
  });

  it("shows selected cards as checked", () => {
    render(
      <GridView
        data={testData}
        columns={columns}
        selectable={true}
        selectedIds={["1", "3"]}
      />,
    );

    // Get all checkboxes
    const checkboxes = screen.getAllByRole("checkbox");

    // First and third should be checked
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).toBeChecked();
  });

  it("displays an empty state message when no data is provided", () => {
    render(<GridView data={[]} columns={columns} />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("applies custom grid column classes", () => {
    const { container } = render(
      <GridView
        data={testData}
        columns={columns}
        gridColumns={{ sm: 2, md: 3, lg: 4, xl: 5 }}
      />,
    );

    const gridElement = container.firstChild;
    expect(gridElement).toHaveClass("sm:grid-cols-2");
    expect(gridElement).toHaveClass("md:grid-cols-3");
    expect(gridElement).toHaveClass("lg:grid-cols-4");
    expect(gridElement).toHaveClass("xl:grid-cols-5");
  });

  it("renders custom card content when cardRenderer is provided", () => {
    const customCardRenderer = (item: TestItem) => (
      <div data-testid="custom-card">Custom card for {item.name}</div>
    );

    render(
      <GridView
        data={testData}
        columns={columns}
        cardRenderer={customCardRenderer}
      />,
    );

    // Check if custom renderer is used
    const customCards = screen.getAllByTestId("custom-card");
    expect(customCards.length).toBe(3);
    expect(screen.getByText("Custom card for John Doe")).toBeInTheDocument();
  });
});
