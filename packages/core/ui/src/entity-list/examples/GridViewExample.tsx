"use client";

import { useState } from "react";
import { Edit, Star, Trash } from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

import type { ColumnDefinition, EntityAction } from "../types";
import { GridView } from "../GridView";

// Define the shape of our data
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  featured: boolean;
}

// Sample data
const products: Product[] = [
  {
    id: "1",
    name: "Premium Headphones",
    category: "Electronics",
    price: 129.99,
    stock: 45,
    rating: 4.5,
    featured: true,
  },
  {
    id: "2",
    name: "Wireless Keyboard",
    category: "Electronics",
    price: 59.99,
    stock: 23,
    rating: 4.2,
    featured: false,
  },
  {
    id: "3",
    name: "Ergonomic Mouse",
    category: "Electronics",
    price: 39.99,
    stock: 56,
    rating: 3.9,
    featured: false,
  },
  {
    id: "4",
    name: "4K Monitor",
    category: "Electronics",
    price: 349.99,
    stock: 12,
    rating: 4.8,
    featured: true,
  },
  {
    id: "5",
    name: "USB-C Hub",
    category: "Accessories",
    price: 49.99,
    stock: 78,
    rating: 4.1,
    featured: false,
  },
  {
    id: "6",
    name: "Laptop Stand",
    category: "Accessories",
    price: 29.99,
    stock: 34,
    rating: 4.3,
    featured: false,
  },
];

export default function GridViewExample() {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Column definitions
  const columns: ColumnDefinition<Product>[] = [
    {
      id: "name",
      header: "Product",
      accessorKey: "name",
      cell: (product) => (
        <div className="flex items-center gap-2">
          {product.featured && <Star className="h-4 w-4 text-yellow-500" />}
          {product.name}
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      cell: (product) => <Badge variant="outline">{product.category}</Badge>,
    },
    {
      id: "price",
      header: "Price",
      cell: (product) => (
        <span className="font-medium">${product.price.toFixed(2)}</span>
      ),
    },
    {
      id: "stock",
      header: "Stock",
      accessorKey: "stock",
      cell: (product) => (
        <span className={product.stock < 20 ? "text-red-500" : ""}>
          {product.stock} units
        </span>
      ),
    },
    {
      id: "rating",
      header: "Rating",
      accessorKey: "rating",
      cell: (product) => (
        <div className="flex items-center">
          <span className="mr-1">{product.rating}</span>
          <Star className="h-4 w-4 fill-current text-yellow-500" />
        </div>
      ),
    },
  ];

  // Entity actions
  const entityActions: EntityAction<Product>[] = [
    {
      id: "edit",
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (product) => {
        console.log("Edit product:", product);
        alert(`Edit product: ${product.name}`);
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash className="h-4 w-4" />,
      variant: "destructive",
      isDisabled: (product) => product.stock > 0, // Can't delete products with stock
      onClick: (product) => {
        console.log("Delete product:", product);
        alert(`Delete product: ${product.name}`);
      },
    },
  ];

  // Handle selection change
  const handleSelectionChange = (ids: string[]) => {
    setSelectedIds(ids);
  };

  // Handle bulk actions
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    alert(`Delete ${selectedIds.length} selected products`);
    setSelectedIds([]);
  };

  // View product details
  const handleCardClick = (product: Product) => {
    console.log("View product details:", product);
    alert(`View details for: ${product.name}`);
  };

  // Custom grid columns configuration
  const gridColumns = {
    sm: 1,
    md: 2,
    lg: 3,
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-2">
          <span className="text-sm font-medium">
            {selectedIds.length} products selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteSelected}
          >
            Delete Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* GridView component */}
      <GridView
        data={products}
        columns={columns}
        onCardClick={handleCardClick}
        entityActions={entityActions}
        gridColumns={gridColumns}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}
