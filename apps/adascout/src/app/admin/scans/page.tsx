"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { ColumnDefinition } from "@acme/ui/entity-list";
import { EntityList } from "@acme/ui/entity-list";
import { Button } from "@acme/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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

export default function ScansPage() {
  const scanRuns = useQuery(api.scans.listMyScanRuns, { limit: 300 });
  const assets = useQuery(api.assets.listMyAssets, { limit: 300 });
  const deleteScanRun = useMutation(api.scans.deleteMyScanRun);
  const [statusMessage, setStatusMessage] = useState("");
  const [deletingScanRunId, setDeletingScanRunId] = useState<string | null>(null);

  const assetLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of assets ?? []) {
      map.set(String(asset._id), asset.title ?? asset.filename ?? asset.sourceUrl ?? String(asset._id));
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
        cell: (row: ScanRow) => (
          <Link href={`/admin/scans/${row.id}`} className="font-medium underline underline-offset-4">
            {row.id.slice(0, 10)}...
          </Link>
        ),
      },
      {
        id: "asset",
        header: "Asset",
        accessorKey: "assetId",
        cell: (row: ScanRow) => (
          <span className="text-sm">{assetLabelById.get(row.assetId) ?? row.assetId}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
      },
      {
        id: "progress",
        header: "Progress",
        accessorKey: "completedPages",
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
        cell: (row: ScanRow) => <span>{typeof row.findingCount === "number" ? row.findingCount : "—"}</span>,
      },
      {
        id: "created",
        header: "Created",
        accessorKey: "createdAt",
        cell: (row: ScanRow) => (
          <span className="text-muted-foreground text-xs">{new Date(row.createdAt).toLocaleString()}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: ScanRow) => (
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
                setStatusMessage(error instanceof Error ? error.message : "Failed to delete scan run.");
              } finally {
                setDeletingScanRunId(null);
              }
            }}
          >
            Delete
          </Button>
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

