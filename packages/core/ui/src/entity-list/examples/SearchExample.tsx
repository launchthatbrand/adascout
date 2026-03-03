"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";

import { Search } from "../Search";

export default function SearchExample() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<string[]>([
    "Apple",
    "Banana",
    "Cherry",
    "Date",
    "Elderberry",
    "Fig",
    "Grape",
    "Honeydew",
  ]);

  // Simulate a search with a delay
  const handleSearch = (value: string) => {
    setSearchTerm(value);

    if (value.trim() === "") {
      setResults([
        "Apple",
        "Banana",
        "Cherry",
        "Date",
        "Elderberry",
        "Fig",
        "Grape",
        "Honeydew",
      ]);
      return;
    }

    // Show loading state
    setIsSearching(true);

    // Simulate API call delay
    setTimeout(() => {
      // Filter the items based on the search term
      const filteredResults = [
        "Apple",
        "Banana",
        "Cherry",
        "Date",
        "Elderberry",
        "Fig",
        "Grape",
        "Honeydew",
      ].filter((item) => item.toLowerCase().includes(value.toLowerCase()));

      setResults(filteredResults);
      setIsSearching(false);
    }, 500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Search Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Search
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search fruits..."
            isSearching={isSearching}
            debounceMs={300}
            ariaLabel="Search fruits"
          />

          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">Results:</h3>

            {results.length > 0 ? (
              <ul className="space-y-1">
                {results.map((item) => (
                  <li
                    key={item}
                    className="rounded border p-2 transition-colors hover:bg-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No results found</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>Features demonstrated:</p>
        <ul className="list-inside list-disc">
          <li>Debounced input (300ms)</li>
          <li>Loading indicator during search</li>
          <li>Clear button when search has a value</li>
          <li>Accessible labeling</li>
        </ul>
      </div>
    </div>
  );
}
