"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/tabs";

import {
  BaseFilterProps,
  BooleanFilter,
  DateFilter,
  FilterOperation,
  NumberFilter,
  SelectFilter,
  SelectFilterProps,
  TextFilter,
} from "../filters";

export default function FilterTypesExample() {
  // Text filter state
  const [textFilterOperation, setTextFilterOperation] =
    useState<FilterOperation>("contains");
  const [textFilterValue, setTextFilterValue] = useState<string>("");

  // Number filter state
  const [numberFilterOperation, setNumberFilterOperation] =
    useState<FilterOperation>("equals");
  const [numberFilterValue, setNumberFilterValue] = useState<{
    value1: number | null;
    value2: number | null;
  }>({
    value1: null,
    value2: null,
  });

  // Date filter state
  const [dateFilterOperation, setDateFilterOperation] =
    useState<FilterOperation>("equals");
  const [dateFilterValue, setDateFilterValue] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({
    startDate: null,
    endDate: null,
  });

  // Select filter state
  const [selectFilterOperation, setSelectFilterOperation] =
    useState<FilterOperation>("equals");
  const [selectFilterValue, setSelectFilterValue] = useState<string>("");

  // Boolean filter state
  const [booleanFilterOperation, setBooleanFilterOperation] =
    useState<FilterOperation>("equals");
  const [booleanFilterValue, setBooleanFilterValue] = useState<boolean | null>(
    null,
  );

  // Sample data for select filter
  const selectOptions = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana" },
    { value: "cherry", label: "Cherry" },
    { value: "orange", label: "Orange" },
  ];

  return (
    <div className="space-y-4">
      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="text">Text Filter</TabsTrigger>
          <TabsTrigger value="number">Number Filter</TabsTrigger>
          <TabsTrigger value="date">Date Filter</TabsTrigger>
          <TabsTrigger value="select">Select Filter</TabsTrigger>
          <TabsTrigger value="boolean">Boolean Filter</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Text Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TextFilter
                id="text-filter"
                label="Product Name"
                operation={textFilterOperation}
                operations={[
                  { id: "contains", label: "Contains" },
                  { id: "equals", label: "Equals" },
                  { id: "startsWith", label: "Starts with" },
                  { id: "endsWith", label: "Ends with" },
                  { id: "empty", label: "Is empty" },
                  { id: "notEmpty", label: "Is not empty" },
                ]}
                value={textFilterValue}
                onOperationChange={setTextFilterOperation}
                onValueChange={setTextFilterValue}
              />

              <div className="mt-4 rounded-md bg-muted p-4">
                <h3 className="mb-2 font-medium">Current Filter:</h3>
                <pre className="text-sm">
                  {JSON.stringify(
                    {
                      operation: textFilterOperation,
                      value: textFilterValue,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="number" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Number Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NumberFilter
                id="number-filter"
                label="Price"
                operation={numberFilterOperation}
                operations={[
                  { id: "equals", label: "Equals" },
                  { id: "notEquals", label: "Does not equal" },
                  { id: "greaterThan", label: "Greater than" },
                  { id: "lessThan", label: "Less than" },
                  { id: "between", label: "Between" },
                ]}
                value={numberFilterValue}
                onOperationChange={setNumberFilterOperation}
                onValueChange={setNumberFilterValue}
              />

              <div className="mt-4 rounded-md bg-muted p-4">
                <h3 className="mb-2 font-medium">Current Filter:</h3>
                <pre className="text-sm">
                  {JSON.stringify(
                    {
                      operation: numberFilterOperation,
                      value: numberFilterValue,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="date" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Date Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DateFilter
                id="date-filter"
                label="Created At"
                operation={dateFilterOperation}
                operations={[
                  { id: "equals", label: "On" },
                  { id: "before", label: "Before" },
                  { id: "after", label: "After" },
                  { id: "between", label: "Between" },
                  { id: "isEmpty", label: "Is empty" },
                  { id: "isNotEmpty", label: "Is not empty" },
                ]}
                value={dateFilterValue}
                onOperationChange={setDateFilterOperation}
                onValueChange={setDateFilterValue}
              />

              <div className="mt-4 rounded-md bg-muted p-4">
                <h3 className="mb-2 font-medium">Current Filter:</h3>
                <pre className="text-sm">
                  {JSON.stringify(
                    {
                      operation: dateFilterOperation,
                      value: dateFilterValue,
                    },
                    (key, value) => {
                      // Convert Date objects to strings for display
                      if (value instanceof Date) {
                        return value.toISOString();
                      }
                      return value;
                    },
                    2,
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="select" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SelectFilter
                id="select-filter"
                label="Category"
                operation={selectFilterOperation}
                operations={[
                  { id: "equals", label: "Is" },
                  { id: "notEquals", label: "Is not" },
                  { id: "isEmpty", label: "Is empty" },
                  { id: "isNotEmpty", label: "Is not empty" },
                ]}
                value={selectFilterValue}
                options={selectOptions}
                onOperationChange={setSelectFilterOperation}
                onValueChange={setSelectFilterValue}
              />

              <div className="mt-4 rounded-md bg-muted p-4">
                <h3 className="mb-2 font-medium">Current Filter:</h3>
                <pre className="text-sm">
                  {JSON.stringify(
                    {
                      operation: selectFilterOperation,
                      value: selectFilterValue,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boolean" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Boolean Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BooleanFilter
                id="boolean-filter"
                label="Is Active"
                operation={booleanFilterOperation}
                operations={[{ id: "equals", label: "Is" }]}
                value={booleanFilterValue}
                onOperationChange={setBooleanFilterOperation}
                onValueChange={setBooleanFilterValue}
              />

              <div className="mt-4 rounded-md bg-muted p-4">
                <h3 className="mb-2 font-medium">Current Filter:</h3>
                <pre className="text-sm">
                  {JSON.stringify(
                    {
                      operation: booleanFilterOperation,
                      value: booleanFilterValue,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
