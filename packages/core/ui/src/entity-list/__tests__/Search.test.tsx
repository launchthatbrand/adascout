import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { Search } from "../Search";

// Mock timer for debounce testing
jest.useFakeTimers();

describe("Search Component", () => {
  it("renders with default placeholder", () => {
    render(<Search value="" onChange={() => {}} />);

    // Check if search input exists with correct placeholder
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(<Search value="" onChange={() => {}} placeholder="Find items..." />);

    // Check if search input exists with custom placeholder
    expect(screen.getByPlaceholderText("Find items...")).toBeInTheDocument();
  });

  it("displays the correct value", () => {
    render(<Search value="test query" onChange={() => {}} />);

    // Check if input shows the correct value
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("test query");
  });

  it("shows clear button when value is present", () => {
    render(<Search value="test query" onChange={() => {}} />);

    // Check if clear button is visible
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
  });

  it("does not show clear button when value is empty", () => {
    render(<Search value="" onChange={() => {}} />);

    // Check that clear button is not present
    const clearButton = screen.queryByRole("button", { name: /clear search/i });
    expect(clearButton).not.toBeInTheDocument();
  });

  it("calls onChange after debounce when typing", async () => {
    const handleChange = jest.fn();
    render(<Search value="" onChange={handleChange} debounceMs={300} />);

    // Get input and type in it
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new search" } });

    // Check that onChange hasn't been called yet (because of debounce)
    expect(handleChange).not.toHaveBeenCalled();

    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Now onChange should have been called
    expect(handleChange).toHaveBeenCalledWith("new search");
  });

  it("clears search immediately when clear button is clicked", () => {
    const handleChange = jest.fn();
    render(<Search value="test query" onChange={handleChange} />);

    // Click the clear button
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    fireEvent.click(clearButton);

    // Check that onChange was called immediately with empty string
    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("shows loading spinner when isSearching is true", () => {
    render(<Search value="test" onChange={() => {}} isSearching={true} />);

    // Check if spinner is present
    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();

    // And clear button should not be present
    const clearButton = screen.queryByRole("button", { name: /clear search/i });
    expect(clearButton).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Search value="" onChange={() => {}} className="custom-class" />,
    );

    // Check if the custom class is applied
    const searchContainer = container.firstChild;
    expect(searchContainer).toHaveClass("custom-class");
  });

  it("applies custom aria-label", () => {
    render(<Search value="" onChange={() => {}} ariaLabel="Product search" />);

    // Check if aria-label is applied
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-label", "Product search");
  });
});
