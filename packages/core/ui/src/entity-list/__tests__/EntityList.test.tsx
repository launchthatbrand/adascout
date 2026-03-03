import { fireEvent, render, screen } from "@testing-library/react";

import type { ColumnDefinition } from "../types";
import { EntityList } from "../EntityList";

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
  },
];

describe("EntityList", () => {
  it("renders successfully with data", () => {
    render(<EntityList data={testData} columns={columns} />);

    // Check if data is rendered
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<EntityList data={[]} columns={columns} isLoading={true} />);

    // Look for skeleton loaders
    const skeletons = document.querySelectorAll('[class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    render(
      <EntityList
        data={testData}
        columns={columns}
        error="Failed to load data"
      />,
    );

    // Check for error message
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
  });

  it("switches view mode", () => {
    const { container } = render(
      <EntityList data={testData} columns={columns} />,
    );

    // Default view should be list (table)
    expect(container.querySelector("table")).toBeInTheDocument();

    // Click grid view button
    const gridButton = screen.getByRole("button", { name: /Grid view/i });
    fireEvent.click(gridButton);

    // Should now be in grid view
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[class*="grid"]').length,
    ).toBeGreaterThan(0);
  });

  it("filters data based on search term", () => {
    render(<EntityList data={testData} columns={columns} />);

    // Initially all items are shown
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Johnson")).toBeInTheDocument();

    // Type in search box
    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "Jane" } });

    // Only Jane should be visible
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Johnson")).not.toBeInTheDocument();
  });

  it("displays empty state when no data matches", () => {
    render(<EntityList data={testData} columns={columns} />);

    // Type a search term that won't match anything
    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "xyz123" } });

    // Should show empty state
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });
});
