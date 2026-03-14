"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

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

export default function AssetFindingsPage() {
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

  const updateFindingStatus = useMutation(api.findings.updateMyFindingStatus);
  const assignFinding = useMutation(api.findings.assignMyFinding);
  const actor = useQuery(api.findings.getMyFindingActor, {}) as
    | { userId: Id<"users"> }
    | undefined;

  const allFindings = useQuery(
    api.findings.listMyFindingsByAsset,
    assetId ? { assetId, limit: 1000 } : "skip",
  );

  const findingRows = useMemo<FindingRow[]>(
    () =>
      (allFindings ?? []).map((finding) => ({
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
    [allFindings],
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
        id: "pageUrl",
        header: "Page URL",
        accessorKey: "pageUrl",
        sortable: true,
        cell: (row: FindingRow) =>
          row.pageUrl ? (
            <a
              href={row.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all underline underline-offset-4"
            >
              {row.pageUrl}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
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

  return (
    <div className="border-border/60 bg-background rounded-xl border p-4">
      <EntityList<FindingRow>
        data={findingRows}
        columns={findingColumns}
        title="All Findings"
        description="All findings for this asset across all scans."
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        isLoading={allFindings === undefined}
        getRowId={(row) => row.id}
        initialSort={{ id: "severity", direction: "desc" }}
      />
    </div>
  );
}
