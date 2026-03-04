"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { ColumnDefinition } from "@acme/ui/entity-list";
import { EntityList } from "@acme/ui/entity-list";
import { Button } from "@acme/ui/button";
import { Badge } from "@acme/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type PageRow = Record<string, unknown> & {
  id: string;
  url: string;
  status: string;
  attempt: number;
  findingCount?: number;
  updatedAt: number;
  errorMessage?: string;
};

export default function ScanDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const scanRunIdParam = params.scanRunId;
  const scanRunId =
    typeof scanRunIdParam === "string" ? (scanRunIdParam as Id<"scanRuns">) : undefined;
  const scanRun = useQuery(
    api.scans.getMyScanRun,
    scanRunId ? { scanRunId } : "skip",
  );
  const findings = useQuery(
    api.findings.listMyFindingsByScanRun,
    scanRunId ? { scanRunId, limit: 1000 } : "skip",
  );
  const report = useQuery(
    api.reports.getMyReportByScanRun,
    scanRunId ? { scanRunId } : "skip",
  );
  const pageRuns = useQuery(
    api.scans.listMyScanRunPages,
    scanRunId ? { scanRunId, limit: 2000 } : "skip",
  );
  const rerunScan = useMutation(api.scans.rerunScan);
  const cancelScanRun = useMutation(api.scans.cancelMyScanRun);
  const deleteScanRun = useMutation(api.scans.deleteMyScanRun);
  const rerunSelectedPages = useMutation(api.scans.rerunSelectedPages);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [selectedPageRunId, setSelectedPageRunId] = useState<string | null>(null);
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      info: 0,
    };
    for (const finding of findings ?? []) {
      groups[finding.severity] += 1;
    }
    return groups;
  }, [findings]);

  const pageRows = useMemo<PageRow[]>(
    () =>
      (pageRuns ?? []).map((row) => ({
        id: String(row._id),
        url: row.pageUrl,
        status: row.status,
        attempt: row.attempt,
        findingCount: row.findingCount,
        updatedAt: row.updatedAt,
        errorMessage: row.errorMessage,
      })),
    [pageRuns],
  );
  const selectedPageFindings = useQuery(
    api.findings.listMyFindingsByScanRun,
    scanRunId && selectedPageRunId
      ? { scanRunId, scanRunPageId: selectedPageRunId as Id<"scanRunPages">, limit: 500 }
      : "skip",
  );

  const pageColumns = useMemo<ColumnDefinition<PageRow>[]>(
    () => [
      {
        id: "url",
        header: "Page URL",
        accessorKey: "url",
        cell: (row: PageRow) => (
          <button
            type="button"
            onClick={() => {
              setSelectedPageRunId(row.id);
              setSelectedPageUrl(row.url);
            }}
            className="break-all underline underline-offset-4"
          >
            {row.url}
          </button>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
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
        cell: (row: PageRow) => (typeof row.findingCount === "number" ? row.findingCount : "—"),
      },
      {
        id: "updated",
        header: "Updated",
        accessorKey: "updatedAt",
        cell: (row: PageRow) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.updatedAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "error",
        header: "Error",
        accessorKey: "errorMessage",
        cell: (row: PageRow) =>
          row.errorMessage ? (
            <span className="text-destructive text-xs">{row.errorMessage}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: PageRow) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/scans/${scanRunId}/pages/${row.id}`}>View</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={row.url} target="_blank" rel="noopener noreferrer">
                Visit
              </a>
            </Button>
          </div>
        ),
      },
    ],
    [scanRunId],
  );

  if (!scanRunId) {
    return (
      <section className="p-4">
        <p className="text-sm">Invalid scan run id.</p>
      </section>
    );
  }

  if (scanRun === null) {
    return (
      <section className="p-4">
        <p className="text-sm">Scan not found.</p>
      </section>
    );
  }

  return (
    <section className="w-full space-y-4 p-4">
      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Scan run</p>
            <h1 className="text-xl font-semibold">{scanRunId}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Status: {scanRun?.status ?? "loading..."} · Profile: {scanRun?.profile ?? "wcag_2_2_aa"}
            </p>
            {typeof scanRun?.totalPages === "number" ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Page progress: {scanRun.completedPages ?? 0}/{scanRun.totalPages}
                {typeof scanRun.failedPages === "number" && scanRun.failedPages > 0
                  ? ` (${scanRun.failedPages} failed)`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {report ? (
              <Button variant="outline" asChild>
                <Link href={`/admin/reports/${String(report._id)}`}>Open Report</Link>
              </Button>
            ) : null}
            <Button
              onClick={async () => {
                try {
                  const newRunId = await rerunScan({ scanRunId });
                  setStatusMessage(`Re-run queued: ${String(newRunId)}`);
                } catch (error) {
                  setStatusMessage(error instanceof Error ? error.message : "Failed to rerun scan.");
                }
              }}
            >
              Re-run Scan
            </Button>
            {scanRun?.status === "queued" || scanRun?.status === "running" ? (
              <Button
                variant="outline"
                disabled={isStopping}
                onClick={async () => {
                  try {
                    setIsStopping(true);
                    const result = await cancelScanRun({ scanRunId });
                    setStatusMessage(`Scan stop requested. Canceled ${result.canceledPages} page(s).`);
                  } catch (error) {
                    setStatusMessage(error instanceof Error ? error.message : "Failed to stop scan.");
                  } finally {
                    setIsStopping(false);
                  }
                }}
              >
                Stop Scan
              </Button>
            ) : null}
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                const confirmed = window.confirm(
                  "Delete this scan run and all related pages, findings, reports, and session leases?",
                );
                if (!confirmed) return;
                try {
                  setIsDeleting(true);
                  await deleteScanRun({ scanRunId });
                  router.push("/admin/scans");
                } catch (error) {
                  setStatusMessage(error instanceof Error ? error.message : "Failed to delete scan run.");
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              Delete Scan
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {Object.entries(grouped).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border/60 bg-background p-3">
            <p className="text-muted-foreground text-xs uppercase">{key}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4">
        <EntityList<PageRow>
          data={pageRows}
          columns={pageColumns}
          title="Pages"
          description="Each URL is scanned independently for better progress visibility."
          enableSearch
          defaultViewMode="list"
          viewModes={[]}
          isLoading={pageRuns === undefined}
          enableRowSelection
          getRowId={(row) => row.id}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const queuedCount = await rerunSelectedPages({ scanRunId, onlyFailed: true });
                    setStatusMessage(`Queued ${queuedCount} failed page rerun(s).`);
                  } catch (error) {
                    setStatusMessage(
                      error instanceof Error ? error.message : "Failed to rerun failed pages.",
                    );
                  }
                }}
              >
                Rerun Failed
              </Button>
            </div>
          }
          bulkActions={({ selectedItems, clearSelection }) => (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const queuedCount = await rerunSelectedPages({
                      scanRunId,
                      pageRunIds: selectedItems.map((item) => item.id as Id<"scanRunPages">),
                    });
                    setStatusMessage(`Queued ${queuedCount} selected page rerun(s).`);
                    clearSelection();
                  } catch (error) {
                    setStatusMessage(
                      error instanceof Error ? error.message : "Failed to rerun selected pages.",
                    );
                  }
                }}
              >
                Rerun Selected ({selectedItems.length})
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            </div>
          )}
        />
      </div>

      {statusMessage ? (
        <p className="text-muted-foreground text-xs" role="status">
          {statusMessage}
        </p>
      ) : null}

      <Dialog
        open={Boolean(selectedPageRunId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPageRunId(null);
            setSelectedPageUrl(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Page Findings</DialogTitle>
            <DialogDescription className="break-all">
              {selectedPageUrl ?? "Selected page"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(selectedPageFindings ?? []).map((finding) => (
              <article key={String(finding._id)} className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{finding.title}</p>
                  <Badge variant={finding.severity === "critical" || finding.severity === "serious" ? "destructive" : "outline"}>
                    {finding.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  Rule: {finding.ruleId}
                  {finding.target ? ` · Target: ${finding.target}` : ""}
                </p>
                {finding.description ? <p className="text-sm">{finding.description}</p> : null}
                {finding.helpUrl ? (
                  <a
                    href={finding.helpUrl}
                    className="text-sm underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Learn more
                  </a>
                ) : null}
              </article>
            ))}
            {selectedPageFindings?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No findings were recorded for this page.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

