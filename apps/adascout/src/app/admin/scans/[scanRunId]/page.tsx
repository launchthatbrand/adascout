"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import type { ColumnDefinition } from "@launchthatapp/ui/entity-list";
import { Badge } from "@launchthatapp/ui/badge";
import { Button } from "@launchthatapp/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@launchthatapp/ui/dialog";
import { EntityList } from "@launchthatapp/ui/entity-list";

type PageRow = Record<string, unknown> & {
  id: string;
  url: string;
  status: string;
  attempt: number;
  findingCount?: number;
  updatedAt: number;
  errorMessage?: string;
  retryCount?: number;
  lastQueueWaitMs?: number;
  lastExtractLatencyMs?: number;
  terminalErrorCategory?: string;
};

type PdfCheckStatus = "pass" | "warn" | "fail";
type PdfDocumentCheck = {
  id: string;
  label: string;
  status: PdfCheckStatus;
  detail: string;
};
type PdfPageCheck = {
  id: string;
  label: string;
  status: PdfCheckStatus;
  totalPages: number;
  passCount: number;
  failCount: number;
  detail: string;
};
type PdfChecksSnapshot = {
  version: number;
  documentChecks: PdfDocumentCheck[];
  pageChecks: PdfPageCheck[];
};

const getCheckBadgeVariant = (status: PdfCheckStatus) => {
  if (status === "fail") return "destructive" as const;
  if (status === "warn") return "secondary" as const;
  return "default" as const;
};

const parsePdfChecksSnapshot = (rawJson?: string): PdfChecksSnapshot | null => {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as {
      checks?: {
        version?: unknown;
        documentChecks?: unknown;
        pageChecks?: unknown;
      };
    };
    const checks = parsed.checks;
    if (!checks) return null;
    if (
      typeof checks.version !== "number" ||
      !Array.isArray(checks.documentChecks) ||
      !Array.isArray(checks.pageChecks)
    ) {
      return null;
    }
    const isStatus = (value: unknown): value is PdfCheckStatus =>
      value === "pass" || value === "warn" || value === "fail";
    const documentChecks = checks.documentChecks.filter(
      (row): row is PdfDocumentCheck =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as { id?: unknown }).id === "string" &&
        typeof (row as { label?: unknown }).label === "string" &&
        isStatus((row as { status?: unknown }).status) &&
        typeof (row as { detail?: unknown }).detail === "string",
    );
    const pageChecks = checks.pageChecks.filter(
      (row): row is PdfPageCheck =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as { id?: unknown }).id === "string" &&
        typeof (row as { label?: unknown }).label === "string" &&
        isStatus((row as { status?: unknown }).status) &&
        typeof (row as { totalPages?: unknown }).totalPages === "number" &&
        typeof (row as { passCount?: unknown }).passCount === "number" &&
        typeof (row as { failCount?: unknown }).failCount === "number" &&
        typeof (row as { detail?: unknown }).detail === "string",
    );
    return {
      version: checks.version,
      documentChecks,
      pageChecks,
    };
  } catch {
    return null;
  }
};

