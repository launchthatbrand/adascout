"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Badge } from "@launchthatapp/ui/badge";
import { Button } from "@launchthatapp/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function ScanPageDetailsPage() {
  const params = useParams();
  const scanRunIdParam = params.scanRunId;
  const pageRunIdParam = params.pageRunId;
  const scanRunId = typeof scanRunIdParam === "string" ? (scanRunIdParam as Id<"scanRuns">) : undefined;
  const pageRunId =
    typeof pageRunIdParam === "string" ? (pageRunIdParam as Id<"scanRunPages">) : undefined;

  const pageRuns = useQuery(
    api.scans.listMyScanRunPages,
    scanRunId ? { scanRunId, limit: 2000 } : "skip",
  );
  const pageRow = useMemo(
    () => (pageRuns ?? []).find((row) => String(row._id) === String(pageRunId ?? "")),
    [pageRunId, pageRuns],
  );
  const findings = useQuery(
    api.findings.listMyFindingsByScanRun,
    scanRunId && pageRunId ? { scanRunId, scanRunPageId: pageRunId, limit: 1000 } : "skip",
  );

  if (!scanRunId || !pageRunId) {
    return (
      <section className="p-4">
        <p className="text-sm">Invalid scan or page id.</p>
      </section>
    );
  }

  return (
    <section className="w-full space-y-4 p-4">
      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Page Findings</p>
            <p className="break-all text-sm font-medium">{pageRow?.pageUrl ?? String(pageRunId)}</p>
            <p className="text-muted-foreground text-xs">
              Status: {pageRow?.status ?? "unknown"} · Attempt: {pageRow?.attempt ?? 0}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/admin/scans/${scanRunId}`}>Back to Scan</Link>
            </Button>
            {pageRow?.pageUrl ? (
              <Button variant="outline" asChild>
                <a href={pageRow.pageUrl} target="_blank" rel="noopener noreferrer">
                  Visit URL
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(findings ?? []).map((finding) => (
          <article key={String(finding._id)} className="space-y-2 rounded-xl border border-border/60 bg-background p-4">
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
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-4"
              >
                Learn more
              </a>
            ) : null}
          </article>
        ))}
        {findings?.length === 0 ? (
          <div className="text-muted-foreground rounded-xl border border-border/60 bg-background px-4 py-6 text-sm">
            No findings were recorded for this page.
          </div>
        ) : null}
      </div>
    </section>
  );
}

