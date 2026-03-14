"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import { Card } from "@acme/ui/card";

export default function AssetOverviewPage() {
  const params = useParams();
  const assetIdParam = params.assetId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;

  const asset = useQuery(api.assets.getMyAsset, assetId ? { assetId } : "skip");
  const scanRuns = useQuery(
    api.scans.listMyScanRuns,
    assetId ? { assetId, limit: 100 } : "skip",
  );
  const findings = useQuery(
    api.findings.listMyFindingsByAsset,
    assetId ? { assetId, limit: 1000 } : "skip",
  );

  const stats = useMemo(() => {
    const totalScans = scanRuns?.length ?? 0;
    const completedScans =
      scanRuns?.filter((s) => s.status === "completed").length ?? 0;
    const runningScans =
      scanRuns?.filter((s) => s.status === "running").length ?? 0;
    const failedScans =
      scanRuns?.filter((s) => s.status === "failed").length ?? 0;

    const totalFindings = findings?.length ?? 0;
    const criticalFindings =
      findings?.filter((f) => f.severity === "critical").length ?? 0;
    const seriousFindings =
      findings?.filter((f) => f.severity === "serious").length ?? 0;
    const openFindings =
      findings?.filter((f) => f.status === "open" || f.status === "in_progress")
        .length ?? 0;
    const resolvedFindings =
      findings?.filter(
        (f) => f.status === "resolved" || f.status === "verified_on_rescan",
      ).length ?? 0;

    const latestScan = scanRuns?.[0];

    return {
      totalScans,
      completedScans,
      runningScans,
      failedScans,
      totalFindings,
      criticalFindings,
      seriousFindings,
      openFindings,
      resolvedFindings,
      latestScan,
    };
  }, [scanRuns, findings]);

  if (asset === undefined) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Loading asset...</p>
      </div>
    );
  }

  if (asset === null) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Asset not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
            Total Scans
          </p>
          <p className="text-2xl font-semibold">{stats.totalScans}</p>
          <div className="mt-2 flex gap-2">
            {stats.runningScans > 0 && (
              <Badge variant="secondary">{stats.runningScans} running</Badge>
            )}
            {stats.completedScans > 0 && (
              <Badge variant="default">{stats.completedScans} completed</Badge>
            )}
            {stats.failedScans > 0 && (
              <Badge variant="destructive">{stats.failedScans} failed</Badge>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
            Total Findings
          </p>
          <p className="text-2xl font-semibold">{stats.totalFindings}</p>
          <div className="mt-2 flex gap-2">
            {stats.criticalFindings > 0 && (
              <Badge variant="destructive">
                {stats.criticalFindings} critical
              </Badge>
            )}
            {stats.seriousFindings > 0 && (
              <Badge variant="destructive">
                {stats.seriousFindings} serious
              </Badge>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
            Open Findings
          </p>
          <p className="text-2xl font-semibold">{stats.openFindings}</p>
          <p className="text-muted-foreground text-xs">Needs attention</p>
        </Card>

        <Card className="p-4">
          <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
            Resolved
          </p>
          <p className="text-2xl font-semibold">{stats.resolvedFindings}</p>
          <p className="text-muted-foreground text-xs">Fixed issues</p>
        </Card>
      </div>

      {stats.latestScan && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                Latest Scan
              </p>
              <p className="font-mono text-sm">
                {String(stats.latestScan._id).slice(0, 16)}...
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant={
                    stats.latestScan.status === "failed"
                      ? "destructive"
                      : stats.latestScan.status === "completed"
                        ? "default"
                        : stats.latestScan.status === "running"
                          ? "secondary"
                          : "outline"
                  }
                >
                  {stats.latestScan.status}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {stats.latestScan.completedPages ?? 0}/
                  {stats.latestScan.totalPages ?? "?"} pages
                </span>
                {stats.latestScan.findingCount !== undefined && (
                  <span className="text-muted-foreground text-xs">
                    {stats.latestScan.findingCount} findings
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/admin/assets/${assetId}/scans`}>View Scans</Link>
              </Button>
              <Button asChild>
                <Link href={`/admin/assets/${assetId}/findings`}>
                  View Findings
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {stats.totalScans === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No scans yet for this asset.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Start a new scan to begin finding issues.
          </p>
        </Card>
      )}
    </div>
  );
}
