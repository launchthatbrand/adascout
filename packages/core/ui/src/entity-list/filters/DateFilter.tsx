"use client";

import {
  BaseFilterProps,
  DATE_FILTER_OPERATIONS,
  DateFilterOperation,
} from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";

import { Button } from "@acme/ui/button";
import { Calendar } from "@acme/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface DateFilterValue {
  startDate: Date | null;
  endDate: Date | null;
}

/**
 * DateFilter component for filtering date fields
 */
export function DateFilter({
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
  const filterValue: DateFilterValue =
    typeof value === "object" && value !== null
      ? (value as DateFilterValue)
      : { startDate: null, endDate: null };

  const handleOperationChange = (newOperation: string) => {
    onOperationChange(newOperation as DateFilterOperation);

    // Reset value for operations that don't need a value or to ensure proper structure
    if (newOperation === "isEmpty" || newOperation === "isNotEmpty") {
      onValueChange({ startDate: null, endDate: null });
    } else if (newOperation === "between") {
      onValueChange({ startDate: filterValue.startDate, endDate: null });
    } else {
      onValueChange({ startDate: filterValue.startDate, endDate: null });
    }
  };

  // Determine if the current operation requires a date input
  const showDateInput = operation !== "isEmpty" && operation !== "isNotEmpty";

  // Determine if we need to show two date inputs (for "between" operation)
  const showEndDateInput = operation === "between";

  return (
    <div className={`grid gap-2 ${className}`}>
      <div className="grid grid-cols-1 gap-2">
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

        {showDateInput && (
          <div
            className={`grid ${showEndDateInput ? "grid-cols-2 gap-2" : "grid-cols-1"}`}
          >
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={`${id}-date1`}
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  aria-label={
                    showEndDateInput
                      ? `Start date for ${label}`
                      : `Date for ${label}`
                  }
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterValue.startDate ? (
                    format(filterValue.startDate, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterValue.startDate ?? undefined}
                  onSelect={(date) =>
                    onValueChange({ ...filterValue, startDate: date })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {showEndDateInput && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id={`${id}-date2`}
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    aria-label={`End date for ${label}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterValue.endDate ? (
                      format(filterValue.endDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterValue.endDate ?? undefined}
                    onSelect={(date) =>
                      onValueChange({ ...filterValue, endDate: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Default props factory for DateFilter
 */
export function createDefaultDateFilterProps(
  id: string,
  label: string,
): BaseFilterProps {
  return {
    id,
    label,
    operation: "equals",
    operations: Object.values(DATE_FILTER_OPERATIONS),
    value: { startDate: null, endDate: null },
    onOperationChange: () => undefined,
    onValueChange: () => undefined,
  };
}
