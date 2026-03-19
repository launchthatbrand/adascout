"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import type { ColumnDefinition } from "@acme/ui/entity-list";
import { Button } from "@acme/ui/button";
import { EntityList } from "@acme/ui/entity-list";

const PDF_IMAGE_RULE_IDS = new Set<string>([
  "pdf.image.text_detected_low_contrast",
  "pdf.image.text_detected_blurry",
  "pdf.image.meaningful_image_needs_alt_review",
]);

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

const getSeverityColorClass = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
    case "serious":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800";
    case "moderate":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800";
    case "minor":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800";
    case "info":
    default:
      return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
};

const getStatusColorClass = (status: string) => {
  switch (status) {
    case "resolved":
    case "verified_on_rescan":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800";
    case "regressed":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
    case "open":
    default:
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800";
  }
};

export default function AssetFindingsPage() {
  const router = useRouter();
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "axe" | "ibm" | "pdf" | "stagehand"
  >("all");
  const [ruleFocus, setRuleFocus] = useState<"all" | "pdf_images">("all");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportActionMessage, setReportActionMessage] = useState<string | null>(
    null,
  );
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
  const createReportFromFindings = useMutation(
    api.reports.createMyReportFromFindingIds,
  );
  const actor = useQuery(api.findings.getMyFindingActor, {}) as
    | { userId: Id<"users"> }
    | undefined;

  const allFindings = useQuery(
    api.findings.listMyFindingsByAsset,
    assetId ? { assetId, limit: 1000 } : "skip",
  );

  const findingRows = useMemo<FindingRow[]>(
    () =>
      (allFindings ?? [])
        .filter((finding) =>
          sourceFilter === "all" ? true : finding.source === sourceFilter,
        )
        .filter((finding) =>
          ruleFocus === "pdf_images"
            ? PDF_IMAGE_RULE_IDS.has(finding.ruleId)
            : true,
        )
        .map((finding) => ({
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
    [allFindings, sourceFilter, ruleFocus],
  );
  const findingCounts = useMemo(() => {
    const rows = allFindings ?? [];
    const pdfRows = rows.filter((row) => row.source === "pdf");
    const pdfImageRows = rows.filter((row) => PDF_IMAGE_RULE_IDS.has(row.ruleId));
    return {
      all: rows.length,
      pdf: pdfRows.length,
      pdfImages: pdfImageRows.length,
    };
  }, [allFindings]);

  const findingColumns = useMemo<ColumnDefinition<FindingRow>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        accessorKey: "title",
        minWidth: "200px",
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        sortable: true,
        minWidth: "120px",
        cell: (row: FindingRow) => (
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
        id: "severity",
        header: "Severity",
        accessorKey: "severityRank",
        sortable: true,
        minWidth: "100px",
        cell: (row: FindingRow) => (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getSeverityColorClass(
              row.severity,
            )}`}
          >
            {row.severity}
          </span>
        ),
      },
      {
        id: "ruleId",
        header: "Rule",
        accessorKey: "ruleId",
        minWidth: "140px",
      },
      {
        id: "pageUrl",
        header: "Page URL",
        accessorKey: "pageUrl",
        sortable: true,
        minWidth: "200px",
        cell: (row: FindingRow) =>
          row.pageUrl ? (
            <a
              href={row.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-indigo-600 underline underline-offset-4 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
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
        minWidth: "150px",
        cell: (row: FindingRow) => (
          <span className="text-sm">{row.target ?? "—"}</span>
        ),
      },
      {
        id: "assignee",
        header: "Assignee",
        accessorKey: "assignee",
        sortable: true,
        minWidth: "100px",
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
        minWidth: "100px",
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
        minWidth: "80px",
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        minWidth: "240px",
        cell: (row: FindingRow) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/assets/${assetId}/findings/${row.id}`}>
                View
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link
                href={`/admin/assets/${assetId}/findings/${row.id}?section=playbook`}
              >
                Playbook
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <EntityList<FindingRow>
        data={findingRows}
        columns={findingColumns}
        title="All Findings"
        description={
          ruleFocus === "pdf_images"
            ? "Image-oriented PDF findings (contrast, blur, alt-review) with remediation playbooks."
            : sourceFilter === "pdf"
            ? "PDF findings with remediation playbook links."
            : "All findings for this asset across all scans."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={sourceFilter === "all" ? "default" : "outline"}
              onClick={() => {
                setSourceFilter("all");
                setRuleFocus("all");
              }}
            >
              All Sources ({findingCounts.all})
            </Button>
            <Button
              size="sm"
              variant={sourceFilter === "pdf" ? "default" : "outline"}
              onClick={() => {
                setSourceFilter("pdf");
                setRuleFocus("all");
              }}
            >
              PDF Only ({findingCounts.pdf})
            </Button>
            <Button
              size="sm"
              variant={ruleFocus === "pdf_images" ? "default" : "outline"}
              onClick={() => {
                setSourceFilter("pdf");
                setRuleFocus("pdf_images");
              }}
            >
              Image Checks ({findingCounts.pdfImages})
            </Button>
          </div>
        }
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        enableRowSelection
        bulkActions={({ selectedItems, clearSelection }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!assetId || selectedItems.length === 0 || isGeneratingReport}
              onClick={async () => {
                if (!assetId || selectedItems.length === 0) return;
                const findingIds = Array.from(
                  new Set(
                    selectedItems
                      .map((item) => String(item.id))
                      .filter((value) => value.length > 0),
                  ),
                ) as Id<"findings">[];
                if (findingIds.length === 0) return;
                try {
                  setIsGeneratingReport(true);
                  setReportActionMessage(null);
                  const reportId = await createReportFromFindings({
                    assetId,
                    findingIds,
                  });
                  clearSelection();
                  router.push(`/admin/reports/${String(reportId)}`);
                } catch (error) {
                  setReportActionMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to generate report.",
                  );
                } finally {
                  setIsGeneratingReport(false);
                }
              }}
            >
              {isGeneratingReport
                ? "Generating..."
                : `Generate Report (${selectedItems.length})`}
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Clear Selection
            </Button>
          </div>
        )}
        isLoading={allFindings === undefined}
        getRowId={(row) => row.id}
        initialSort={{ id: "severity", direction: "desc" }}
      />
      {reportActionMessage ? (
        <p className="text-muted-foreground mt-3 text-xs">{reportActionMessage}</p>
      ) : null}
    </div>
  );
}
