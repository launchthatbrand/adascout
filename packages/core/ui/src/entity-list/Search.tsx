"use client";

import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";

import { Button } from "@launchthatapp/ui/button";
import { Input } from "@launchthatapp/ui/input";

import { Spinner } from "../spinner";

export interface SearchProps {
  /** Current search value */
  value: string;

  /** Callback fired when search value changes */
  onChange: (value: string) => void;

  /** Placeholder text for the input field */
  placeholder?: string;

  /** Whether search is currently in progress */
  isSearching?: boolean;

  /** Debounce delay in milliseconds */
  debounceMs?: number;

  /** Custom CSS class for styling */
  className?: string;

  /** Aria label for accessibility */
  ariaLabel?: string;

  /** Additional props */
  [key: string]: unknown;
}

/**
 * Search component with debounced input and clear button.
 * Optimized for searching entity lists.
 */
export function Search({
  value,
  onChange,
  placeholder = "Search...",
  isSearching = false,
  debounceMs = 300,
  className = "",
  ariaLabel = "Search",
  ...props
}: SearchProps) {
  // Local state for input value to enable immediate feedback
  const [inputValue, setInputValue] = useState(value);

  // Reference to input element for focus management
  const inputRef = useRef<HTMLInputElement>(null);

  // Timer reference for debouncing
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update local input value when external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle input change with debouncing
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear any existing timeout
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set a new timeout for the debounced callback
    timerRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Handle clearing the search
  const handleClear = () => {
    setInputValue("");
    onChange(""); // No debounce for clearing

    // Focus the input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`relative w-full md:max-w-sm ${className}`}>
      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <SearchIcon className="h-4 w-4" aria-hidden="true" />
      </div>

      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pr-10 pl-10"
        aria-label={ariaLabel}
        {...props}
      />

      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        {isSearching ? (
          <Spinner className="text-muted-foreground" />
        ) : inputValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted-foreground/10 h-5 w-5 rounded-full"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
