"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@acme/ui/button";
import {
  Globe,
  Scan,
  AlertTriangle,
  ArrowRight,
  Shield,
  CheckCircle,
} from "lucide-react";

export default function AdminDashboardPage() {
  const viewer = useQuery(api.viewer.currentUser);
  const stats = useQuery(api.viewer.dashboardStats);

  return (
    <section className="w-full space-y-6 p-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 text-white shadow-lg dark:border-indigo-800/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjEiLz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-100">
              Welcome
            </p>
          </div>
          <h2 className="mt-1 text-2xl font-semibold">
            {viewer?.name?.trim() ?? viewer?.email ?? "ADA Operator"}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-indigo-100">
            Monitor accessibility risk and generate WCAG 2.2 AA findings across
            websites and PDFs.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-white text-indigo-700 hover:bg-indigo-50"
            >
              <Link href="/admin/assets">
                Add Asset
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="border-indigo-300/50 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/admin/scans">View Scans</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="border-indigo-300/50 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/admin/workflows">Workflows</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Assets Card */}
        <Link
          href="/admin/assets"
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 opacity-0 transition-opacity group-hover:opacity-100 dark:from-emerald-950/30 dark:to-teal-950/30" />
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-teal-500" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <Globe className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Assets
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {stats?.assets ?? "..."}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {stats
                ? `${stats.urlAssets} URLs · ${stats.pdfAssets} PDFs`
                : "Website URLs and PDF files under monitoring."}
            </p>
          </div>
        </Link>

        {/* Scan Runs Card */}
        <Link
          href="/admin/scans"
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 transition-opacity group-hover:opacity-100 dark:from-blue-950/30 dark:to-indigo-950/30" />
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-indigo-500" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Scan className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Scan Runs
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {stats
                ? stats.queuedRuns +
                  stats.runningRuns +
                  stats.completedRuns +
                  stats.failedRuns
                : "..."}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {stats
                ? `${stats.runningRuns} running · ${stats.failedRuns} failed`
                : "Queued, running, completed, and failed scan history."}
            </p>
          </div>
        </Link>

        {/* Findings Card */}
        <Link
          href="/admin/reports"
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 opacity-0 transition-opacity group-hover:opacity-100 dark:from-amber-950/30 dark:to-orange-950/30" />
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-500 to-orange-500" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Findings
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {stats?.findings ?? "..."}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {stats
                ? `${stats.criticalFindings} critical issues · ${stats.reports} reports`
                : "Prioritized WCAG findings and downloadable reports."}
            </p>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Quick Actions
        </h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/assets" className="gap-2">
              <Globe className="h-4 w-4" />
              Add New Asset
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/scans" className="gap-2">
              <Scan className="h-4 w-4" />
              View Scan History
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/reports" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Download Reports
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
