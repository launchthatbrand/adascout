"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Scan,
} from "lucide-react";

import { Badge } from "@launchthatapp/ui/badge";
import { Button } from "@launchthatapp/ui/button";
import { Card } from "@launchthatapp/ui/card";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";

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
    <div className="space-y-6">
      <div className="grid min-w-0 gap-4 overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Scans Card */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-blue-500 to-indigo-600" />
          <div className="p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Scan className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
              Total Scans
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalScans}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.runningScans > 0 && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {stats.runningScans} running
                </Badge>
              )}
              {stats.completedScans > 0 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {stats.completedScans} completed
                </Badge>
              )}
              {stats.failedScans > 0 && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {stats.failedScans} failed
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Total Findings Card */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-amber-500 to-orange-500" />
          <div className="p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
              Total Findings
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalFindings}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.criticalFindings > 0 && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {stats.criticalFindings} critical
                </Badge>
              )}
              {stats.seriousFindings > 0 && (
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  {stats.seriousFindings} serious
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Open Findings Card */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-red-500 to-rose-500" />
          <div className="p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
              <Clock className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
              Open Findings
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.openFindings}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Needs attention
            </p>
          </div>
        </Card>

        {/* Resolved Card */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-teal-500" />
          <div className="p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
              Resolved
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.resolvedFindings}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Fixed issues</p>
          </div>
        </Card>
      </div>

      {stats.latestScan && (
        <Card className="border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 dark:from-indigo-900/50 dark:to-violet-900/50 dark:text-indigo-400">
                <Scan className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
                  Latest Scan
                </p>
                <p className="font-mono text-sm text-slate-900 dark:text-slate-100">
                  {String(stats.latestScan._id).slice(0, 16)}...
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stats.latestScan.status === "failed"
                        ? "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/50 dark:text-red-300"
                        : stats.latestScan.status === "completed"
                          ? "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/50 dark:text-green-300"
                          : stats.latestScan.status === "running"
                            ? "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                            : "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                  >
                    {stats.latestScan.status}
                  </span>
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
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href={`/admin/assets/${assetId}/scans`}>
                  View Scans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/admin/assets/${assetId}/findings`}>
                  View Findings
                  <ArrowRight className="ml-2 h-4 w-4" />
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
