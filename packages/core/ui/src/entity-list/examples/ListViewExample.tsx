"use client";

import { useState } from "react";
import { Edit, Trash } from "lucide-react";

import { Button } from "@acme/ui/button";

import type { ColumnDefinition, EntityAction, SortConfig } from "../types";
import { ListView } from "../ListView";

// Define the shape of our data
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  lastLogin: Date;
}

// Sample data
const users: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    role: "Admin",
    status: "active",
    lastLogin: new Date("2023-01-15T08:30:00"),
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "User",
    status: "active",
    lastLogin: new Date("2023-01-10T12:45:00"),
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob@example.com",
    role: "Editor",
    status: "inactive",
    lastLogin: new Date("2022-12-05T16:20:00"),
  },
  {
    id: "4",
    name: "Alice Williams",
    email: "alice@example.com",
    role: "User",
    status: "active",
    lastLogin: new Date("2023-01-18T09:15:00"),
  },
  {
    id: "5",
    name: "Charlie Brown",
    email: "charlie@example.com",
    role: "Editor",
    status: "inactive",
    lastLogin: new Date("2022-11-28T14:10:00"),
  },
];

export default function ListViewExample() {
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>({
    id: "name",
    direction: "asc",
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Column definitions
  const columns: ColumnDefinition<User>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sortable: true,
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
    },
    {
      id: "role",
      header: "Role",
      accessorKey: "role",
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => (
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            user.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {user.status}
        </span>
      ),
    },
    {
      id: "lastLogin",
      header: "Last Login",
      cell: (user) => user.lastLogin.toLocaleDateString(),
      sortable: true,
    },
  ];

  // Entity actions
  const entityActions: EntityAction<User>[] = [
    {
      id: "edit",
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (user) => {
        console.log("Edit user:", user);
        alert(`Edit user: ${user.name}`);
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash className="h-4 w-4" />,
      variant: "destructive",
      isDisabled: (user) => user.role === "Admin", // Disable for admins
      onClick: (user) => {
        console.log("Delete user:", user);
        alert(`Delete user: ${user.name}`);
      },
    },
  ];

  // Handle sort change
  const handleSortChange = (newSortConfig: SortConfig) => {
    setSortConfig(newSortConfig);
  };

  // Handle selection change
  const handleSelectionChange = (ids: string[]) => {
    setSelectedIds(ids);
  };

  // Handle bulk actions
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    alert(`Delete ${selectedIds.length} selected users`);
    setSelectedIds([]);
  };

  // View row details
  const handleRowClick = (user: User) => {
    console.log("View user details:", user);
    alert(`View details for: ${user.name}`);
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-2">
          <span className="text-sm font-medium">
            {selectedIds.length} items selected
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

      {/* ListView component */}
      <ListView
        data={users}
        columns={columns}
        onRowClick={handleRowClick}
        entityActions={entityActions}
        sortConfig={sortConfig}
        onSortChange={handleSortChange}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}
