"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import ExcelJS from "exceljs";
import { BuilderDndProvider, SortableList } from "@launchthatapp/dnd";
import { Button } from "@launchthatapp/ui/button";
import { Badge } from "@launchthatapp/ui/badge";
import { Input } from "@launchthatapp/ui/input";
import { Label } from "@launchthatapp/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ReportDoc {
  _id: Id<"reports">;
  assetId: Id<"assets">;
  name?: string;
  layout: "compact" | "expanded";
  profile: string;
  generatedAt: number;
  totalFindings: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  manualReviewRequiredCount: number;
  logoStorageId?: Id<"_storage">;
  companyName?: string;
  footerText?: string;
  baselineScanRunId?: Id<"scanRuns">;
  includeNewResolvedRegressed?: boolean;
}

interface ReportPreview {
  profile: string;
  generatedAt: number;
  asset: { title: string; source?: string };
  branding: {
    logoStorageId?: Id<"_storage">;
    companyName?: string;
    footerText?: string;
  };
  selected: {
    scanRunIds: Id<"scanRuns">[];
    findingIds: Id<"findings">[];
    severities: string[];
    sources: string[];
  };
  delta: {
    baselineScanRunId?: Id<"scanRuns">;
    includeNewResolvedRegressed: boolean;
    newCount: number;
    resolvedCount: number;
    regressedCount: number;
  };
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    manualReviewRequired: number;
  };
  compliance: {
    score: number;
    band: "pass" | "warn" | "fail";
    weightedPenalty: number;
  };
  findings: {
    findingId: string;
    title: string;
    severity: string;
    status?: string;
    ruleId: string;
    source: string;
    target?: string;
    pageRegion?: "header" | "footer" | "body";
    pageUrl?: string;
    description?: string;
    helpUrl?: string;
  }[];
  groupedByPage: {
    pageUrl: string;
    findingCount: number;
    findings: {
      findingId: string;
      title: string;
      severity: string;
      ruleId: string;
      source: string;
      target?: string;
      description?: string;
    }[];
  }[];
}

interface ScanRunOption {
  id: string;
  createdAt: number;
  status: string;
}

interface ScanRunRow {
  _id: Id<"scanRuns">;
  createdAt: number;
  status: string;
}

type ExportFieldKey =
  | "findingId"
  | "severity"
  | "status"
  | "source"
  | "ruleId"
  | "title"
  | "pageUrl"
  | "pageRegion"
  | "howToFix"
  | "target"
  | "description";

type WorkspaceTab = "report_setup" | "export_setup" | "preview";

interface ReportExportTemplate {
  _id: Id<"reportExportTemplates">;
  name: string;
  assetId?: Id<"assets">;
  columns: {
    key: ExportFieldKey;
    label: string;
  }[];
  updatedAt: number;
}

type TemplateColumnState = Record<
  ExportFieldKey,
  {
    enabled: boolean;
    label: string;
  }
>;

const EXPORT_FIELD_OPTIONS: {
  key: ExportFieldKey;
  label: string;
  getValue: (finding: ReportPreview["findings"][number]) => string;
}[] = [
  { key: "findingId", label: "Finding ID", getValue: (finding) => String(finding.findingId) },
  { key: "severity", label: "Severity", getValue: (finding) => finding.severity },
  { key: "status", label: "Status", getValue: (finding) => finding.status ?? "open" },
  { key: "source", label: "Source", getValue: (finding) => finding.source },
  { key: "ruleId", label: "Rule", getValue: (finding) => finding.ruleId },
  { key: "title", label: "Title", getValue: (finding) => finding.title },
  { key: "pageUrl", label: "Page URL", getValue: (finding) => finding.pageUrl ?? "" },
  {
    key: "pageRegion",
    label: "Page region",
    getValue: (finding) => finding.pageRegion ?? "body",
  },
  {
    key: "howToFix",
    label: "How to fix",
    getValue: (finding) => {
      const description = finding.description?.trim() ?? "";
      if (description !== "") return description;
      const helpUrl = finding.helpUrl?.trim() ?? "";
      return helpUrl;
    },
  },
  { key: "target", label: "Target", getValue: (finding) => finding.target ?? "" },
  { key: "description", label: "Description", getValue: (finding) => finding.description ?? "" },
];

const buildDefaultTemplateColumns = (): TemplateColumnState =>
  Object.fromEntries(
    EXPORT_FIELD_OPTIONS.map((field) => [
      field.key,
      {
        enabled: true,
        label: field.label,
      },
    ]),
  ) as TemplateColumnState;

const buildDefaultTemplateColumnOrder = (): ExportFieldKey[] =>
  EXPORT_FIELD_OPTIONS.map((field) => field.key);

const isWorkspaceTab = (value: string | null): value is WorkspaceTab =>
  value === "report_setup" || value === "export_setup" || value === "preview";

