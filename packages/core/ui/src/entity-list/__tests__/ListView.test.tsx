import { fireEvent, render, screen } from "@testing-library/react";

import type { ColumnDefinition } from "../types";
import { ListView } from "../ListView";

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
    sortable: true,
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
    sortable: true,
  },
];

describe("ListView", () => {
  it("renders successfully with data", () => {
    render(<ListView data={testData} columns={columns} />);

    // Check if data is rendered
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  it("calls onRowClick when a row is clicked", () => {
    const handleRowClick = jest.fn();
    render(
      <ListView
        data={testData}
        columns={columns}
        onRowClick={handleRowClick}
      />,
    );

    // Click the first row
    fireEvent.click(screen.getByText("John Doe"));

    // Check if onRowClick was called with the correct data
    expect(handleRowClick).toHaveBeenCalledWith(testData[0]);
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
      <ListView
        data={testData}
        columns={columns}
        entityActions={entityActions}
      />,
    );

    // Check if actions are displayed
    const editButtons = screen.getAllByText("Edit");
    const deleteButtons = screen.getAllByText("Delete");

    expect(editButtons.length).toBe(3); // One for each row
    expect(deleteButtons.length).toBe(3);

    // Test clicking an action
    fireEvent.click(editButtons[0]);
    expect(handleEdit).toHaveBeenCalledWith(testData[0]);
  });

  it("handles sorting when clicking sortable column headers", () => {
    const handleSortChange = jest.fn();
    render(
      <ListView
        data={testData}
        columns={columns}
        onSortChange={handleSortChange}
      />,
    );

    // Click the "Name" column header (which is sortable)
    fireEvent.click(screen.getByText("Name"));

    // Check if onSortChange was called with the correct configuration
    expect(handleSortChange).toHaveBeenCalledWith({
      id: "name",
      direction: "asc",
    });

    // Reset and simulate the sort config already being active
    handleSortChange.mockReset();
    render(
      <ListView
        data={testData}
        columns={columns}
        onSortChange={handleSortChange}
        sortConfig={{ id: "name", direction: "asc" }}
      />,
    );

    // Click again to toggle direction
    fireEvent.click(screen.getByText("Name"));

    // Should toggle to descending
    expect(handleSortChange).toHaveBeenCalledWith({
      id: "name",
      direction: "desc",
    });
  });

  it("displays sort indicators when a column is sorted", () => {
    const { container, rerender } = render(
      <ListView
        data={testData}
        columns={columns}
        sortConfig={{ id: "name", direction: "asc" }}
      />,
    );

    // Check for ascending sort indicator
    expect(container.querySelector("svg")).toBeInTheDocument();

    // Rerender with descending sort
    rerender(
      <ListView
        data={testData}
        columns={columns}
        sortConfig={{ id: "name", direction: "desc" }}
      />,
    );

    // Check for descending sort indicator
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("sorts data based on the provided sort configuration", () => {
    const { rerender } = render(
      <ListView
        data={testData}
        columns={columns}
        sortConfig={{ id: "name", direction: "asc" }}
      />,
    );

    // Get all row names to check order
    const rowNames = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => {
        const cell = row.querySelector("td");
        return cell ? cell.textContent : "";
      });

    // Expect alphabetical ascending order
    expect(rowNames).toEqual(["Bob Johnson", "Jane Smith", "John Doe"]);

    // Rerender with descending sort
    rerender(
      <ListView
        data={testData}
        columns={columns}
        sortConfig={{ id: "name", direction: "desc" }}
      />,
    );

    // Get updated row names
    const updatedRowNames = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => {
        const cell = row.querySelector("td");
        return cell ? cell.textContent : "";
      });

    // Expect alphabetical descending order
    expect(updatedRowNames).toEqual(["John Doe", "Jane Smith", "Bob Johnson"]);
  });

  it("handles selectable rows when selectable is true", () => {
    const handleSelectionChange = jest.fn();
    render(
      <ListView
        data={testData}
        columns={columns}
        selectable={true}
        selectedIds={[]}
        onSelectionChange={handleSelectionChange}
      />,
    );

    // Check for checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3); // One for each row

    // Select the first row
    fireEvent.click(checkboxes[0]);
    expect(handleSelectionChange).toHaveBeenCalledWith(["1"]);
  });

  it("shows selected rows as checked", () => {
    render(
      <ListView
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
    render(<ListView data={[]} columns={columns} />);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
