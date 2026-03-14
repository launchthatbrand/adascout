"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import type { ColumnDefinition } from "@acme/ui/entity-list";
import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { EntityList } from "@acme/ui/entity-list";

type ScanRow = Record<string, unknown> & {
  id: string;
  status: string;
  createdAt: number;
  findingCount?: number;
  totalPages?: number;
  completedPages?: number;
  failedPages?: number;
};

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
};

type FindingRow = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  severityRank: number;
  source: "axe" | "ibm" | "pdf" | "stagehand";
  ruleId: string;
  pageUrl?: string;
  target?: string;
  description?: string;
  helpUrl?: string;
};

export default function AssetScansPage() {
  const severityRank = (severity: FindingRow["severity"]) => {
    if (severity === "critical") return 5;
    if (severity === "serious") return 4;
    if (severity === "moderate") return 3;
    if (severity === "minor") return 2;
    return 1;
  };

  const params = useParams();
  const assetIdParam = params.assetId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;

  const scanRuns = useQuery(
    api.scans.listMyScanRuns,
    assetId ? { assetId, limit: 300 } : "skip",
  );
  const [selectedScanRunId, setSelectedScanRunId] =
    useState<Id<"scanRuns"> | null>(null);
  const [selectedPageRunId, setSelectedPageRunId] =
    useState<Id<"scanRunPages"> | null>(null);
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);

  const effectiveScanRunId = useMemo<Id<"scanRuns"> | null>(() => {
    if (selectedScanRunId) return selectedScanRunId;
    const latest = scanRuns?.[0];
    return latest ? (latest._id as Id<"scanRuns">) : null;
  }, [scanRuns, selectedScanRunId]);

  const pageRuns = useQuery(
    api.scans.listMyScanRunPages,
    effectiveScanRunId
      ? { scanRunId: effectiveScanRunId, limit: 2000 }
      : "skip",
  );
  const selectedPageFindings = useQuery(
    api.findings.listMyFindingsByScanRun,
    effectiveScanRunId && selectedPageRunId
      ? {
          scanRunId: effectiveScanRunId,
          scanRunPageId: selectedPageRunId,
          limit: 500,
        }
      : "skip",
  );
  const selectedPageFindingsSorted = useMemo(
    () =>
      [...(selectedPageFindings ?? [])].sort(
        (a, b) => severityRank(b.severity) - severityRank(a.severity),
      ),
    [selectedPageFindings],
  );

  const scanRows = useMemo<ScanRow[]>(
    () =>
      (scanRuns ?? []).map((run) => ({
        id: String(run._id),
        status: run.status,
        createdAt: run.createdAt,
        findingCount: run.findingCount,
        totalPages: run.totalPages,
        completedPages: run.completedPages,
        failedPages: run.failedPages,
      })),
    [scanRuns],
  );

  const columns = useMemo<ColumnDefinition<ScanRow>[]>(
    () => [
      {
        id: "scan",
        header: "Scan",
        accessorKey: "id",
        cell: (row: ScanRow) => (
          <button
            type="button"
            className="font-medium underline underline-offset-4"
            onClick={() => setSelectedScanRunId(row.id as Id<"scanRuns">)}
          >
            {row.id.slice(0, 12)}...
          </button>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        sortable: true,
        cell: (row: ScanRow) => {
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
      {
        id: "progress",
        header: "Progress",
        accessorKey: "completedPages",
        cell: (row: ScanRow) =>
          typeof row.totalPages === "number" ? (
            <span className="text-sm">
              {row.completedPages ?? 0}/{row.totalPages}
              {typeof row.failedPages === "number" && row.failedPages > 0
                ? ` (${row.failedPages} failed)`
                : ""}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          ),
      },
      {
        id: "findings",
        header: "Findings",
        accessorKey: "findingCount",
        cell: (row: ScanRow) =>
          typeof row.findingCount === "number" ? row.findingCount : "—",
      },
      {
        id: "created",
        header: "Created",
        accessorKey: "createdAt",
        sortable: true,
        cell: (row: ScanRow) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: ScanRow) => (
          <Link
            className="text-sm underline underline-offset-4"
            href={`/admin/scans/${row.id}`}
          >
            Open Scan
          </Link>
        ),
      },
    ],
    [],
  );

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
        retryCount: row.retryCount,
        terminalErrorCategory: row.terminalErrorCategory,
      })),
    [pageRuns],
  );
  const selectedScanLabel = effectiveScanRunId
    ? String(effectiveScanRunId)
    : "No scan selected";

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
              setSelectedPageRunId(row.id as Id<"scanRunPages">);
              setSelectedPageUrl(row.url);
            }}
            className="text-left break-all underline underline-offset-4"
          >
            {row.url}
          </button>
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
              <Link
                href={`/admin/scans/${String(effectiveScanRunId ?? "")}/pages/${row.id}`}
              >
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
    [effectiveScanRunId],
  );

  return (
    <>
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <EntityList<ScanRow>
          data={scanRows}
          columns={columns}
          title="Scans"
          description="Select a scan to inspect findings for this asset."
          defaultViewMode="list"
          viewModes={[]}
          enableSearch
          isLoading={scanRuns === undefined}
          getRowId={(row) => row.id}
        />
      </div>

      {effectiveScanRunId && (
        <div className="border-border/60 bg-background rounded-xl border p-4">
          <EntityList<PageRow>
            data={pageRows}
            columns={pageColumns}
            title="Pages"
            description={`Pages for scan ${selectedScanLabel}. Click Page URL to inspect findings in a dialog.`}
            defaultViewMode="list"
            viewModes={[]}
            enableSearch
            isLoading={pageRuns === undefined}
            getRowId={(row) => row.id}
          />
        </div>
      )}

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
            {selectedPageFindingsSorted.map((finding) => (
              <article
                key={String(finding._id)}
                className="border-border/60 space-y-2 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{finding.title}</p>
                  <Badge
                    variant={
                      finding.severity === "critical" ||
                      finding.severity === "serious"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {finding.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  Rule: {finding.ruleId}
                  {finding.target ? ` · Target: ${finding.target}` : ""}
                </p>
                {finding.evidenceHash ? (
                  <p className="text-muted-foreground text-xs">
                    evidence: {finding.evidenceHash.slice(0, 24)}…
                  </p>
                ) : null}
                {finding.description ? (
                  <p className="text-sm">{finding.description}</p>
                ) : null}
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
            {selectedPageFindingsSorted.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No findings were recorded for this page.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