export default function ReportDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportIdParam = params.reportId;
  const reportId =
    typeof reportIdParam === "string" ? (reportIdParam as Id<"reports">) : undefined;
  const updateReportConfig = useMutation(api.reports.updateMyReportConfig);
  const upsertExportTemplate = useMutation(api.reports.upsertMyReportExportTemplate);
  const deleteExportTemplate = useMutation(api.reports.deleteMyReportExportTemplate);
  const report = useQuery(
    api.reports.getMyReportById,
    reportId ? { reportId } : "skip",
  ) as ReportDoc | null | undefined;
  const preview = useQuery(
    api.reports.getMyReportPreviewData,
    reportId ? { reportId } : "skip",
  ) as ReportPreview | undefined;
  const scanRuns = useQuery(
    api.scans.listMyScanRuns,
    report?.assetId ? { assetId: report.assetId, limit: 500 } : "skip",
  ) as ScanRunRow[] | undefined;
  const exportTemplates = useQuery(
    api.reports.listMyReportExportTemplates,
    reportId ? {} : "skip",
  ) as ReportExportTemplate[] | undefined;
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<"compact" | "expanded">("compact");
  const [selectedScanRunIds, setSelectedScanRunIds] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [footerText, setFooterText] = useState("");
  const [baselineScanRunId, setBaselineScanRunId] = useState<string>("");
  const [includeDelta, setIncludeDelta] = useState(false);
  const [previewMode, setPreviewMode] = useState<"pdf" | "table">("pdf");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("report_setup");
  const [guidedExportType, setGuidedExportType] = useState<"template" | "branded">("template");
  const [guidedExportFormat, setGuidedExportFormat] = useState<"csv" | "excel">("excel");
  const [hasUnsavedReportChanges, setHasUnsavedReportChanges] = useState(false);
  const [exportRowMode, setExportRowMode] = useState<
    "findings" | "issue_page_count" | "layout_summary"
  >(
    "findings",
  );
  const [collapseLayoutIssueRows, setCollapseLayoutIssueRows] = useState(false);
  const [selectedExportTemplateId, setSelectedExportTemplateId] = useState<string>("");
  const [exportTemplateName, setExportTemplateName] = useState("");
  const [templateColumns, setTemplateColumns] =
    useState<TemplateColumnState>(buildDefaultTemplateColumns);
  const [templateColumnOrder, setTemplateColumnOrder] =
    useState<ExportFieldKey[]>(buildDefaultTemplateColumnOrder);
  const templateColumnItems = useMemo(
    () =>
      templateColumnOrder
        .map((fieldKey) => EXPORT_FIELD_OPTIONS.find((option) => option.key === fieldKey))
        .filter((field): field is (typeof EXPORT_FIELD_OPTIONS)[number] => field !== undefined),
    [templateColumnOrder],
  );

  useEffect(() => {
    if (!report || !preview) return;
    setName(report.name ?? "");
    setLayout(report.layout);
    setSelectedScanRunIds(preview.selected.scanRunIds.map((id) => String(id)));
    setSelectedSeverities(preview.selected.severities);
    setSelectedSources(preview.selected.sources);
    setCompanyName(report.companyName ?? preview.branding.companyName ?? "");
    setFooterText(report.footerText ?? preview.branding.footerText ?? "");
    setBaselineScanRunId(report.baselineScanRunId ? String(report.baselineScanRunId) : "");
    setIncludeDelta(report.includeNewResolvedRegressed ?? false);
    setHasUnsavedReportChanges(false);
  }, [preview, report]);

  useEffect(() => {
    if (!hasUnsavedReportChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedReportChanges]);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const normalizedTab: WorkspaceTab = isWorkspaceTab(tabFromUrl)
      ? tabFromUrl
      : "report_setup";

    if (workspaceTab !== normalizedTab) {
      setWorkspaceTab(normalizedTab);
      return;
    }

    if (tabFromUrl === normalizedTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", normalizedTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, workspaceTab]);

  useEffect(() => {
    if (report) {
      setExportTemplateName(
        (report.name?.trim() ?? "Report Findings Export Template").slice(0, 80),
      );
    }
  }, [report]);

  useEffect(() => {
    if (!selectedExportTemplateId || !exportTemplates) {
      return;
    }
    const template = exportTemplates.find(
      (row) => String(row._id) === selectedExportTemplateId,
    );
    if (!template) return;
    const nextColumns = buildDefaultTemplateColumns();
    const loadedOrder: ExportFieldKey[] = [];
    for (const column of template.columns) {
      const key = column.key;
      loadedOrder.push(key);
      nextColumns[key] = {
        enabled: true,
        label: column.label,
      };
    }
    for (const field of EXPORT_FIELD_OPTIONS) {
      const exists = template.columns.some((column) => column.key === field.key);
      if (!exists) {
        nextColumns[field.key] = {
          ...nextColumns[field.key],
          enabled: false,
        };
      }
    }
    const remaining = buildDefaultTemplateColumnOrder().filter(
      (key) => !loadedOrder.includes(key),
    );
    setTemplateColumns(nextColumns);
    setTemplateColumnOrder([...loadedOrder, ...remaining]);
    setExportTemplateName(template.name);
  }, [selectedExportTemplateId, exportTemplates]);

  const scanRunOptions = useMemo(
    () =>
      (scanRuns ?? []).map((run) => ({
        id: String(run._id),
        createdAt: run.createdAt,
        status: run.status,
      })),
    [scanRuns],
  );

  const filteredPreviewFindings = useMemo(() => {
    const findings = preview?.findings ?? [];
    const activeSeverityFilter = new Set(selectedSeverities);
    const activeSourceFilter = new Set(selectedSources);
    return findings.filter((finding) => {
      const severityPass =
        activeSeverityFilter.size === 0 || activeSeverityFilter.has(finding.severity);
      const sourcePass =
        activeSourceFilter.size === 0 || activeSourceFilter.has(finding.source);
      return severityPass && sourcePass;
    });
  }, [preview?.findings, selectedSeverities, selectedSources]);

  const filteredPreviewSummary = useMemo(() => {
    const summary = {
      total: filteredPreviewFindings.length,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      manualReviewRequired: 0,
    };
    for (const finding of filteredPreviewFindings) {
      if (finding.severity === "critical") summary.critical += 1;
      if (finding.severity === "serious") summary.serious += 1;
      if (finding.severity === "moderate") summary.moderate += 1;
      if (finding.severity === "minor") summary.minor += 1;
    }
    return summary;
  }, [filteredPreviewFindings]);

  const filteredGroupedByPage = useMemo(() => {
    const grouped = new Map<
      string,
      {
        pageUrl: string;
        findingCount: number;
        findings: {
          findingId: string;
          title: string;
          severity: string;
          ruleId: string;
          source: string;
          target?: string;
          description?: string;
        }[];
      }
    >();
    for (const finding of filteredPreviewFindings) {
      const pageKey = finding.pageUrl ?? "Unknown page";
      const current = grouped.get(pageKey) ?? {
        pageUrl: pageKey,
        findingCount: 0,
        findings: [],
      };
      current.findings.push({
        findingId: finding.findingId,
        title: finding.title,
        severity: finding.severity,
        ruleId: finding.ruleId,
        source: finding.source,
        target: finding.target,
        description: finding.description,
      });
      current.findingCount += 1;
      grouped.set(pageKey, current);
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.pageUrl.localeCompare(b.pageUrl),
    );
  }, [filteredPreviewFindings]);

  if (!reportId) {
    return (
      <section className="p-4">
        <p className="text-sm">Invalid report id.</p>
      </section>
    );
  }

  if (report === null) {
    return (
      <section className="p-4">
        <p className="text-sm">Report not found.</p>
      </section>
    );
  }
  if (report === undefined) {
    return (
      <section className="p-4">
        <p className="text-sm">Loading report...</p>
      </section>
    );
  }

  const toggleValue = (
    current: string[],
    value: string,
    setValue: (next: string[]) => void,
  ) => {
    if (current.includes(value)) {
      setValue(current.filter((item) => item !== value));
      return;
    }
    setValue([...current, value]);
  };

  const severityOptions = [
    "critical",
    "serious",
    "moderate",
    "minor",
    "info",
  ] as const;
  const sourceOptions = ["axe", "ibm", "pdf", "stagehand"] as const;
  const buildReportFileSlug = () => {
    const fallback = `report-${String(reportId)}`;
    const rawName =
      name.trim() !== "" ? name.trim() : (report.name?.trim() ?? fallback);
    const slug = rawName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
    return slug || fallback;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateReportConfig({
        reportId,
        name: name || undefined,
        layout,
        selectedScanRunIds:
          selectedScanRunIds.length > 0
            ? (selectedScanRunIds as Id<"scanRuns">[])
            : undefined,
        selectedSeverities:
          selectedSeverities.length > 0
            ? (selectedSeverities as ("critical" | "serious" | "moderate" | "minor" | "info")[])
            : undefined,
        selectedSources:
          selectedSources.length > 0
            ? (selectedSources as ("axe" | "ibm" | "pdf" | "stagehand")[])
            : undefined,
        companyName: companyName || undefined,
        footerText: footerText || undefined,
        baselineScanRunId: baselineScanRunId ? (baselineScanRunId as Id<"scanRuns">) : undefined,
        includeNewResolvedRegressed: includeDelta,
      });
      setStatusMessage("Report saved.");
      setHasUnsavedReportChanges(false);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to save report.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePdf = () => {
    const previewRoot = document.getElementById("report-pdf-preview");
    if (!previewRoot) {
      setStatusMessage("Preview is not ready yet.");
      return;
    }

    const printableHtml = previewRoot.innerHTML;
    const fileSlug = buildReportFileSlug();
    const styleMarkup = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]'),
    )
      .map((node) => node.outerHTML)
      .join("\n");
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${fileSlug}.pdf</title>
    ${styleMarkup}
    <style>
      @page { margin: 12mm; }
      html, body { background: #fff; }
      body { margin: 0; padding: 0; }
      #print-root { padding: 12mm; }
    </style>
  </head>
  <body>
    <main id="print-root">${printableHtml}</main>
  </body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!frameDoc || !frameWindow) {
      iframe.remove();
      setStatusMessage("Could not initialize print frame.");
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const cleanup = () => {
      iframe.remove();
    };

    frameWindow.onafterprint = cleanup;
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      setTimeout(cleanup, 1500);
    }, 250);
  };

  const downloadFile = (
    filename: string,
    contentType: string,
    body: BlobPart,
  ) => {
    const blob = new Blob([body], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const toCsv = (rows: string[][]): string =>
    rows
      .map((row) =>
        row
          .map((cell) => {
            const normalized = String(cell);
            if (
              normalized.includes(",") ||
              normalized.includes('"') ||
              normalized.includes("\n")
            ) {
              return `"${normalized.replace(/"/g, '""')}"`;
            }
            return normalized;
          })
          .join(","),
      )
      .join("\n");

  const isLayoutRegion = (
    region: ReportPreview["findings"][number]["pageRegion"] | undefined,
  ): region is "header" | "footer" => region === "header" || region === "footer";

  const getExportValue = (
    field: (typeof EXPORT_FIELD_OPTIONS)[number],
    finding: ReportPreview["findings"][number],
    regionOverride?: "header" | "footer",
  ): string => {
    if (regionOverride && field.key === "pageUrl") {
      return `All pages (${regionOverride})`;
    }
    if (field.key === "pageRegion") {
      return regionOverride ?? finding.pageRegion ?? "body";
    }
    return field.getValue(finding);
  };

  const summarizeUniqueValues = (values: string[]): string => {
    const uniqueValues = Array.from(
      new Set(values.map((value) => value.trim()).filter((value) => value !== "")),
    );
    if (uniqueValues.length === 0) return "";
    if (uniqueValues.length === 1) return uniqueValues[0] ?? "";
    const maxValues = 10;
    const head = uniqueValues.slice(0, maxValues).join(" | ");
    const overflow = uniqueValues.length - maxValues;
    if (overflow <= 0) return head;
    return `${head} | +${overflow} more`;
  };

  const getSelectedTemplateColumns = () =>
    templateColumnOrder
      .map((key) => EXPORT_FIELD_OPTIONS.find((field) => field.key === key))
      .filter(
        (
          field,
        ): field is {
          key: ExportFieldKey;
          label: string;
          getValue: (finding: ReportPreview["findings"][number]) => string;
        } => Boolean(field),
      )
      .filter((field) => templateColumns[field.key].enabled);

  const handleTemplateColumnDragEnd = (event: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTemplateColumnOrder((current) => {
      const oldIndex = current.findIndex((key) => key === String(active.id));
      const newIndex = current.findIndex((key) => key === String(over.id));
      if (oldIndex === -1 || newIndex === -1) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(oldIndex, 1);
      if (!moved) return current;
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  const buildTemplateFindingRows = (): string[][] => {
    const findings = filteredPreviewFindings;
    const selectedColumns = getSelectedTemplateColumns();
    if (selectedColumns.length === 0) {
      return [["No columns selected"]];
    }
    const dedupeLayoutKeys = new Set<string>();
    const rows = findings
      .map((finding) => {
        const region = finding.pageRegion;
        const shouldCollapse = collapseLayoutIssueRows && isLayoutRegion(region);
        const values = selectedColumns.map((field) =>
          getExportValue(field, finding, shouldCollapse ? region : undefined).trim(),
        );
        if (!shouldCollapse) return values;
        const collapseKey = values.join("||");
        if (dedupeLayoutKeys.has(collapseKey)) return null;
        dedupeLayoutKeys.add(collapseKey);
        return values;
      })
      .filter((row): row is string[] => row !== null);

    return [
      selectedColumns.map((field) => {
        const customLabel = templateColumns[field.key].label.trim();
        return customLabel === "" ? field.label : customLabel;
      }),
      ...rows,
    ];
  };

  const buildIssuePageCountRows = (): string[][] => {
    const selectedColumns = getSelectedTemplateColumns();
    if (selectedColumns.length === 0) {
      return [["No columns selected"]];
    }

    const grouped = new Map<string, { values: string[]; count: number }>();
    for (const finding of filteredPreviewFindings) {
      const region = finding.pageRegion;
      const collapseRegion = collapseLayoutIssueRows && isLayoutRegion(region) ? region : undefined;
      const values = selectedColumns.map((field) =>
        getExportValue(field, finding, collapseRegion).trim(),
      );
      const key = values.join("||");
      const current = grouped.get(key);
      if (current) {
        current.count += 1;
        continue;
      }
      grouped.set(key, { values, count: 1 });
    }

    const rows = Array.from(grouped.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.values.join("|").localeCompare(b.values.join("|"));
    });

    return [
      [
        ...selectedColumns.map((field) => {
          const customLabel = templateColumns[field.key].label.trim();
          return customLabel === "" ? field.label : customLabel;
        }),
        "Count",
      ],
      ...rows.map((row) => [...row.values, String(row.count)]),
    ];
  };

  const buildLayoutSummaryRows = (): string[][] => {
    const selectedColumns = getSelectedTemplateColumns();
    if (selectedColumns.length === 0) {
      return [["No columns selected"]];
    }

    const headerFindings = filteredPreviewFindings.filter((finding) => finding.pageRegion === "header");
    const footerFindings = filteredPreviewFindings.filter((finding) => finding.pageRegion === "footer");
    const bodyFindings = filteredPreviewFindings.filter(
      (finding) => finding.pageRegion !== "header" && finding.pageRegion !== "footer",
    );

    const rows: string[][] = [];
    const buildRegionRow = (region: "header" | "footer", findings: ReportPreview["findings"]) => {
      if (findings.length === 0) return;
      const values = selectedColumns.map((field) =>
        summarizeUniqueValues(
          findings.map((finding) => getExportValue(field, finding, region)),
        ),
      );
      rows.push([...values, String(findings.length)]);
    };

    buildRegionRow("header", headerFindings);
    buildRegionRow("footer", footerFindings);

    const groupedBody = new Map<string, { values: string[]; count: number }>();
    for (const finding of bodyFindings) {
      const values = selectedColumns.map((field) =>
        getExportValue(field, finding).trim(),
      );
      const key = values.join("||");
      const current = groupedBody.get(key);
      if (current) {
        current.count += 1;
        continue;
      }
      groupedBody.set(key, { values, count: 1 });
    }

    const bodyRows = Array.from(groupedBody.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.values.join("|").localeCompare(b.values.join("|"));
    });
    rows.push(...bodyRows.map((row) => [...row.values, String(row.count)]));

    return [
      [
        ...selectedColumns.map((field) => {
          const customLabel = templateColumns[field.key].label.trim();
          return customLabel === "" ? field.label : customLabel;
        }),
        "Count",
      ],
      ...rows,
    ];
  };

  const buildTemplateExportRows = (): string[][] =>
    exportRowMode === "issue_page_count"
      ? buildIssuePageCountRows()
      : exportRowMode === "layout_summary"
        ? buildLayoutSummaryRows()
        : buildTemplateFindingRows();

  const buildTemplatePayload = () => {
    const selectedColumns = getSelectedTemplateColumns().map((field) => ({
      key: field.key,
      label:
        templateColumns[field.key].label.trim() === ""
          ? field.label
          : templateColumns[field.key].label.trim(),
    }));
    return selectedColumns;
  };

  const buildBrandedRows = (): string[][] => {
    if (!preview) return [];
    const reportTitle =
      name.trim() !== "" ? name.trim() : report.name ?? `Report ${String(reportId)}`;
    const company = companyName.trim() !== "" ? companyName.trim() : "ADA Scout";
    const footer = footerText.trim();
    const findings = filteredPreviewFindings;
    return [
      ["Company", company],
      ["Report Name", reportTitle],
      ["Asset", preview.asset.title],
      ["Asset Source", preview.asset.source ?? ""],
      ["Profile", preview.profile],
      ["Generated At", new Date(preview.generatedAt).toLocaleString()],
      ["Total Findings", String(filteredPreviewSummary.total)],
      ["Critical", String(filteredPreviewSummary.critical)],
      ["Serious", String(filteredPreviewSummary.serious)],
      ["Moderate", String(filteredPreviewSummary.moderate)],
      ["Minor", String(filteredPreviewSummary.minor)],
      ["Manual Review", String(filteredPreviewSummary.manualReviewRequired)],
      ...(footer ? [["Footer", footer]] : []),
      [],
      [
        "Finding ID",
        "Severity",
        "Status",
        "Source",
        "Rule",
        "Title",
        "Page URL",
        "Target",
        "Description",
      ],
      ...findings.map((finding) => [
        String(finding.findingId),
        finding.severity,
        finding.status ?? "open",
        finding.source,
        finding.ruleId,
        finding.title,
        finding.pageUrl ?? "",
        finding.target ?? "",
        finding.description ?? "",
      ]),
    ];
  };

  const toExcelWorkbook = async (
    rows: string[][],
    sheetName: string,
  ): Promise<ArrayBuffer> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName.trim().slice(0, 31) || "Export");
    const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const border = {
      top: { style: "thin", color: { argb: "FF9FC1D8" } },
      right: { style: "thin", color: { argb: "FF9FC1D8" } },
      bottom: { style: "thin", color: { argb: "FF9FC1D8" } },
      left: { style: "thin", color: { argb: "FF9FC1D8" } },
    } as const;

    rows.forEach((row) => {
      const paddedRow = Array.from({ length: maxColumns }, (_, index) => row[index] ?? "");
      worksheet.addRow(paddedRow);
    });

    worksheet.eachRow((row, rowNumber) => {
      const isHeaderRow = rowNumber === 1;
      const isEvenDataRow = rowNumber > 1 && rowNumber % 2 === 1;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        cell.border = border;
        if (isHeaderRow) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0B3F66" },
          };
          cell.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
          };
          return;
        }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEvenDataRow ? "FFE9F4FB" : "FFFFFFFF" },
        };
      });
    });

    for (let columnIndex = 1; columnIndex <= maxColumns; columnIndex += 1) {
      const maxLength = rows.reduce((width, row) => {
        const value = row[columnIndex - 1] ?? "";
        return Math.max(width, String(value).length);
      }, 0);
      worksheet.getColumn(columnIndex).width = Math.min(80, Math.max(12, maxLength + 2));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  };

  const handleExportSimpleCsv = () => {
    const rows = buildTemplateExportRows();
    const fileSlug = buildReportFileSlug();
    const filename =
      exportRowMode === "issue_page_count"
        ? `${fileSlug}-issue-page-count.csv`
        : exportRowMode === "layout_summary"
          ? `${fileSlug}-layout-summary.csv`
          : `${fileSlug}-findings-template.csv`;
    downloadFile(
      filename,
      "text/csv;charset=utf-8",
      toCsv(rows),
    );
  };

  const handleExportSimpleExcel = async () => {
    const rows = buildTemplateExportRows();
    const fileSlug = buildReportFileSlug();
    const sheetName =
      exportRowMode === "issue_page_count"
        ? "Issue Page Count"
        : exportRowMode === "layout_summary"
          ? "Layout Summary"
          : "Template Findings";
    const filename =
      exportRowMode === "issue_page_count"
        ? `${fileSlug}-issue-page-count.xlsx`
        : exportRowMode === "layout_summary"
          ? `${fileSlug}-layout-summary.xlsx`
          : `${fileSlug}-findings-template.xlsx`;
    const workbookBuffer = await toExcelWorkbook(
      rows,
      sheetName,
    );
    downloadFile(
      filename,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      workbookBuffer,
    );
  };

  const handleExportBrandedCsv = () => {
    const rows = buildBrandedRows();
    const fileSlug = buildReportFileSlug();
    downloadFile(
      `${fileSlug}-branded.csv`,
      "text/csv;charset=utf-8",
      toCsv(rows),
    );
  };

  const handleExportBrandedExcel = async () => {
    const rows = buildBrandedRows();
    const fileSlug = buildReportFileSlug();
    const workbookBuffer = await toExcelWorkbook(rows, "Branded Report");
    downloadFile(
      `${fileSlug}-branded.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      workbookBuffer,
    );
  };

  const handleSaveExportTemplate = async () => {
    try {
      const columns = buildTemplatePayload();
      if (columns.length === 0) {
        setStatusMessage("Select at least one export column.");
        return;
      }
      const saved = await upsertExportTemplate({
        templateId: selectedExportTemplateId
          ? (selectedExportTemplateId as Id<"reportExportTemplates">)
          : undefined,
        name: exportTemplateName.trim() || "Report Findings Export Template",
        columns,
      });
      setSelectedExportTemplateId(String(saved._id));
      setStatusMessage("Export template saved.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to save export template.",
      );
    }
  };

  const handleDeleteExportTemplate = async () => {
    if (!selectedExportTemplateId) return;
    try {
      await deleteExportTemplate({
        templateId: selectedExportTemplateId as Id<"reportExportTemplates">,
      });
      setSelectedExportTemplateId("");
      setTemplateColumns(buildDefaultTemplateColumns());
      setTemplateColumnOrder(buildDefaultTemplateColumnOrder());
      setStatusMessage("Export template deleted.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to delete export template.",
      );
    }
  };

  const runDisplayLabel = (run: ScanRunOption): string =>
    `${new Date(run.createdAt).toLocaleString()} · ${run.status}`;

  const handleRunSelectionChange = (runId: string) => {
    toggleValue(selectedScanRunIds, runId, setSelectedScanRunIds);
    setHasUnsavedReportChanges(true);
  };

  const handleSeverityChange = (severity: string) => {
    toggleValue(selectedSeverities, severity, setSelectedSeverities);
    setHasUnsavedReportChanges(true);
  };

  const handleSourceChange = (source: string) => {
    toggleValue(selectedSources, source, setSelectedSources);
    setHasUnsavedReportChanges(true);
  };

  const handleGuidedExport = async () => {
    if (guidedExportType === "template" && guidedExportFormat === "csv") {
      handleExportSimpleCsv();
      return;
    }
    if (guidedExportType === "template" && guidedExportFormat === "excel") {
      await handleExportSimpleExcel();
      return;
    }
    if (guidedExportType === "branded" && guidedExportFormat === "csv") {
      handleExportBrandedCsv();
      return;
    }
    await handleExportBrandedExcel();
  };

  const handleWorkspaceTabChange = (nextTab: WorkspaceTab) => {
    setWorkspaceTab(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", nextTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <>
      <section className="w-full space-y-4 p-4 print:hidden">
        <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {report.name?.trim() ?? `Report ${reportId}`}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Generated {new Date(report.generatedAt).toLocaleString()} · Profile: {report.profile}
              </p>
              {hasUnsavedReportChanges ? (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  You have unsaved report changes.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Report"}
              </Button>
              <Button variant="outline" onClick={handleGeneratePdf}>
                Generate PDF
              </Button>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
                <select
                  aria-label="Export type"
                  value={guidedExportType}
                  onChange={(event) =>
                    setGuidedExportType(event.target.value as "template" | "branded")
                  }
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                >
                  <option value="template">Template</option>
                  <option value="branded">Branded</option>
                </select>
                <select
                  aria-label="Export format"
                  value={guidedExportFormat}
                  onChange={(event) =>
                    setGuidedExportFormat(event.target.value as "csv" | "excel")
                  }
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                </select>
                <Button
                  variant="outline"
                  onClick={() => void handleGuidedExport()}
                  disabled={!preview}
                >
                  Export
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <Metric label="Total" value={preview ? filteredPreviewSummary.total : report.totalFindings} />
            <Metric label="Critical" value={preview ? filteredPreviewSummary.critical : report.criticalCount} />
            <Metric label="Serious" value={preview ? filteredPreviewSummary.serious : report.seriousCount} />
            <Metric label="Moderate" value={preview ? filteredPreviewSummary.moderate : report.moderateCount} />
            <Metric label="Minor" value={preview ? filteredPreviewSummary.minor : report.minorCount} />
            <Metric
              label="Manual Review"
              value={
                preview
                  ? filteredPreviewSummary.manualReviewRequired
                  : report.manualReviewRequiredCount
              }
            />
          </div>
          {preview?.compliance ? (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Compliance score:</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  preview.compliance.band === "pass"
                    ? "bg-emerald-100 text-emerald-800"
                    : preview.compliance.band === "warn"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {preview.compliance.score}/100 ({preview.compliance.band})
              </span>
            </div>
          ) : null}
          {preview?.delta.includeNewResolvedRegressed ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Metric label="New" value={preview.delta.newCount} />
              <Metric label="Resolved" value={preview.delta.resolvedCount} />
              <Metric label="Regressed" value={preview.delta.regressedCount} />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Template export uses your template columns and row mode. Branded export includes summary metadata and findings.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Automated checks are best-effort only; manual accessibility verification is recommended for complex documents.
          </p>
          {statusMessage ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
        </div>

        <div className="w-full overflow-x-auto">
          <div className="inline-flex h-11 items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleWorkspaceTabChange("report_setup")}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition ${
                workspaceTab === "report_setup"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              }`}
            >
              Report Setup
            </button>
            <button
              type="button"
              onClick={() => handleWorkspaceTabChange("export_setup")}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition ${
                workspaceTab === "export_setup"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              }`}
            >
              Export Setup
            </button>
            <button
              type="button"
              onClick={() => handleWorkspaceTabChange("preview")}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition ${
                workspaceTab === "preview"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {workspaceTab === "report_setup" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Report basics</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Configure report naming, layout, and branding details.
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="report-name">Report name</Label>
                  <Input
                    id="report-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setHasUnsavedReportChanges(true);
                    }}
                    placeholder="Quarterly ADA report"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-layout">Layout</Label>
                  <select
                    id="report-layout"
                    aria-label="Report layout"
                    value={layout}
                    onChange={(event) => {
                      setLayout(event.target.value as "compact" | "expanded");
                      setHasUnsavedReportChanges(true);
                    }}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <option value="compact">Compact (default)</option>
                    <option value="expanded">Expanded (one section per page URL)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-company-name">Company name</Label>
                  <Input
                    id="report-company-name"
                    value={companyName}
                    onChange={(event) => {
                      setCompanyName(event.target.value);
                      setHasUnsavedReportChanges(true);
                    }}
                    placeholder="Acme Compliance LLC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-footer-text">Footer text</Label>
                  <Input
                    id="report-footer-text"
                    value={footerText}
                    onChange={(event) => {
                      setFooterText(event.target.value);
                      setHasUnsavedReportChanges(true);
                    }}
                    placeholder="Confidential - Internal Use Only"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Scan run selection</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Choose scan runs included in report calculations and exports.
                </p>
                <div className="mt-4 max-h-52 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
                  {scanRunOptions.map((run) => (
                    <label key={run.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedScanRunIds.includes(run.id)}
                        aria-label={`Include scan run ${runDisplayLabel(run)}`}
                        onChange={() => handleRunSelectionChange(run.id)}
                      />
                      <span className="flex-1">
                        {runDisplayLabel(run)}
                        <span className="text-muted-foreground ml-1 text-xs">({run.id.slice(0, 12)}...)</span>
                      </span>
                      <Badge variant="outline">{run.status}</Badge>
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Delta settings</h2>
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="report-baseline-run">Baseline run (delta mode)</Label>
                    <select
                      id="report-baseline-run"
                      aria-label="Baseline run"
                      value={baselineScanRunId}
                      onChange={(event) => {
                        setBaselineScanRunId(event.target.value);
                        setHasUnsavedReportChanges(true);
                      }}
                      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <option value="">No baseline</option>
                      {scanRunOptions.map((run) => (
                        <option key={run.id} value={run.id}>
                          {runDisplayLabel(run)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeDelta}
                      onChange={(event) => {
                        setIncludeDelta(event.target.checked);
                        setHasUnsavedReportChanges(true);
                      }}
                    />
                    Include New/Resolved/Regressed sections in PDF
                  </label>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Severity filter</p>
                    <div className="grid grid-cols-2 gap-2">
                      {severityOptions.map((severity) => (
                        <label key={severity} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedSeverities.includes(severity)}
                            onChange={() => handleSeverityChange(severity)}
                          />
                          <span className="capitalize">{severity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Source filter</p>
                    <div className="grid grid-cols-2 gap-2">
                      {sourceOptions.map((source) => (
                        <label key={source} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedSources.includes(source)}
                            onChange={() => handleSourceChange(source)}
                          />
                          <span>{source}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {workspaceTab === "export_setup" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Export template setup</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Template exports follow this configuration. Branded exports always include report metadata.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="export-row-mode">Row mode</Label>
                <select
                  id="export-row-mode"
                  aria-label="Export row mode"
                  value={exportRowMode}
                  onChange={(event) =>
                    setExportRowMode(
                      event.target.value as "findings" | "issue_page_count" | "layout_summary",
                    )
                  }
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="findings">Findings</option>
                  <option value="issue_page_count">Issue + Page (Count)</option>
                  <option value="layout_summary">Layout summary (Header/Footer)</option>
                </select>
                {exportRowMode === "issue_page_count" ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Rows are grouped by Issue and Page with a Count column.
                  </p>
                ) : exportRowMode === "layout_summary" ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Header and footer issues are collapsed into one row each; body issues remain grouped
                    with counts.
                  </p>
                ) : null}
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={collapseLayoutIssueRows}
                    onChange={(event) => setCollapseLayoutIssueRows(event.target.checked)}
                  />
                  Collapse repeated header/footer issues across pages
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  When enabled, duplicate findings in shared layout regions are merged into one row
                  and Page URL is shown as <span className="font-mono">All pages (...)</span>.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-template">Template</Label>
                <select
                  id="export-template"
                  aria-label="Export template"
                  value={selectedExportTemplateId}
                  onChange={(event) => setSelectedExportTemplateId(event.target.value)}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="">Unsaved template (current settings)</option>
                  {(exportTemplates ?? []).map((template) => (
                    <option key={String(template._id)} value={String(template._id)}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="export-template-name">Template name</Label>
              <Input
                id="export-template-name"
                value={exportTemplateName}
                onChange={(event) => setExportTemplateName(event.target.value)}
                placeholder="Template name"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setTemplateColumns((current) => {
                    const next = { ...current };
                    for (const key of buildDefaultTemplateColumnOrder()) {
                      next[key] = { ...next[key], enabled: true };
                    }
                    return next;
                  })
                }
              >
                Enable all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setTemplateColumns((current) => {
                    const next = { ...current };
                    for (const key of buildDefaultTemplateColumnOrder()) {
                      next[key] = { ...next[key], enabled: false };
                    }
                    return next;
                  })
                }
              >
                Disable all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setTemplateColumnOrder(buildDefaultTemplateColumnOrder())}
              >
                Reset order
              </Button>
            </div>
            <div className="mt-4 rounded-md border border-slate-200 p-2 dark:border-slate-700">
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Drag rows to reorder export columns.
              </p>
              <div className="max-h-72 overflow-y-auto">
                <BuilderDndProvider onDragEnd={handleTemplateColumnDragEnd}>
                  <SortableList<(typeof EXPORT_FIELD_OPTIONS)[number]>
                    items={templateColumnItems}
                    getId={(field: (typeof EXPORT_FIELD_OPTIONS)[number]) => field.key}
                    itemClassName="mb-2 border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                    renderItem={(field: (typeof EXPORT_FIELD_OPTIONS)[number]) => (
                      <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-2 p-2">
                        <input
                          type="checkbox"
                          checked={templateColumns[field.key].enabled}
                          aria-label={`Include ${field.label} column`}
                          onChange={(event) =>
                            setTemplateColumns((current) => ({
                              ...current,
                              [field.key]: {
                                ...current[field.key],
                                enabled: event.target.checked,
                              },
                            }))
                          }
                        />
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {field.label}
                          </p>
                          <Input
                            value={templateColumns[field.key].label}
                            onChange={(event) =>
                              setTemplateColumns((current) => ({
                                ...current,
                                [field.key]: {
                                  ...current[field.key],
                                  label: event.target.value,
                                },
                              }))
                            }
                            placeholder={field.label}
                          />
                        </div>
                      </div>
                    )}
                  />
                </BuilderDndProvider>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={() => void handleSaveExportTemplate()}>
                Save Template
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDeleteExportTemplate()}
                disabled={!selectedExportTemplateId}
              >
                Delete Template
              </Button>
            </div>
          </div>
        ) : null}

        {workspaceTab === "preview" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="print:hidden flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {previewMode === "pdf" ? "PDF Preview" : "Table Export Preview"}
              </h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={previewMode === "pdf" ? "default" : "outline"}
                  onClick={() => setPreviewMode("pdf")}
                >
                  PDF Mode
                </Button>
                <Button
                  size="sm"
                  variant={previewMode === "table" ? "default" : "outline"}
                  onClick={() => setPreviewMode("table")}
                >
                  Table Mode
                </Button>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-500 print:hidden dark:text-slate-400">
              {previewMode === "pdf"
                ? "This preview matches Generate PDF output."
                : "This preview mirrors template export rows after filters and row mode are applied."}
            </p>
            {previewMode === "pdf" ? (
              <div id="report-pdf-preview" className="mt-4">
                <ReportPdfPreview
                  report={report}
                  preview={preview}
                  layout={layout}
                  name={name}
                  companyName={companyName}
                  footerText={footerText}
                  findings={filteredPreviewFindings}
                  groupedByPage={filteredGroupedByPage}
                  summary={filteredPreviewSummary}
                />
              </div>
            ) : (
              <div className="mt-4 overflow-auto rounded-md border border-[#9fc1d8]">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">
                    Table preview for template export rows based on current template configuration.
                  </caption>
                  {(() => {
                    const rows = buildTemplateExportRows();
                    const header = rows[0] ?? [];
                    const dataRows = rows.slice(1);
                    return (
                      <>
                        <thead className="bg-[#0b3f66] text-white">
                          <tr>
                            {header.map((cell, index) => (
                              <th
                                key={`header-${index}-${cell}`}
                                scope="col"
                                className="border border-[#9fc1d8] px-2 py-1 text-left font-semibold"
                              >
                                {cell}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataRows.map((row, rowIndex) => (
                            <tr
                              key={`row-${rowIndex}-${row.join("|")}`}
                              className={rowIndex % 2 === 0 ? "bg-white" : "bg-[#e9f4fb]"}
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`cell-${rowIndex}-${cellIndex}`}
                                  className="border border-[#9fc1d8] px-2 py-1 align-top"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {dataRows.length === 0 ? (
                            <tr>
                              <td
                                className="text-muted-foreground px-2 py-3"
                                colSpan={Math.max(1, header.length)}
                              >
                                No findings match current filters.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </>
                    );
                  })()}
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>
      <section id="report-pdf-print" className="hidden print:block print:p-4">
        <ReportPdfPreview
          report={report}
          preview={preview}
          layout={layout}
          name={name}
          companyName={companyName}
          footerText={footerText}
          findings={filteredPreviewFindings}
          groupedByPage={filteredGroupedByPage}
          summary={filteredPreviewSummary}
        />
      </section>
      <style jsx global>{`
        @media print {
          #report-pdf-print article {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
}

const Metric = ({ label, value }: { label: string; value: number }) => {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
};

const ReportPdfPreview = ({
  report,
  preview,
  layout,
  name,
  companyName,
  footerText,
  findings,
  groupedByPage,
  summary,
}: {
  report: { name?: string };
  preview: ReportPreview | undefined;
  layout: "compact" | "expanded";
  name: string;
  companyName: string;
  footerText: string;
  findings: ReportPreview["findings"];
  groupedByPage: ReportPreview["groupedByPage"];
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    manualReviewRequired: number;
  };
}) => {
  if (!preview) {
    return (
      <div className="rounded-lg border border-border/60 p-4 text-sm">
        Generating preview...
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-4xl space-y-4 rounded-xl border border-border/60 bg-white p-6 text-black">
      <header className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
        <div className="space-y-2">
          <div className="inline-flex h-10 items-center rounded-md border border-dashed border-black/40 px-3 text-xs uppercase tracking-[0.2em]">
            Platform logo placeholder
          </div>
          <h1 className="text-2xl font-semibold">
            {name.trim() !== "" ? name.trim() : (report.name ?? "ADA Scout Report")}
          </h1>
          {companyName.trim() !== "" ? (
            <p className="text-sm opacity-80">{companyName.trim()}</p>
          ) : null}
          <p className="text-sm opacity-80">{preview.asset.title}</p>
          {preview.asset.source ? <p className="text-xs opacity-70">{preview.asset.source}</p> : null}
        </div>
        <div className="text-right text-xs opacity-70">
          <p>Profile: {preview.profile}</p>
          <p>Generated: {new Date(preview.generatedAt).toLocaleString()}</p>
          <p>Layout: {layout}</p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2 md:grid-cols-6">
        <PreviewMetric label="Total" value={summary.total} />
        <PreviewMetric label="Critical" value={summary.critical} />
        <PreviewMetric label="Serious" value={summary.serious} />
        <PreviewMetric label="Moderate" value={summary.moderate} />
        <PreviewMetric label="Minor" value={summary.minor} />
        <PreviewMetric label="Manual" value={summary.manualReviewRequired} />
      </section>

      {preview.delta.includeNewResolvedRegressed ? (
        <section className="grid grid-cols-3 gap-2">
          <PreviewMetric label="New" value={preview.delta.newCount} />
          <PreviewMetric label="Resolved" value={preview.delta.resolvedCount} />
          <PreviewMetric label="Regressed" value={preview.delta.regressedCount} />
        </section>
      ) : null}

      {layout === "compact" ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Findings</h2>
          {findings.map((finding) => (
            <article key={String(finding.findingId)} className="rounded-md border border-black/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{finding.title}</p>
                <SeverityBadge severity={finding.severity} />
              </div>
              <p className="mt-1 text-xs opacity-80">
                Rule: {finding.ruleId} · Source: {finding.source}
                {finding.target ? ` · Target: ${finding.target}` : ""}
              </p>
              {finding.pageUrl ? <p className="mt-1 text-xs break-all opacity-80">{finding.pageUrl}</p> : null}
              {finding.description ? <p className="mt-2 text-sm">{finding.description}</p> : null}
            </article>
          ))}
          {findings.length === 0 ? <p className="text-sm opacity-70">No findings match your filters.</p> : null}
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Findings By Page URL</h2>
          {groupedByPage.map((group) => (
            <article key={group.pageUrl} className="break-after-page rounded-md border border-black/10 p-4">
              <h3 className="text-base font-semibold break-all">{group.pageUrl}</h3>
              <p className="mt-1 text-xs opacity-70">{group.findingCount} finding(s)</p>
              <div className="mt-3 space-y-2">
                {group.findings.map((finding) => (
                  <div key={String(finding.findingId)} className="rounded border border-black/10 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{finding.title}</p>
                      <SeverityBadge severity={finding.severity} />
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      Rule: {finding.ruleId} · Source: {finding.source}
                      {finding.target ? ` · Target: ${finding.target}` : ""}
                    </p>
                    {finding.description ? <p className="mt-2 text-sm">{finding.description}</p> : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
          {groupedByPage.length === 0 ? <p className="text-sm opacity-70">No findings match your filters.</p> : null}
        </section>
      )}
      {footerText.trim() !== "" ? (
        <footer className="border-t border-black/10 pt-3 text-xs opacity-70">{footerText.trim()}</footer>
      ) : null}
    </article>
  );
};

const PreviewMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded border border-black/10 p-2 text-center">
    <p className="text-[10px] uppercase opacity-70">{label}</p>
    <p className="text-lg font-semibold">{value}</p>
  </div>
);

const SeverityBadge = ({ severity }: { severity: string }) => {
  const normalized = severity.toLowerCase();
  const styles = getSeverityBadgeStyles(normalized);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.className}`}
      style={{ backgroundColor: styles.backgroundColor, borderColor: styles.borderColor, color: styles.color }}
    >
      {normalized}
    </span>
  );
};

const getSeverityBadgeStyles = (severity: string) => {
  if (severity === "critical") {
    return {
      className: "bg-red-100 text-red-900 border-red-300",
      backgroundColor: "#fee2e2",
      borderColor: "#fca5a5",
      color: "#7f1d1d",
    };
  }
  if (severity === "serious") {
    return {
      className: "bg-orange-100 text-orange-900 border-orange-300",
      backgroundColor: "#ffedd5",
      borderColor: "#fdba74",
      color: "#7c2d12",
    };
  }
  if (severity === "moderate") {
    return {
      className: "bg-amber-100 text-amber-900 border-amber-300",
      backgroundColor: "#fef3c7",
      borderColor: "#fcd34d",
      color: "#78350f",
    };
  }
  if (severity === "minor") {
    return {
      className: "bg-blue-100 text-blue-900 border-blue-300",
      backgroundColor: "#dbeafe",
      borderColor: "#93c5fd",
      color: "#1e3a8a",
    };
  }
  return {
    className: "bg-slate-100 text-slate-900 border-slate-300",
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
    color: "#0f172a",
  };
};

