"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { ColumnDefinition } from "@acme/ui/entity-list";
import { EntityList } from "@acme/ui/entity-list";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { Badge } from "@acme/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ReportRow extends Record<string, unknown> {
  id: string;
  assetId: string;
  scanRunId?: string;
  name?: string;
  layout: "compact" | "expanded";
  assetTitle?: string;
  assetSource?: string;
  totalFindings: number;
  criticalCount: number;
  generatedAt: number;
  updatedAt: number;
  profile: string;
}

interface ReportListRow {
  _id: Id<"reports">;
  assetId: Id<"assets">;
  scanRunId?: Id<"scanRuns">;
  name?: string;
  layout: "compact" | "expanded";
  assetTitle?: string;
  assetSource?: string;
  totalFindings: number;
  criticalCount: number;
  generatedAt: number;
  updatedAt: number;
  profile: string;
}

interface AssetOption {
  _id: Id<"assets">;
  title?: string;
  filename?: string;
  sourceUrl?: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const reports = useQuery(api.reports.listMyReports, { limit: 200 }) as ReportListRow[] | undefined;
  const assets = useQuery(api.assets.listMyAssets, { limit: 200 });
  const createReport = useMutation(api.reports.createMyReport);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [reportName, setReportName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const reportRows = useMemo<ReportRow[]>(
    () =>
      (reports ?? []).map((report) => ({
        id: String(report._id),
        assetId: String(report.assetId),
        scanRunId: report.scanRunId ? String(report.scanRunId) : undefined,
        name: report.name,
        layout: report.layout,
        assetTitle: report.assetTitle,
        assetSource: report.assetSource,
        totalFindings: report.totalFindings,
        criticalCount: report.criticalCount,
        generatedAt: report.generatedAt,
        updatedAt: report.updatedAt,
        profile: report.profile,
      })),
    [reports],
  );

  const columns = useMemo<ColumnDefinition<ReportRow>[]>(
    () => [
      {
        id: "report",
        header: "Report",
        accessorKey: "id",
        cell: (row: ReportRow) => (
          <Link href={`/admin/reports/${row.id}`} className="font-medium underline underline-offset-4">
            {row.name?.trim() ?? row.assetTitle ?? `Report ${row.id.slice(0, 10)}...`}
          </Link>
        ),
      },
      {
        id: "asset",
        header: "Asset",
        accessorKey: "assetTitle",
        cell: (row: ReportRow) => (
          <div className="space-y-1">
            <p>{row.assetTitle ?? row.assetId}</p>
            <p className="text-muted-foreground text-xs break-all">{row.assetSource ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "layout",
        header: "Layout",
        accessorKey: "layout",
        cell: (row: ReportRow) => <Badge variant="outline">{row.layout}</Badge>,
      },
      { id: "profile", header: "Profile", accessorKey: "profile" },
      { id: "totalFindings", header: "Findings", accessorKey: "totalFindings" },
      { id: "criticalCount", header: "Critical", accessorKey: "criticalCount" },
      {
        id: "generatedAt",
        header: "Generated",
        accessorKey: "generatedAt",
        cell: (row: ReportRow) => (
          <span className="text-muted-foreground text-xs">{new Date(row.generatedAt).toLocaleString()}</span>
        ),
      },
      {
        id: "updatedAt",
        header: "Updated",
        accessorKey: "updatedAt",
        cell: (row: ReportRow) => (
          <span className="text-muted-foreground text-xs">{new Date(row.updatedAt).toLocaleString()}</span>
        ),
      },
    ],
    [],
  );

  const handleCreateReport = async () => {
    if (!selectedAssetId) return;
    try {
      setIsSubmitting(true);
      const reportId = await createReport({
        assetId: selectedAssetId as Id<"assets">,
        name: reportName || undefined,
      });
      setDialogOpen(false);
      setSelectedAssetId("");
      setReportName("");
      router.push(`/admin/reports/${String(reportId)}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-0 flex-1 p-4">
      <EntityList<ReportRow>
        data={reportRows}
        columns={columns}
        title="Reports"
        description="Generated scan reports and downloadable exports."
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        isLoading={reports === undefined}
        getRowId={(row) => row.id}
        actions={
          <Button onClick={() => setDialogOpen(true)} disabled={isSubmitting}>
            Add New Report
          </Button>
        }
      />
      {statusMessage ? (
        <p className="text-muted-foreground mt-3 text-xs" role="status">
          {statusMessage}
        </p>
      ) : null}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create report</DialogTitle>
            <DialogDescription>
              Reports are linked to a single asset, then configured with run/severity/source filters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="report-asset">Asset</Label>
              <select
                id="report-asset"
                value={selectedAssetId}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="">Select asset...</option>
                {((assets ?? []) as AssetOption[]).map((asset) => (
                  <option key={String(asset._id)} value={String(asset._id)}>
                    {asset.title ?? asset.filename ?? asset.sourceUrl ?? String(asset._id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-name">Name (optional)</Label>
              <Input
                id="report-name"
                value={reportName}
                onChange={(event) => setReportName(event.target.value)}
                placeholder="Q2 ADA progress report"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateReport()} disabled={isSubmitting || !selectedAssetId}>
              {isSubmitting ? "Creating..." : "Create Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

