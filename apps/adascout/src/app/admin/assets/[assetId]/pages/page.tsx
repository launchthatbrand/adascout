"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import type { ColumnDefinition } from "@acme/ui/entity-list";
import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import { EntityList } from "@acme/ui/entity-list";

type PageRow = Record<string, unknown> & {
  id: string;
  url: string;
  status: string;
  attempt: number;
  findingCount?: number;
  updatedAt: number;
  errorMessage?: string;
  retryCount?: number;
  terminalErrorCategory?: string;
  scanRunId: string;
};

export default function AssetPagesPage() {
  const params = useParams();
  const assetIdParam = params.assetId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;

  const allPages = useQuery(
    api.scans.listMyScanRunPagesByAsset,
    assetId ? { assetId, limit: 2000 } : "skip",
  );

  const pageRows = useMemo<PageRow[]>(
    () =>
      (allPages ?? []).map((row) => ({
        id: String(row._id),
        url: row.pageUrl,
        status: row.status,
        attempt: row.attempt,
        findingCount: row.findingCount,
        updatedAt: row.updatedAt,
        errorMessage: row.errorMessage,
        retryCount: row.retryCount,
        terminalErrorCategory: row.terminalErrorCategory,
        scanRunId: String(row.scanRunId),
      })),
    [allPages],
  );

  const pageColumns = useMemo<ColumnDefinition<PageRow>[]>(
    () => [
      {
        id: "url",
        header: "Page URL",
        accessorKey: "url",
        cell: (row: PageRow) => (
          <Link
            href={`/admin/assets/${assetId}/pages/${row.id}`}
            className="text-left break-all underline underline-offset-4"
          >
            {row.url}
          </Link>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        sortable: true,
        cell: (row: PageRow) => {
          const variant =
            row.status === "failed"
              ? "destructive"
              : row.status === "completed"
                ? "default"
                : row.status === "running"
                  ? "secondary"
                  : "outline";
          return <Badge variant={variant}>{row.status}</Badge>;
        },
      },
      { id: "attempt", header: "Attempt", accessorKey: "attempt" },
      {
        id: "findings",
        header: "Findings",
        accessorKey: "findingCount",
        cell: (row: PageRow) =>
          typeof row.findingCount === "number" ? row.findingCount : "—",
      },
      {
        id: "retryCount",
        header: "Retries",
        accessorKey: "retryCount",
        cell: (row: PageRow) => row.retryCount ?? 0,
      },
      {
        id: "scanRunId",
        header: "Scan ID",
        accessorKey: "scanRunId",
        cell: (row: PageRow) => (
          <span className="text-muted-foreground text-xs">
            {row.scanRunId.slice(0, 12)}...
          </span>
        ),
      },
      {
        id: "updated",
        header: "Updated",
        accessorKey: "updatedAt",
        sortable: true,
        cell: (row: PageRow) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.updatedAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: PageRow) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/assets/${assetId}/pages/${row.id}`}>
                View
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={row.url} target="_blank" rel="noopener noreferrer">
                Visit
              </a>
            </Button>
          </div>
        ),
      },
      {
        id: "error",
        header: "Error",
        accessorKey: "errorMessage",
        cell: (row: PageRow) =>
          row.errorMessage ? (
            <span className="text-destructive text-xs">
              {row.terminalErrorCategory
                ? `[${row.terminalErrorCategory}] `
                : ""}
              {row.errorMessage}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
    ],
    [assetId],
  );

  return (
    <div className="border-border/60 bg-background rounded-xl border p-4">
      <EntityList<PageRow>
        data={pageRows}
        columns={pageColumns}
        title="All Pages"
        description="All pages scanned for this asset across all scans."
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        isLoading={allPages === undefined}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
