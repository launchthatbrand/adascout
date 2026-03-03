"use client";

import { Input } from "@acme/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";

import {
  BaseFilterProps,
  TEXT_FILTER_OPERATIONS,
  TextFilterOperation,
} from "./types";

/**
 * TextFilter component for filtering text fields
 */
export function TextFilter({
  id,
  label,
  operation,
  operations,
  value,
  onOperationChange,
  onValueChange,
  className = "",
}: BaseFilterProps) {
  const handleOperationChange = (newOperation: string) => {
    onOperationChange(newOperation as TextFilterOperation);

    // Reset value for operations that don't need a value
    if (newOperation === "empty" || newOperation === "notEmpty") {
      onValueChange("");
    }
  };

  // Determine if the current operation requires a value input
  const showValueInput = operation !== "empty" && operation !== "notEmpty";

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
          <Input
            id={`${id}-value`}
            placeholder="Enter text value"
            value={value || ""}
            onChange={(e) => onValueChange(e.target.value)}
            aria-label={`Filter value for ${label}`}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Default props factory for TextFilter
 */
export function createDefaultTextFilterProps(
  id: string,
  label: string,
): BaseFilterProps {
  return {
    id,
    label,
    operation: "contains",
    operations: Object.values(TEXT_FILTER_OPERATIONS),
    value: "",
    onOperationChange: () => {},
    onValueChange: () => {},
  };
}
