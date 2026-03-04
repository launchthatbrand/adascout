"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { ColumnDefinition } from "@acme/ui/entity-list";
import { EntityList } from "@acme/ui/entity-list";
import { api } from "@/convex/_generated/api";

type ReportRow = Record<string, unknown> & {
  id: string;
  scanRunId: string;
  totalFindings: number;
  criticalCount: number;
  generatedAt: number;
  profile: string;
};

export default function ReportsPage() {
  const reports = useQuery(api.reports.listMyReports, { limit: 200 });

  const reportRows = useMemo<ReportRow[]>(
    () =>
      (reports ?? []).map((report) => ({
          id: String(report._id),
          scanRunId: String(report.scanRunId),
          totalFindings: report.totalFindings,
          criticalCount: report.criticalCount,
          generatedAt: report.generatedAt,
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
            Report for {row.scanRunId.slice(0, 10)}...
          </Link>
        ),
      },
      { id: "profile", header: "Profile", accessorKey: "profile" },
      { id: "totalFindings", header: "Findings", accessorKey: "totalFindings" },
      {
        id: "generatedAt",
        header: "Generated",
        accessorKey: "generatedAt",
        cell: (row: ReportRow) => (
          <span className="text-muted-foreground text-xs">{new Date(row.generatedAt).toLocaleString()}</span>
        ),
      },
    ],
    [],
  );

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
      />
    </section>
  );
}

