"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";

import {
  BaseFilterProps,
  SELECT_FILTER_OPERATIONS,
  SelectFilterOperation,
  SelectFilterProps,
} from "./types";

/**
 * SelectFilter component for filtering with dropdown options
 */
export function SelectFilter({
  id,
  label,
  operation,
  operations,
  value,
  onOperationChange,
  onValueChange,
  options,
  multiple = false,
  className = "",
}: SelectFilterProps) {
  const handleOperationChange = (newOperation: string) => {
    onOperationChange(newOperation as SelectFilterOperation);

    // Reset value for operations that don't need a value
    if (newOperation === "isEmpty" || newOperation === "isNotEmpty") {
      onValueChange("");
    }
  };

  // Determine if the current operation requires a value input
  const showValueInput = operation !== "isEmpty" && operation !== "isNotEmpty";

  // Get the display label for a value
  const getOptionLabel = (optionValue: string) => {
    const option = options.find((opt) => opt.value === optionValue);
    return option ? option.label : optionValue;
  };

  return (
    <div className={`grid gap-2 ${className}`}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select value={operation} onValueChange={handleOperationChange}>
          <SelectTrigger
            id={`${id}-operation`}
            aria-label={`Filter operation for ${label}`}
          >
            <SelectValue placeholder="Select operation" />
          </SelectTrigger>
          <SelectContent>
            {operations.map((op) => (
              <SelectItem key={op.id} value={op.id}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showValueInput && (
          <Select
            value={value ? String(value) : ""}
            onValueChange={(newValue) => onValueChange(newValue)}
          >
            <SelectTrigger
              id={`${id}-value`}
              aria-label={`Filter value for ${label}`}
            >
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

/**
 * Default props factory for SelectFilter
 */
export function createDefaultSelectFilterProps(
  id: string,
  label: string,
  options: { value: string; label: string }[],
): SelectFilterProps {
  return {
    id,
    label,
    operation: "equals",
    operations: Object.values(SELECT_FILTER_OPERATIONS),
    value: "",
    options,
    multiple: false,
    onOperationChange: () => undefined,
    onValueChange: () => undefined,
  };
}
