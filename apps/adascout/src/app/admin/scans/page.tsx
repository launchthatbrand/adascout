"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import type { ColumnDefinition } from "@launchthatapp/ui/entity-list";
import { Badge } from "@launchthatapp/ui/badge";
import { Button } from "@launchthatapp/ui/button";
import { EntityList } from "@launchthatapp/ui/entity-list";

type ScanRow = Record<string, unknown> & {
  id: string;
  assetId: string;
  status: string;
  mode?: string;
  profile: string;
  findingCount?: number;
  totalPages?: number;
  completedPages?: number;
  failedPages?: number;
  createdAt: number;
  completedAt?: number;
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "default";
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    case "queued":
      return "outline";
    default:
      return "outline";
  }
};

const getStatusColorClass = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800";
    case "running":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
    case "queued":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
};

export default function ScansPage() {
  const scanRuns = useQuery(api.scans.listMyScanRuns, { limit: 300 });
  const assets = useQuery(api.assets.listMyAssets, { limit: 300 });
  const deleteScanRun = useMutation(api.scans.deleteMyScanRun);
  const [statusMessage, setStatusMessage] = useState("");
  const [deletingScanRunId, setDeletingScanRunId] = useState<string | null>(
    null,
  );

  const assetLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of assets ?? []) {
      map.set(
        String(asset._id),
        asset.title ?? asset.filename ?? asset.sourceUrl ?? String(asset._id),
      );
    }
    return map;
  }, [assets]);

  const rows = useMemo<ScanRow[]>(
    () =>
      (scanRuns ?? []).map((run) => ({
        id: String(run._id),
        assetId: String(run.assetId),
        status: run.status,
        mode: run.mode,
        profile: run.profile,
        findingCount: run.findingCount,
        totalPages: run.totalPages,
        completedPages: run.completedPages,
        failedPages: run.failedPages,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
      })),
    [scanRuns],
  );

  const columns = useMemo<ColumnDefinition<ScanRow>[]>(
    () => [
      {
        id: "id",
        header: "Scan",
        accessorKey: "id",
        minWidth: "140px",
        cell: (row: ScanRow) => (
          <Link
            href={`/admin/scans/${row.id}`}
            className="font-mono text-sm text-indigo-600 underline underline-offset-4 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {row.id.slice(0, 10)}...
          </Link>
        ),
      },
      {
        id: "asset",
        header: "Asset",
        accessorKey: "assetId",
        minWidth: "180px",
        cell: (row: ScanRow) => (
          <span className="text-sm">
            {assetLabelById.get(row.assetId) ?? row.assetId}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        minWidth: "100px",
        cell: (row: ScanRow) => (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColorClass(
              row.status,
            )}`}
          >
            {row.status}
          </span>
        ),
      },
      {
        id: "progress",
        header: "Progress",
        accessorKey: "completedPages",
        minWidth: "120px",
        cell: (row: ScanRow) => {
          if (typeof row.totalPages === "number") {
            return (
              <span className="text-sm">
                {row.completedPages ?? 0}/{row.totalPages}
                {typeof row.failedPages === "number" && row.failedPages > 0
                  ? ` (${row.failedPages} failed)`
                  : ""}
              </span>
            );
          }
          return <span className="text-muted-foreground text-sm">—</span>;
        },
      },
      {
        id: "findings",
        header: "Findings",
        accessorKey: "findingCount",
        minWidth: "80px",
        cell: (row: ScanRow) => (
          <span>
            {typeof row.findingCount === "number" ? row.findingCount : "—"}
          </span>
        ),
      },
      {
        id: "created",
        header: "Created",
        accessorKey: "createdAt",
        minWidth: "160px",
        cell: (row: ScanRow) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {new Date(row.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        minWidth: "120px",
        cell: (row: ScanRow) => (
          <div className="flex items-center">
            <Button
              size="sm"
              variant="destructive"
              disabled={deletingScanRunId === row.id}
              onClick={async () => {
                const confirmed = window.confirm(
                  "Delete this scan run and all related pages, findings, reports, and session leases?",
                );
                if (!confirmed) return;
                try {
                  setDeletingScanRunId(row.id);
                  await deleteScanRun({ scanRunId: row.id as Id<"scanRuns"> });
                  setStatusMessage("Scan run deleted.");
                } catch (error) {
                  setStatusMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to delete scan run.",
                  );
                } finally {
                  setDeletingScanRunId(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [assetLabelById, deleteScanRun, deletingScanRunId],
  );

  return (
    <section className="min-h-0 flex-1 p-4">
      <EntityList<ScanRow>
        data={rows}
        columns={columns}
        title="Scan Runs"
        description="Queued, running, and completed accessibility scans."
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        isLoading={scanRuns === undefined}
        getRowId={(row) => row.id}
      />
      {statusMessage ? (
        <p className="text-muted-foreground mt-3 text-xs" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
