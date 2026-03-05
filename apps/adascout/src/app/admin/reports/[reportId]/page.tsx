"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@acme/ui/button";
import { Badge } from "@acme/ui/badge";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
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
}

interface ReportPreview {
  profile: string;
  generatedAt: number;
  asset: { title: string; source?: string };
  selected: {
    scanRunIds: Id<"scanRuns">[];
    severities: string[];
    sources: string[];
  };
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    manualReviewRequired: number;
  };
  findings: {
    findingId: string;
    title: string;
    severity: string;
    ruleId: string;
    source: string;
    target?: string;
    pageUrl?: string;
    description?: string;
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

export default function ReportDetailsPage() {
  const params = useParams();
  const reportIdParam = params.reportId;
  const reportId =
    typeof reportIdParam === "string" ? (reportIdParam as Id<"reports">) : undefined;
  const updateReportConfig = useMutation(api.reports.updateMyReportConfig);
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
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<"compact" | "expanded">("compact");
  const [selectedScanRunIds, setSelectedScanRunIds] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  useEffect(() => {
    if (!report || !preview) return;
    setName(report.name ?? "");
    setLayout(report.layout);
    setSelectedScanRunIds(preview.selected.scanRunIds.map((id) => String(id)));
    setSelectedSeverities(preview.selected.severities);
    setSelectedSources(preview.selected.sources);
  }, [preview, report]);

  const scanRunOptions = useMemo(
    () =>
      (scanRuns ?? []).map((run) => ({
        id: String(run._id),
        createdAt: run.createdAt,
        status: run.status,
      })),
    [scanRuns],
  );

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
      });
      setStatusMessage("Report saved.");
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

  return (
    <>
      <section className="w-full space-y-4 p-4 print:hidden">
      <div className="rounded-xl border border-border/60 bg-background p-4">
        <h1 className="text-xl font-semibold">{report.name?.trim() ?? `Report ${reportId}`}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Generated {new Date(report.generatedAt).toLocaleString()} · Profile: {report.profile}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <Metric label="Total" value={preview?.summary.total ?? report.totalFindings} />
          <Metric label="Critical" value={preview?.summary.critical ?? report.criticalCount} />
          <Metric label="Serious" value={preview?.summary.serious ?? report.seriousCount} />
          <Metric label="Moderate" value={preview?.summary.moderate ?? report.moderateCount} />
          <Metric label="Minor" value={preview?.summary.minor ?? report.minorCount} />
          <Metric
            label="Manual Review"
            value={preview?.summary.manualReviewRequired ?? report.manualReviewRequiredCount}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Report"}
          </Button>
          <Button variant="outline" onClick={handleGeneratePdf}>
            Generate PDF
          </Button>
        </div>
        {statusMessage ? <p className="text-muted-foreground mt-3 text-xs">{statusMessage}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-background p-4 xl:col-span-1 print:hidden">
          <h2 className="text-base font-semibold">Report Settings</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure filters, save, then generate a PDF from the preview.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">Report name</Label>
              <Input
                id="report-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Quarterly ADA report"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-layout">Layout</Label>
              <select
                id="report-layout"
                value={layout}
                onChange={(event) => setLayout(event.target.value as "compact" | "expanded")}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="compact">Compact (default)</option>
                <option value="expanded">Expanded (one section per page URL)</option>
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Scan runs</p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2">
                {scanRunOptions.map((run: ScanRunOption) => (
                  <label key={run.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScanRunIds.includes(run.id)}
                      onChange={() => toggleValue(selectedScanRunIds, run.id, setSelectedScanRunIds)}
                    />
                    <span className="flex-1">
                      {run.id.slice(0, 10)}... · {new Date(run.createdAt).toLocaleString()}
                    </span>
                    <Badge variant="outline">{run.status}</Badge>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Severity filter</p>
              <div className="grid grid-cols-2 gap-2">
                {severityOptions.map((severity) => (
                  <label key={severity} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSeverities.includes(severity)}
                      onChange={() => toggleValue(selectedSeverities, severity, setSelectedSeverities)}
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
                      onChange={() => toggleValue(selectedSources, source, setSelectedSources)}
                    />
                    <span>{source}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background p-4 xl:col-span-2">
          <h2 className="text-base font-semibold print:hidden">PDF Preview</h2>
          <p className="text-muted-foreground mt-1 text-sm print:hidden">
            This preview is what gets printed/saved when you click Generate PDF.
          </p>
          <div id="report-pdf-preview" className="mt-4">
            <ReportPdfPreview
              report={report}
              preview={preview}
              layout={layout}
              name={name}
            />
          </div>
        </div>
      </div>
      </section>
      <section id="report-pdf-print" className="hidden print:block print:p-4">
        <ReportPdfPreview
          report={report}
          preview={preview}
          layout={layout}
          name={name}
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
}: {
  report: { name?: string };
  preview: ReportPreview | undefined;
  layout: "compact" | "expanded";
  name: string;
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
        <PreviewMetric label="Total" value={preview.summary.total} />
        <PreviewMetric label="Critical" value={preview.summary.critical} />
        <PreviewMetric label="Serious" value={preview.summary.serious} />
        <PreviewMetric label="Moderate" value={preview.summary.moderate} />
        <PreviewMetric label="Minor" value={preview.summary.minor} />
        <PreviewMetric label="Manual" value={preview.summary.manualReviewRequired} />
      </section>

      {layout === "compact" ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Findings</h2>
          {preview.findings.map((finding) => (
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
          {preview.findings.length === 0 ? <p className="text-sm opacity-70">No findings match your filters.</p> : null}
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Findings By Page URL</h2>
          {preview.groupedByPage.map((group) => (
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
          {preview.groupedByPage.length === 0 ? <p className="text-sm opacity-70">No findings match your filters.</p> : null}
        </section>
      )}
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

