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
  BOOLEAN_FILTER_OPERATIONS,
  BooleanFilterOperation,
} from "./types";

/**
 * BooleanFilter component for filtering boolean fields
 */
export function BooleanFilter({
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
    onOperationChange(newOperation as BooleanFilterOperation);
  };

  const handleValueChange = (newValue: string) => {
    onValueChange(newValue === "true");
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

        <Select
          value={value === true ? "true" : value === false ? "false" : ""}
          onValueChange={handleValueChange}
        >
          <SelectTrigger
            id={`${id}-value`}
            aria-label={`Filter value for ${label}`}
          >
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Default props factory for BooleanFilter
 */
export function createDefaultBooleanFilterProps(
  id: string,
  label: string,
): BaseFilterProps {
  return {
    id,
    label,
    operation: "equals",
    operations: Object.values(BOOLEAN_FILTER_OPERATIONS),
    value: null,
    onOperationChange: () => undefined,
    onValueChange: () => undefined,
  };
}
