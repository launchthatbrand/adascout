/**
 * Base interface for filter operation configurations
 */
export interface FilterOperationConfig {
  /** Unique identifier for the operation */
  id: string;

  /** Display label for the operation */
  label: string;
}

/**
 * Text filter operations
 */
export type TextFilterOperation =
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "empty"
  | "notEmpty";

/**
 * Configuration for text filter operations
 */
export const TEXT_FILTER_OPERATIONS: Record<
  TextFilterOperation,
  FilterOperationConfig
> = {
  contains: { id: "contains", label: "Contains" },
  equals: { id: "equals", label: "Equals" },
  startsWith: { id: "startsWith", label: "Starts with" },
  endsWith: { id: "endsWith", label: "Ends with" },
  empty: { id: "empty", label: "Is empty" },
  notEmpty: { id: "notEmpty", label: "Is not empty" },
};

/**
 * Number filter operations
 */
export type NumberFilterOperation =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual"
  | "between";

/**
 * Configuration for number filter operations
 */
export const NUMBER_FILTER_OPERATIONS: Record<
  NumberFilterOperation,
  FilterOperationConfig
> = {
  equals: { id: "equals", label: "Equals" },
  notEquals: { id: "notEquals", label: "Does not equal" },
  greaterThan: { id: "greaterThan", label: "Greater than" },
  lessThan: { id: "lessThan", label: "Less than" },
  greaterThanOrEqual: {
    id: "greaterThanOrEqual",
    label: "Greater than or equal to",
  },
  lessThanOrEqual: { id: "lessThanOrEqual", label: "Less than or equal to" },
  between: { id: "between", label: "Between" },
};

/**
 * Date filter operations
 */
export type DateFilterOperation =
  | "equals"
  | "before"
  | "after"
  | "between"
  | "isEmpty"
  | "isNotEmpty";

/**
 * Configuration for date filter operations
 */
export const DATE_FILTER_OPERATIONS: Record<
  DateFilterOperation,
  FilterOperationConfig
> = {
  equals: { id: "equals", label: "On" },
  before: { id: "before", label: "Before" },
  after: { id: "after", label: "After" },
  between: { id: "between", label: "Between" },
  isEmpty: { id: "isEmpty", label: "Is empty" },
  isNotEmpty: { id: "isNotEmpty", label: "Is not empty" },
};

/**
 * Select filter operations
 */
export type SelectFilterOperation =
  | "equals"
  | "notEquals"
  | "in"
  | "notIn"
  | "isEmpty"
  | "isNotEmpty";

/**
 * Configuration for select filter operations
 */
export const SELECT_FILTER_OPERATIONS: Record<
  SelectFilterOperation,
  FilterOperationConfig
> = {
  equals: { id: "equals", label: "Is" },
  notEquals: { id: "notEquals", label: "Is not" },
  in: { id: "in", label: "Is any of" },
  notIn: { id: "notIn", label: "Is none of" },
  isEmpty: { id: "isEmpty", label: "Is empty" },
  isNotEmpty: { id: "isNotEmpty", label: "Is not empty" },
};

/**
 * Boolean filter operations
 */
export type BooleanFilterOperation = "equals";

/**
 * Configuration for boolean filter operations
 */
export const BOOLEAN_FILTER_OPERATIONS: Record<
  BooleanFilterOperation,
  FilterOperationConfig
> = {
  equals: { id: "equals", label: "Is" },
};

/**
 * All supported filter operations
 */
export type FilterOperation =
  | TextFilterOperation
  | NumberFilterOperation
  | DateFilterOperation
  | SelectFilterOperation
  | BooleanFilterOperation;

/**
 * Filter option interface for select filters
 */
export interface FilterOption {
  /** Value of the option */
  value: string;

  /** Display label for the option */
  label: string;
}

/**
 * Base props for all filter components
 */
export interface BaseFilterProps {
  /** ID of the filter */
  id: string;

  /** Label of the filter */
  label: string;

  /** Currently selected operation */
  operation: FilterOperation;

  /** Available operations for this filter */
  operations: FilterOperationConfig[];

  /** Current value of the filter */
  value: any;

  /** Callback when the operation changes */
  onOperationChange: (operation: FilterOperation) => void;

  /** Callback when the value changes */
  onValueChange: (value: any) => void;

  /** Optional className for styling */
  className?: string;
}

/**
 * Select filter props
 */
export interface SelectFilterProps extends BaseFilterProps {
  /** Options for the select filter */
  options: FilterOption[];

  /** Whether multiple selection is allowed */
  multiple?: boolean;
}

/**
 * Helper to get the display label for a filter operation
 */
export function getOperationLabel(operation: FilterOperation): string {
  // Check in each operation type
  if (operation in TEXT_FILTER_OPERATIONS) {
    return TEXT_FILTER_OPERATIONS[operation as TextFilterOperation].label;
  }

  if (operation in NUMBER_FILTER_OPERATIONS) {
    return NUMBER_FILTER_OPERATIONS[operation as NumberFilterOperation].label;
  }

  if (operation in DATE_FILTER_OPERATIONS) {
    return DATE_FILTER_OPERATIONS[operation as DateFilterOperation].label;
  }

  if (operation in SELECT_FILTER_OPERATIONS) {
    return SELECT_FILTER_OPERATIONS[operation as SelectFilterOperation].label;
  }

  if (operation in BOOLEAN_FILTER_OPERATIONS) {
    return BOOLEAN_FILTER_OPERATIONS[operation as BooleanFilterOperation].label;
  }

  return operation;
}
