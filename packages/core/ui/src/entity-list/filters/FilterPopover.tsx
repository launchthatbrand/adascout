"use client";

import type { Resolver } from "react-hook-form";
import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@acme/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@acme/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";

import {
  BooleanFilter,
  createDefaultBooleanFilterProps,
  createDefaultDateFilterProps,
  createDefaultNumberFilterProps,
  createDefaultSelectFilterProps,
  createDefaultTextFilterProps,
  DateFilter,
  FilterOperation,
  NumberFilter,
  SelectFilter,
  TextFilter,
} from "./";
import {
  FilterConfig,
  FilterDataType,
  FilterFieldConfig,
  getFieldById,
} from "./config";
import { formatFilterValue } from "./values";

/**
 * Schema for filter form
 */
const filterFormSchema = z.object({
  fieldId: z.string().min(1, { message: "Field is required" }),
  operation: z.string().min(1, { message: "Operation is required" }),
  value: z.any(),
});
const legacyFilterFormSchema = filterFormSchema as unknown as Parameters<
  typeof zodResolver
>[0];
const legacyResolver = zodResolver(
  legacyFilterFormSchema,
) as unknown as Resolver<FilterFormValues>;

/**
 * Type for filter form values
 */
type FilterFormValues = z.infer<typeof filterFormSchema>;

/**
 * Props for FilterPopover component
 */
export interface FilterPopoverProps {
  /** Filter configuration */
  config: FilterConfig;

  /** Callback when a new filter is added */
  onAddFilter: (
    fieldId: string,
    operation: FilterOperation,
    value: unknown,
  ) => void;

  /** Custom trigger element */
  trigger?: React.ReactNode;

  /** Existing filters to determine which fields are already filtered */
  existingFilters?: Array<{ fieldId: string }>;

  /** Custom CSS class */
  className?: string;
}

/**
 * FilterPopover component for adding new filters
 */
export function FilterPopover({
  config,
  onAddFilter,
  trigger,
  existingFilters = [],
  className = "",
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedFieldType, setSelectedFieldType] =
    useState<FilterDataType | null>(null);
  const formId = useId();

  // Create form
  const form = useForm<FilterFormValues>({
    resolver: legacyResolver,
    defaultValues: {
      fieldId: "",
      operation: "",
      value: undefined,
    },
  });

  // Get available fields (excluding those that can't have multiple filters)
  const availableFields = config.fields.filter((field) => {
    // If the field allows multiple filters, always include it
    if (field.allowMultiple) {
      return true;
    }

    // Otherwise, only include it if it's not already filtered
    return !existingFilters.some((filter) => filter.fieldId === field.id);
  });

  // Handle field selection
  const handleFieldChange = (fieldId: string) => {
    const field = getFieldById(config, fieldId);
    if (!field) return;

    // Set field type
    setSelectedFieldType(field.type);

    // Reset operation and value
    form.setValue("fieldId", fieldId);
    form.setValue("operation", "");
    form.setValue("value", undefined);
  };

  // Handle form submission
  const handleSubmit = (values: FilterFormValues) => {
    const { fieldId, operation, value } = values;

    // Only add filter if we have all required values
    if (fieldId && operation) {
      onAddFilter(fieldId, operation as FilterOperation, value);

      // Reset form and close popover
      form.reset();
      setSelectedFieldType(null);
      setOpen(false);
    }
  };

  // Render filter component based on field type
  const renderFilterComponent = (fieldConfig: FilterFieldConfig) => {
    const { type } = fieldConfig;
    const operation = form.watch("operation");

    switch (type) {
      case "text":
        return (
          <TextFilter
            {...createDefaultTextFilterProps(fieldConfig.id, fieldConfig.label)}
            operation={operation as FilterOperation}
            onOperationChange={(op) => form.setValue("operation", op)}
            value={form.watch("value") ?? ""}
            onValueChange={(val) => form.setValue("value", val)}
          />
        );

      case "number":
        return (
          <NumberFilter
            {...createDefaultNumberFilterProps(
              fieldConfig.id,
              fieldConfig.label,
            )}
            operation={operation as FilterOperation}
            onOperationChange={(op) => form.setValue("operation", op)}
            value={form.watch("value") ?? { value1: null, value2: null }}
            onValueChange={(val) => form.setValue("value", val)}
          />
        );

      case "date":
        return (
          <DateFilter
            {...createDefaultDateFilterProps(fieldConfig.id, fieldConfig.label)}
            operation={operation as FilterOperation}
            onOperationChange={(op) => form.setValue("operation", op)}
            value={form.watch("value") ?? { startDate: null, endDate: null }}
            onValueChange={(val) => form.setValue("value", val)}
          />
        );

      case "select":
        return (
          <SelectFilter
            {...createDefaultSelectFilterProps(
              fieldConfig.id,
              fieldConfig.label,
              (fieldConfig as any).options || [],
            )}
            operation={operation as FilterOperation}
            onOperationChange={(op) => form.setValue("operation", op)}
            value={form.watch("value") ?? ""}
            onValueChange={(val) => form.setValue("value", val)}
            options={(fieldConfig as any).options || []}
          />
        );

      case "boolean":
        return (
          <BooleanFilter
            {...createDefaultBooleanFilterProps(
              fieldConfig.id,
              fieldConfig.label,
            )}
            operation={operation as FilterOperation}
            onOperationChange={(op) => form.setValue("operation", op)}
            value={form.watch("value") ?? null}
            onValueChange={(val) => form.setValue("value", val)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-dashed"
          >
            Add filter
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className={`w-80 ${className}`} align="start">
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Add Filter</h4>
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-6 w-6 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <Form {...form}>
            <form
              id={formId}
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="fieldId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleFieldChange(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((fieldConfig) => (
                            <SelectItem
                              key={fieldConfig.id}
                              value={fieldConfig.id}
                            >
                              {fieldConfig.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />

              {selectedFieldType && form.watch("fieldId") && (
                <>
                  {renderFilterComponent(
                    getFieldById(config, form.watch("fieldId"))!,
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    form.reset();
                    setSelectedFieldType(null);
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Apply Filter
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
