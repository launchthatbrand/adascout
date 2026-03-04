"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@acme/ui/button";

export default function AdminDashboardPage() {
  const viewer = useQuery(api.viewer.currentUser);
  const stats = useQuery(api.viewer.dashboardStats);

  return (
    <section className="w-full space-y-4 p-4">
      <div className="rounded-2xl border border-border/60 bg-background p-5">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Welcome</p>
        <h2 className="mt-1 text-xl font-semibold">{viewer?.name?.trim() ?? viewer?.email ?? "ADA Operator"}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Monitor accessibility risk and generate WCAG 2.2 AA findings across websites and PDFs.
        </p>
        <div className="mt-4 flex gap-2">
          <Button asChild>
            <Link href="/admin/assets">Add Asset</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/scans">View Scans</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/workflows">Workflows</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/assets"
          className="rounded-2xl border border-border/60 bg-background p-5 transition hover:bg-muted/30"
        >
          <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Assets</p>
          <p className="mt-1 text-3xl font-semibold">{stats?.assets ?? "..."}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {stats ? `${stats.urlAssets} URLs · ${stats.pdfAssets} PDFs` : "Website URLs and PDF files under monitoring."}
          </p>
        </Link>

        <Link
          href="/admin/scans"
          className="rounded-2xl border border-border/60 bg-background p-5 transition hover:bg-muted/30"
        >
          <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Scan Runs</p>
          <p className="mt-1 text-3xl font-semibold">
            {stats ? stats.queuedRuns + stats.runningRuns + stats.completedRuns + stats.failedRuns : "..."}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {stats
              ? `${stats.runningRuns} running · ${stats.failedRuns} failed`
              : "Queued, running, completed, and failed scan history."}
          </p>
        </Link>

        <Link
          href="/admin/reports"
          className="rounded-2xl border border-border/60 bg-background p-5 transition hover:bg-muted/30"
        >
          <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Findings</p>
          <p className="mt-1 text-3xl font-semibold">{stats?.findings ?? "..."}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {stats
              ? `${stats.criticalFindings} critical issues · ${stats.reports} reports generated`
              : "Prioritized WCAG findings and downloadable reports."}
          </p>
        </Link>
      </div>
    </section>
  );
}
