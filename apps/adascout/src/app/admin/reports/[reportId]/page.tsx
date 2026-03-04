"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useConvex, useQuery } from "convex/react";
import { Button } from "@acme/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function ReportDetailsPage() {
  const params = useParams();
  const reportIdParam = params.reportId;
  const reportId =
    typeof reportIdParam === "string" ? (reportIdParam as Id<"reports">) : undefined;
  const convex = useConvex();
  const report = useQuery(
    api.reports.getMyReportById,
    reportId ? { reportId } : "skip",
  );
  const [statusMessage, setStatusMessage] = useState("");

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

  const download = async (format: "json" | "markdown") => {
    try {
      const payload = await convex.query(api.reports.getMyReportExport, { reportId, format });
      const blob = new Blob([payload.body], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payload.filename;
      link.click();
      URL.revokeObjectURL(url);
      setStatusMessage("Download started.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Export failed.");
    }
  };

  return (
    <section className="w-full space-y-4 p-4">
      <div className="rounded-xl border border-border/60 bg-background p-4">
        <h1 className="text-xl font-semibold">Report {reportId}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Generated {report ? new Date(report.generatedAt).toLocaleString() : "..."} · Profile:{" "}
          {report?.profile ?? "wcag_2_2_aa"}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <Metric label="Total" value={report?.totalFindings ?? 0} />
          <Metric label="Critical" value={report?.criticalCount ?? 0} />
          <Metric label="Serious" value={report?.seriousCount ?? 0} />
          <Metric label="Moderate" value={report?.moderateCount ?? 0} />
          <Metric label="Minor" value={report?.minorCount ?? 0} />
          <Metric label="Manual Review" value={report?.manualReviewRequiredCount ?? 0} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => void download("markdown")}>
            Download Markdown
          </Button>
          <Button variant="outline" onClick={() => void download("json")}>
            Download JSON
          </Button>
        </div>
        {statusMessage ? <p className="text-muted-foreground mt-3 text-xs">{statusMessage}</p> : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-background">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-base font-semibold">Remediation Instructions</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Automated detection and guidance only. Manual validation is still required for full compliance.
          </p>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 text-sm leading-6">{report?.markdown}</pre>
      </div>
    </section>
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