export default function ScanDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const scanRunIdParam = params.scanRunId;
  const scanRunId =
    typeof scanRunIdParam === "string"
      ? (scanRunIdParam as Id<"scanRuns">)
      : undefined;
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
  const asset = useQuery(
    api.assets.getMyAsset,
    scanRun?.assetId ? { assetId: scanRun.assetId } : "skip",
  );
  const updateFindingStatus = useMutation(api.findings.updateMyFindingStatus);
  const assignFinding = useMutation(api.findings.assignMyFinding);
  const actor = useQuery(api.findings.getMyFindingActor, {});
  const cancelScanRun = useMutation(api.scans.cancelMyScanRun);
  const deleteScanRun = useMutation(api.scans.deleteMyScanRun);
  const rerunSelectedPages = useMutation(api.scans.rerunSelectedPages);

  const fixAllPageIssues = useMutation(api.wpConnector.fixAllPageIssues);
  const wpConnectionStatus = useQuery(
    api.wpConnector.getWpConnectionStatus,
    scanRun?.assetId ? { assetId: scanRun.assetId } : "skip",
  );

  const [remediatingFindingId, setRemediatingFindingId] = useState<
    string | null
  >(null);
  const [remediationError, setRemediationError] = useState<string | null>(null);
  const [remediationSuccess, setRemediationSuccess] = useState<string | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [selectedPageRunId, setSelectedPageRunId] = useState<string | null>(
    null,
  );
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);
  const [isRemediatingPage, setIsRemediatingPage] = useState(false);

  const handleRemediateFinding = async (finding: {
    _id: string;
    ruleId: string;
    target?: string;
    pageUrl?: string;
  }) => {
    if (!scanRun?.assetId || !selectedPageUrl) return;

    setRemediatingFindingId(finding._id);
    setRemediationError(null);
    setRemediationSuccess(null);

    try {
      const result = await fixAllPageIssues({
        assetId: scanRun.assetId,
        pageUrl: selectedPageUrl,
        findingIds: [finding._id as Id<"findings">],
      });

      if (result.success && result.fixedCount > 0) {
        setRemediationSuccess(`Fixed ${result.fixedCount} issue(s)`);
        await updateFindingStatus({
          findingId: finding._id as Id<"findings">,
          status: "resolved",
        });
      } else {
        setRemediationError(result.errors[0] || "Failed to remediate");
      }
    } catch (error) {
      setRemediationError(
        error instanceof Error ? error.message : "Remediation failed",
      );
    } finally {
      setRemediatingFindingId(null);
    }
  };

  const handleRemediatePage = async () => {
    if (!scanRun?.assetId || !selectedPageUrl || !selectedPageFindings) return;

    setIsRemediatingPage(true);
    setRemediationError(null);
    setRemediationSuccess(null);

    try {
      const findingIds = selectedPageFindings
        .filter(
          (f) => f.status !== "resolved" && f.status !== "verified_on_rescan",
        )
        .map((f) => f._id as Id<"findings">);

      if (findingIds.length === 0) {
        setRemediationSuccess("No unresolved findings to remediate");
        return;
      }

      const result = await fixAllPageIssues({
        assetId: scanRun.assetId,
        pageUrl: selectedPageUrl,
        findingIds,
      });

      if (result.success) {
        setRemediationSuccess(
          `Remediated ${result.fixedCount} of ${findingIds.length} issue(s)`,
        );
        for (const id of findingIds.slice(0, result.fixedCount)) {
          await updateFindingStatus({
            findingId: id,
            status: "resolved",
          });
        }
      } else {
        setRemediationError(result.errors[0] || "Failed to remediate page");
      }
    } catch (error) {
      setRemediationError(
        error instanceof Error ? error.message : "Remediation failed",
      );
    } finally {
      setIsRemediatingPage(false);
    }
  };

  const fixableRules = [
    "image-alt",
    "input-image-alt",
    "area-alt",
    "object-alt",
    "svg-img-alt",
    "link-name",
    "anchor-name",
    "heading-order",
  ];

  const canFixFinding = (ruleId: string) => fixableRules.includes(ruleId);

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

  const pdfMetrics = useMemo(() => {
    const rows = findings ?? [];
    const pdfFindings = rows.filter((row) => row.source === "pdf");
    const pagesWithoutTextLayer = pdfFindings.filter(
      (row) => row.ruleId === "pdf.text_layer.missing_page",
    ).length;
    const lowConfidencePages = pdfFindings.filter(
      (row) => row.ruleId === "pdf.scan_quality.low_confidence_ocr",
    ).length;
    const hasTagMissing = pdfFindings.some(
      (row) => row.ruleId === "pdf.tagging.missing",
    );
    const manualReview = pdfFindings.filter(
      (row) => row.manualReviewRequired,
    ).length;
    const imageLowContrastPages = pdfFindings.filter(
      (row) => row.ruleId === "pdf.image.text_detected_low_contrast",
    ).length;
    const imageBlurryPages = pdfFindings.filter(
      (row) => row.ruleId === "pdf.image.text_detected_blurry",
    ).length;
    const imageAltReviewPages = pdfFindings.filter(
      (row) => row.ruleId === "pdf.image.meaningful_image_needs_alt_review",
    ).length;
    return {
      pagesWithoutTextLayer,
      lowConfidencePages,
      taggedStatus: hasTagMissing ? "missing tags" : "no tag gap detected",
      manualReview,
      imageLowContrastPages,
      imageBlurryPages,
      imageAltReviewPages,
    };
  }, [findings]);
  const pdfChecks = useMemo<PdfChecksSnapshot | null>(() => {
    if (asset?.kind !== "file_pdf") return null;
    const parsed = parsePdfChecksSnapshot(report?.json);
    if (parsed) return parsed;

    const rows = findings ?? [];
    const pdfRows = rows.filter((row) => row.source === "pdf");
    const totalPages = Math.max(
      0,
      Number(
        scanRun?.totalPages ??
          Math.max(
            0,
            ...pdfRows
              .map((row) => Number(row.pageNumber ?? 0))
              .filter((value) => Number.isFinite(value)),
          ),
      ),
    );
    const countFailPages = (ruleId: string): number => {
      const pageSet = new Set<number>();
      let rowCount = 0;
      for (const row of pdfRows) {
        if (row.ruleId !== ruleId) continue;
        rowCount += 1;
        const pageNumber = Number(row.pageNumber ?? 0);
        if (Number.isFinite(pageNumber) && pageNumber > 0) {
          pageSet.add(pageNumber);
        }
      }
      return pageSet.size > 0 ? pageSet.size : rowCount;
    };
    const asPageCheck = (
      id: string,
      label: string,
      failCount: number,
      detail: string,
      failAsWarn = true,
    ): PdfPageCheck => {
      const boundedFail = Math.max(0, Math.min(failCount, totalPages));
      const passCount = Math.max(0, totalPages - boundedFail);
      return {
        id,
        label,
        status: boundedFail === 0 ? "pass" : failAsWarn ? "warn" : "fail",
        totalPages,
        passCount,
        failCount: boundedFail,
        detail,
      };
    };
    const hasRule = (ruleId: string) => pdfRows.some((row) => row.ruleId === ruleId);

    return {
      version: 1,
      documentChecks: [
        {
          id: "pdf.meta.title",
          label: "Document title metadata",
          status: hasRule("pdf.meta.title_missing") ? "fail" : "pass",
          detail: hasRule("pdf.meta.title_missing")
            ? "Title metadata appears missing."
            : "No title metadata issue detected.",
        },
        {
          id: "pdf.meta.language",
          label: "Document language metadata",
          status: hasRule("pdf.meta.language_missing") ? "fail" : "pass",
          detail: hasRule("pdf.meta.language_missing")
            ? "Primary language appears missing."
            : "No language metadata issue detected.",
        },
        {
          id: "pdf.tagging.struct_tree",
          label: "Structural tag tree",
          status: hasRule("pdf.tagging.missing") ? "fail" : "pass",
          detail: hasRule("pdf.tagging.missing")
            ? "Tag tree appears missing."
            : "No tag-tree issue detected.",
        },
      ],
      pageChecks: [
        asPageCheck(
          "pdf.text_layer.coverage",
          "Text layer detected per page",
          countFailPages("pdf.text_layer.missing_page"),
          "Derived from recorded text-layer findings.",
          false,
        ),
        asPageCheck(
          "pdf.ocr.quality_confidence",
          "OCR text quality confidence",
          countFailPages("pdf.scan_quality.low_confidence_ocr"),
          "Derived from low-confidence OCR findings.",
        ),
        asPageCheck(
          "pdf.reading_order.heuristic",
          "Reading order heuristic",
          countFailPages("pdf.reading_order.suspect"),
          "Derived from reading-order heuristic findings.",
        ),
        asPageCheck(
          "pdf.table.header_heuristic",
          "Table header semantics heuristic",
          countFailPages("pdf.table.header_missing"),
          "Derived from table semantics heuristic findings.",
        ),
      ],
    };
  }, [asset?.kind, report?.json, findings, scanRun?.totalPages]);

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
        lastQueueWaitMs: row.lastQueueWaitMs,
        lastExtractLatencyMs: row.lastExtractLatencyMs,
        terminalErrorCategory: row.terminalErrorCategory,
      })),
    [pageRuns],
  );
  const selectedPageFindings = useQuery(
    api.findings.listMyFindingsByScanRun,
    scanRunId && selectedPageRunId
      ? {
          scanRunId,
          scanRunPageId: selectedPageRunId as Id<"scanRunPages">,
          limit: 500,
        }
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
        cell: (row: PageRow) =>
          typeof row.findingCount === "number" ? row.findingCount : "—",
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
        id: "retryCount",
        header: "Retries",
        accessorKey: "retryCount",
        cell: (row: PageRow) => row.retryCount ?? 0,
      },
      {
        id: "timings",
        header: "Timings",
        accessorKey: "lastExtractLatencyMs",
        cell: (row: PageRow) => (
          <span className="text-xs">
            q:{row.lastQueueWaitMs ?? 0}ms · ex:{row.lastExtractLatencyMs ?? 0}
            ms
          </span>
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
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: PageRow) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/scans/${scanRunId}/pages/${row.id}`}>
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
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              Scan run
            </p>
            <h1 className="truncate text-lg font-semibold sm:text-xl">
              {scanRunId}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Status: {scanRun?.status ?? "loading..."} · Profile:{" "}
              {scanRun?.profile ?? "wcag_2_2_aa"}
            </p>
            {typeof scanRun?.totalPages === "number" ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Page progress: {scanRun.completedPages ?? 0}/
                {scanRun.totalPages}
                {typeof scanRun.failedPages === "number" &&
                scanRun.failedPages > 0
                  ? ` (${scanRun.failedPages} failed)`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {report ? (
              <Button variant="outline" asChild>
                <Link href={`/admin/reports/${String(report._id)}`}>
                  Open Report
                </Link>
              </Button>
            ) : null}
            <Button
              onClick={async () => {
                try {
                  const newRunId = await rerunScan({ scanRunId });
                  setStatusMessage(`Re-run queued: ${String(newRunId)}`);
                } catch (error) {
                  setStatusMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to rerun scan.",
                  );
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
                    setStatusMessage(
                      `Scan stop requested. Canceled ${result.canceledPages} page(s).`,
                    );
                  } catch (error) {
                    setStatusMessage(
                      error instanceof Error
                        ? error.message
                        : "Failed to stop scan.",
                    );
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
                  setStatusMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to delete scan run.",
                  );
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
          <div
            key={key}
            className="border-border/60 bg-background rounded-lg border p-3"
          >
            <p className="text-muted-foreground text-xs uppercase">{key}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {asset?.kind === "file_pdf" ? (
        <div className="grid gap-3 md:grid-cols-7">
          <div className="border-border/60 bg-background rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">Tagging</p>
            <p className="mt-1 text-sm font-semibold">{pdfMetrics.taggedStatus}</p>
          </div>
          <div className="border-border/60 bg-background rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">
              Pages Without Text
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {pdfMetrics.pagesWithoutTextLayer}
            </p>
          </div>
          <div className="border-border/60 bg-background rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">
              Low OCR Confidence
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {pdfMetrics.lowConfidencePages}
            </p>
          </div>
          <div className="border-border/60 bg-background rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">Manual Review</p>
            <p className="mt-1 text-2xl font-semibold">{pdfMetrics.manualReview}</p>
          </div>
          <div className="border-border/60 bg-background rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">
              Image Low Contrast
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {pdfMetrics.imageLowContrastPages}
            </p>
          </div>
          <div className="border-border/60 bg-background rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">Image Blurry</p>
            <p className="mt-1 text-2xl font-semibold">
              {pdfMetrics.imageBlurryPages}
            </p>
          </div>
          <div className="border-border/60 bg-background rounded-lg border p-3">
            <p className="text-muted-foreground text-xs uppercase">
              Image Alt Review
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {pdfMetrics.imageAltReviewPages}
            </p>
          </div>
        </div>
      ) : null}
      {asset?.kind === "file_pdf" && pdfChecks ? (
        <div className="border-border/60 bg-background space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-sm font-semibold">PDF checks (pass + fail)</p>
            <p className="text-muted-foreground text-xs">
              Document-level checks run once per PDF. Page-level checks show
              coverage across all pages.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {pdfChecks.documentChecks.map((check) => (
              <div
                key={check.id}
                className="border-border/60 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{check.label}</p>
                  <Badge variant={getCheckBadgeVariant(check.status)}>
                    {check.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  {check.detail}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pdfChecks.pageChecks.map((check) => (
              <div
                key={check.id}
                className="border-border/60 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{check.label}</p>
                  <Badge variant={getCheckBadgeVariant(check.status)}>
                    {check.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="mt-2 text-sm">
                  {check.passCount}/{check.totalPages} pages pass
                  {check.failCount > 0 ? ` (${check.failCount} flagged)` : ""}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {check.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {asset?.kind === "file_pdf" ? (
        <p className="text-muted-foreground text-xs">
          PDF scans are automated best-effort checks; manual validation is still
          recommended for legal compliance.
        </p>
      ) : null}

      <div className="border-border/60 bg-background rounded-xl border p-4">
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
                    const queuedCount = await rerunSelectedPages({ scanRunId });
                    setStatusMessage(
                      `Queued ${queuedCount} lifecycle-eligible page rerun(s).`,
                    );
                  } catch (error) {
                    setStatusMessage(
                      error instanceof Error
                        ? error.message
                        : "Failed to rerun lifecycle-eligible pages.",
                    );
                  }
                }}
              >
                Rerun Eligible
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const queuedCount = await rerunSelectedPages({
                      scanRunId,
                      includeAllPages: true,
                    });
                    setStatusMessage(
                      `Queued ${queuedCount} page rerun(s) with full override.`,
                    );
                  } catch (error) {
                    setStatusMessage(
                      error instanceof Error
                        ? error.message
                        : "Failed to rerun all pages.",
                    );
                  }
                }}
              >
                Full Rerun
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
                      pageRunIds: selectedItems.map(
                        (item) => item.id as Id<"scanRunPages">,
                      ),
                    });
                    setStatusMessage(
                      `Queued ${queuedCount} selected page rerun(s).`,
                    );
                    clearSelection();
                  } catch (error) {
                    setStatusMessage(
                      error instanceof Error
                        ? error.message
                        : "Failed to rerun selected pages.",
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
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Page Findings</DialogTitle>
                <DialogDescription className="break-all">
                  {selectedPageUrl ?? "Selected page"}
                </DialogDescription>
              </div>
              {wpConnectionStatus?.connected && selectedPageFindings ? (
                <Button
                  variant="default"
                  size="sm"
                  disabled={isRemediatingPage}
                  onClick={() => void handleRemediatePage()}
                >
                  {isRemediatingPage
                    ? "Remediating..."
                    : `Remediate All (${selectedPageFindings.filter((f) => f.status !== "resolved" && f.status !== "verified_on_rescan" && canFixFinding(f.ruleId)).length})`}
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          {remediationError || remediationSuccess ? (
            <div
              className={`rounded-lg px-4 py-3 ${remediationError ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}
            >
              {remediationError || remediationSuccess}
            </div>
          ) : null}
          {!wpConnectionStatus?.connected ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
              <p className="text-sm">
                Connect a WordPress staging site in Asset Settings to enable
                one-click remediation of accessibility issues.
              </p>
            </div>
          ) : null}
          <div className="space-y-3">
            {(selectedPageFindings ?? []).map((finding) => (
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{finding.status ?? "open"}</Badge>
                  {finding.evidenceHash ? (
                    <span className="text-muted-foreground text-xs">
                      evidence: {finding.evidenceHash.slice(0, 18)}…
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-sm">
                  Rule: {finding.ruleId}
                  {finding.target ? ` · Target: ${finding.target}` : ""}
                </p>
                {finding.description ? (
                  <p className="text-sm">{finding.description}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateFindingStatus({
                        findingId: finding._id,
                        status: "in_progress",
                      })
                    }
                  >
                    In Progress
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateFindingStatus({
                        findingId: finding._id,
                        status: "resolved",
                      })
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateFindingStatus({
                        findingId: finding._id,
                        status: "verified_on_rescan",
                      })
                    }
                  >
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateFindingStatus({
                        findingId: finding._id,
                        status: "regressed",
                      })
                    }
                  >
                    Regressed
                  </Button>
                  {actor?.userId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void assignFinding({
                          findingId: finding._id as Id<"findings">,
                          assignee: actor.userId,
                        })
                      }
                    >
                      Assign Me
                    </Button>
                  ) : null}
                  {wpConnectionStatus?.connected &&
                  canFixFinding(finding.ruleId) ? (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={
                        remediatingFindingId === String(finding._id) ||
                        finding.status === "resolved"
                      }
                      onClick={() =>
                        void handleRemediateFinding({
                          _id: String(finding._id),
                          ruleId: finding.ruleId,
                          target: finding.target,
                          pageUrl: selectedPageUrl ?? undefined,
                        })
                      }
                    >
                      {remediatingFindingId === String(finding._id)
                        ? "Remediating..."
                        : "Remediate"}
                    </Button>
                  ) : null}
                </div>
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
              <p className="text-muted-foreground text-sm">
                No findings were recorded for this page.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
