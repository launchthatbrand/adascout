"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";

import type { ColumnDefinition } from "@acme/ui/entity-list";
import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import { EntityList } from "@acme/ui/entity-list";

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
  assignee?: string;
  dueAt?: number;
};

export default function PageDetailPage() {
  const severityRank = (severity: FindingRow["severity"]) => {
    if (severity === "critical") return 5;
    if (severity === "serious") return 4;
    if (severity === "moderate") return 3;
    if (severity === "minor") return 2;
    return 1;
  };

  const params = useParams();
  const assetIdParam = params.assetId;
  const pageIdParam = params.pageId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;
  const pageId =
    typeof pageIdParam === "string"
      ? (pageIdParam as Id<"scanRunPages">)
      : undefined;

  const page = useQuery(
    api.scans.getMyScanRunPage,
    pageId ? { pageId } : "skip",
  );
  const createScanRun = useMutation(api.scans.createScanRun);
  const updateFindingStatus = useMutation(api.findings.updateMyFindingStatus);
  const assignFinding = useMutation(api.findings.assignMyFinding);
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState("");
  const actor = useQuery(api.findings.getMyFindingActor, {}) as
    | { userId: Id<"users"> }
    | undefined;

  const findings = useQuery(
    api.findings.listMyFindingsByScanRun,
    page?.scanRunId && pageId
      ? {
          scanRunId: page.scanRunId,
          scanRunPageId: pageId,
          limit: 500,
        }
      : "skip",
  );

  const findingRows = useMemo<FindingRow[]>(
    () =>
      (findings ?? []).map((finding) => ({
        id: String(finding._id),
        title: finding.title,
        status: finding.status ?? "open",
        severity: finding.severity,
        severityRank: severityRank(finding.severity),
        source: finding.source,
        ruleId: finding.ruleId,
        pageUrl: finding.pageUrl,
        target: finding.target,
        description: finding.description,
        helpUrl: finding.helpUrl,
        assignee: finding.assignee ? String(finding.assignee) : undefined,
        dueAt: finding.dueAt,
      })),
    [findings],
  );

  const findingColumns = useMemo<ColumnDefinition<FindingRow>[]>(
    () => [
      { id: "title", header: "Title", accessorKey: "title" },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        sortable: true,
        cell: (row: FindingRow) => (
          <Badge
            variant={
              row.status === "resolved" || row.status === "verified_on_rescan"
                ? "default"
                : row.status === "regressed"
                  ? "destructive"
                  : "secondary"
            }
          >
            {row.status}
          </Badge>
        ),
      },
      {
        id: "severity",
        header: "Severity",
        accessorKey: "severityRank",
        sortable: true,
        cell: (row: FindingRow) => (
          <Badge
            variant={
              row.severity === "critical" || row.severity === "serious"
                ? "destructive"
                : "outline"
            }
          >
            {row.severity}
          </Badge>
        ),
      },
      { id: "ruleId", header: "Rule", accessorKey: "ruleId" },
      {
        id: "target",
        header: "Target",
        accessorKey: "target",
        sortable: true,
        cell: (row: FindingRow) => (
          <span className="text-sm">{row.target ?? "—"}</span>
        ),
      },
      {
        id: "assignee",
        header: "Assignee",
        accessorKey: "assignee",
        sortable: true,
        cell: (row: FindingRow) => (
          <span className="text-sm">
            {row.assignee ? `${row.assignee.slice(0, 10)}...` : "—"}
          </span>
        ),
      },
      {
        id: "dueAt",
        header: "Due",
        accessorKey: "dueAt",
        sortable: true,
        cell: (row: FindingRow) => (
          <span className="text-sm">
            {row.dueAt ? new Date(row.dueAt).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        id: "source",
        header: "Source",
        accessorKey: "source",
        sortable: true,
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: FindingRow) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/assets/${assetId}/findings/${row.id}`}>
                View
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void updateFindingStatus({
                  findingId: row.id as Id<"findings">,
                  status: "in_progress",
                })
              }
            >
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void updateFindingStatus({
                  findingId: row.id as Id<"findings">,
                  status: "resolved",
                })
              }
            >
              Resolve
            </Button>
            {actor?.userId ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void assignFinding({
                    findingId: row.id as Id<"findings">,
                    assignee: actor.userId,
                  })
                }
              >
                Assign Me
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [actor?.userId, assignFinding, updateFindingStatus, assetId],
  );

  if (page === undefined) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Loading page...</p>
      </div>
    );
  }

  if (page === null) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Page not found.</p>
        {assetId && (
          <Link
            href={`/admin/assets/${assetId}/pages`}
            className="mt-2 inline-block text-sm underline underline-offset-4"
          >
            Back to Pages
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/assets/${assetId}/pages`}
            className="text-sm underline underline-offset-4"
          >
            Back to Pages
          </Link>
        </div>
      </div>

      <div className="border-border/60 bg-background rounded-xl border p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                Page
              </p>
              <h1 className="text-2xl font-semibold break-all">
                {page.pageUrl}
              </h1>
            </div>
            <Badge
              variant={
                page.status === "failed"
                  ? "destructive"
                  : page.status === "completed"
                    ? "default"
                    : page.status === "running"
                      ? "secondary"
                      : "outline"
              }
            >
              {page.status}
            </Badge>
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Page URL</p>
              <a
                href={page.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium break-all underline underline-offset-4"
              >
                {page.pageUrl}
              </a>
            </div>
            <div>
              <p className="text-muted-foreground">Scan ID</p>
              <p className="font-medium">
                {String(page.scanRunId).slice(0, 12)}...
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Attempt</p>
              <p className="font-medium">{page.attempt}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Findings</p>
              <p className="font-medium">
                {typeof page.findingCount === "number" ? page.findingCount : 0}
              </p>
            </div>
            {page.retryCount !== undefined && page.retryCount > 0 && (
              <div>
                <p className="text-muted-foreground">Retries</p>
                <p className="font-medium">{page.retryCount}</p>
              </div>
            )}
            {page.startedAt && (
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium">
                  {new Date(page.startedAt).toLocaleString()}
                </p>
              </div>
            )}
            {page.completedAt && (
              <div>
                <p className="text-muted-foreground">Completed</p>
                <p className="font-medium">
                  {new Date(page.completedAt).toLocaleString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p className="font-medium">
                {new Date(page.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {page.errorMessage && (
            <div>
              <p className="text-muted-foreground text-sm">Error</p>
              <p className="text-destructive mt-1">
                {page.terminalErrorCategory
                  ? `[${page.terminalErrorCategory}] `
                  : ""}
                {page.errorMessage}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" asChild>
              <a href={page.pageUrl} target="_blank" rel="noopener noreferrer">
                Visit Page
              </a>
            </Button>
            <Button
              variant="outline"
              disabled={isRescanning || !page?.pageUrl}
              onClick={async () => {
                if (!assetId || !page?.pageUrl) return;
                try {
                  setIsRescanning(true);
                  setRescanMessage("");
                  await createScanRun({
                    assetId,
                    pageUrls: [page.pageUrl],
                  });
                  setRescanMessage(
                    "Scan queued! You'll be redirected to the scan.",
                  );
                  setTimeout(() => {
                    window.location.href = `/admin/assets/${assetId}/scans`;
                  }, 1500);
                } catch (error) {
                  setRescanMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to queue scan",
                  );
                } finally {
                  setIsRescanning(false);
                }
              }}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRescanning ? "animate-spin" : ""}`}
              />
              {isRescanning ? "Queuing..." : "Rescan Page"}
            </Button>
            {rescanMessage && (
              <span className="text-muted-foreground self-center text-sm">
                {rescanMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-border/60 bg-background rounded-xl border p-4">
        <EntityList<FindingRow>
          data={findingRows}
          columns={findingColumns}
          title="Findings"
          description={`All findings for this page (${findingRows.length} total).`}
          defaultViewMode="list"
          viewModes={[]}
          enableSearch
          isLoading={findings === undefined}
          getRowId={(row) => row.id}
          initialSort={{ id: "severity", direction: "desc" }}
        />
      </div>
    </div>
  );
}
