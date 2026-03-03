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
  NUMBER_FILTER_OPERATIONS,
  NumberFilterOperation,
} from "./types";

interface NumberFilterValue {
  value1: number | null;
  value2: number | null;
}

/**
 * NumberFilter component for filtering numeric fields
 */
export function NumberFilter({
  id,
  label,
  operation,
  operations,
  value,
  onOperationChange,
  onValueChange,
  className = "",
}: BaseFilterProps) {
  // Ensure value is in the correct format
  const filterValue = (value as NumberFilterValue) || {
    value1: null,
    value2: null,
  };

  const handleOperationChange = (newOperation: string) => {
    onOperationChange(newOperation as NumberFilterOperation);

    // Reset value for between operation or to ensure proper structure
    if (newOperation === "between") {
      onValueChange({ value1: null, value2: null });
    } else {
      onValueChange({ value1: filterValue.value1, value2: null });
    }
  };

  const handleValue1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value === "" ? null : Number(e.target.value);
    onValueChange({ ...filterValue, value1: newValue });
  };

  const handleValue2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value === "" ? null : Number(e.target.value);
    onValueChange({ ...filterValue, value2: newValue });
  };

  // Determine if we need to show the second value input (for "between" operation)
  const showSecondInput = operation === "between";

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

        <div
          className={`grid ${showSecondInput ? "grid-cols-2 gap-2" : "grid-cols-1"}`}
        >
          <Input
            id={`${id}-value1`}
            type="number"
            placeholder={showSecondInput ? "Min value" : "Value"}
            value={filterValue.value1 === null ? "" : filterValue.value1}
            onChange={handleValue1Change}
            aria-label={
              showSecondInput
                ? `Minimum value for ${label}`
                : `Value for ${label}`
            }
          />

          {showSecondInput && (
            <Input
              id={`${id}-value2`}
              type="number"
              placeholder="Max value"
              value={filterValue.value2 === null ? "" : filterValue.value2}
              onChange={handleValue2Change}
              aria-label={`Maximum value for ${label}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Default props factory for NumberFilter
 */
export function createDefaultNumberFilterProps(
  id: string,
  label: string,
): BaseFilterProps {
  return {
    id,
    label,
    operation: "equals",
    operations: Object.values(NUMBER_FILTER_OPERATIONS),
    value: { value1: null, value2: null },
    onOperationChange: () => undefined,
    onValueChange: () => undefined,
  };
}
