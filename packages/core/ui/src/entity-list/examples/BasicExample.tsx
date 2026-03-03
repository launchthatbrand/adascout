"use client";

import { useState } from "react";
import { Edit, Trash } from "lucide-react";

import { Button } from "@acme/ui/button";

import type { ColumnDefinition, EntityAction, FilterConfig } from "../types";
import { EntityList } from "../EntityList";

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

export default function BasicExample() {
  // Pagination state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 3,
    pageCount: Math.ceil(users.length / 3),
  });

  // Calculate paginated data
  const paginatedData = users.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );

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
    },
  ];

  // Filter definitions
  const filters: FilterConfig<User>[] = [
    {
      id: "role",
      label: "Role",
      type: "select",
      options: [
        { label: "Admin", value: "Admin" },
        { label: "User", value: "User" },
        { label: "Editor", value: "Editor" },
      ],
      field: "role",
    },
    {
      id: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      field: "status",
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

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination({
      ...pagination,
      pageIndex: newPage,
    });
  };

  // View row details
  const handleRowClick = (user: User) => {
    console.log("View user details:", user);
    alert(`View details for: ${user.name}`);
  };

  return (
    <div className="container mx-auto p-4">
      <EntityList
        data={paginatedData}
        columns={columns}
        filters={filters}
        title="Users"
        description="Manage user accounts and permissions"
        viewModes={["list", "grid"]}
        defaultViewMode="list"
        onRowClick={handleRowClick}
        entityActions={entityActions}
        pagination={{
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          pageCount: pagination.pageCount,
          onPageChange: handlePageChange,
        }}
        actions={<Button>Add User</Button>}
      />
    </div>
  );
}
