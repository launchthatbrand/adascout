import { FilterOption } from "./types";

/**
 * Data types supported by the filter system
 */
export type FilterDataType = "text" | "number" | "date" | "select" | "boolean";

/**
 * Base interface for filter field configuration
 */
export interface BaseFilterFieldConfig {
  /** Unique identifier for the field */
  id: string;

  /** Display label for the field */
  label: string;

  /** Data type for the field */
  type: FilterDataType;

  /** Whether the field can be filtered multiple times */
  allowMultiple?: boolean;
}

/**
 * Text filter field configuration
 */
export interface TextFilterFieldConfig extends BaseFilterFieldConfig {
  type: "text";
}

/**
 * Number filter field configuration
 */
export interface NumberFilterFieldConfig extends BaseFilterFieldConfig {
  type: "number";
}

/**
 * Date filter field configuration
 */
export interface DateFilterFieldConfig extends BaseFilterFieldConfig {
  type: "date";
}

/**
 * Select filter field configuration
 */
export interface SelectFilterFieldConfig extends BaseFilterFieldConfig {
  type: "select";

  /** Options for the select filter */
  options: FilterOption[];

  /** Whether multiple options can be selected */
  multiple?: boolean;
}

/**
 * Boolean filter field configuration
 */
export interface BooleanFilterFieldConfig extends BaseFilterFieldConfig {
  type: "boolean";
}

/**
 * Union type for all filter field configurations
 */
export type FilterFieldConfig =
  | TextFilterFieldConfig
  | NumberFilterFieldConfig
  | DateFilterFieldConfig
  | SelectFilterFieldConfig
  | BooleanFilterFieldConfig;

/**
 * Interface for filter configuration
 */
export interface FilterConfig {
  /** Available fields for filtering */
  fields: FilterFieldConfig[];
}

/**
 * Helper to get a field configuration by ID
 */
export function getFieldById(
  config: FilterConfig,
  id: string,
): FilterFieldConfig | undefined {
  return config.fields.find((field) => field.id === id);
}
