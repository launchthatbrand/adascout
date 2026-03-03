import {
  BooleanFilterOperation,
  DateFilterOperation,
  FilterOperation,
  NumberFilterOperation,
  SelectFilterOperation,
  TextFilterOperation,
} from "./types";

/**
 * Interface for filter item that contains filter configuration and value
 */
export interface FilterItem {
  /** Unique identifier for this filter instance */
  id: string;

  /** ID of the field being filtered (references field config) */
  fieldId: string;

  /** Display label for the field */
  label: string;

  /** Currently selected operation */
  operation: FilterOperation;

  /** Current filter value */
  value: any;

  /** Formatted display value for the filter */
  displayValue: string;
}

/**
 * Value object for text filters
 */
export interface TextFilterValue {
  operation: TextFilterOperation;
  value: string;
}

/**
 * Value object for number filters
 */
export interface NumberFilterValue {
  operation: NumberFilterOperation;
  value: {
    value1: number | null;
    value2: number | null;
  };
}

/**
 * Value object for date filters
 */
export interface DateFilterValue {
  operation: DateFilterOperation;
  value: {
    startDate: Date | null;
    endDate: Date | null;
  };
}

/**
 * Value object for select filters
 */
export interface SelectFilterValue {
  operation: SelectFilterOperation;
  value: string | string[];
}

/**
 * Value object for boolean filters
 */
export interface BooleanFilterValue {
  operation: BooleanFilterOperation;
  value: boolean | null;
}

/**
 * Union type for all filter values
 */
export type FilterValue =
  | TextFilterValue
  | NumberFilterValue
  | DateFilterValue
  | SelectFilterValue
  | BooleanFilterValue;

/**
 * Helper to format a filter value for display
 */
export function formatFilterValue(
  value: any,
  operation: FilterOperation,
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  // Handle empty/not empty operations
  if (
    operation === "empty" ||
    operation === "notEmpty" ||
    operation === "isEmpty" ||
    operation === "isNotEmpty"
  ) {
    return "";
  }

  // Handle boolean values
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  // Handle primitive values
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  // Handle date values
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  // Handle number range
  if (typeof value === "object" && "value1" in value && "value2" in value) {
    const { value1, value2 } = value;

    if (operation === "between" && value1 !== null && value2 !== null) {
      return `${value1} - ${value2}`;
    }

    return value1 !== null ? String(value1) : "";
  }

  // Handle date range
  if (typeof value === "object" && "startDate" in value && "endDate" in value) {
    const { startDate, endDate } = value;

    if (operation === "between" && startDate && endDate) {
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }

    return startDate ? startDate.toLocaleDateString() : "";
  }

  // Handle arrays (for multi-select)
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return JSON.stringify(value);
}
