"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { ColumnDefinition } from "@launchthatapp/ui/entity-list";
import { EntityList } from "@launchthatapp/ui/entity-list";
import { Button } from "@launchthatapp/ui/button";
import { api } from "@/convex/_generated/api";

type WorkflowRow = Record<string, unknown> & {
  workflowId: string;
  scanRunId: string;
  scanStatus: string;
  runKind: string;
  inProgressSteps: number;
  scanCreatedAt: number;
  scanUpdatedAt: number;
  workflowName?: string;
  workflowHandle?: string;
  statusError?: string;
};

export default function WorkflowsPage() {
  const workflows = useQuery(api.workflows.listMyWorkflows, { limit: 200 });
  const deleteWorkflow = useMutation(api.workflows.deleteMyWorkflow);
  const [statusMessage, setStatusMessage] = useState("");
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(null);

  const rows = useMemo<WorkflowRow[]>(
    () =>
      (workflows ?? []).map((row: {
        workflowId: string;
        scanRunId: string;
        scanStatus: string;
        runKind: string;
        inProgressSteps: number;
        scanCreatedAt: number;
        scanUpdatedAt: number;
        workflowName?: string;
        workflowHandle?: string;
        statusError?: string;
      }) => ({
        workflowId: row.workflowId,
        scanRunId: String(row.scanRunId),
        scanStatus: row.scanStatus,
        runKind: row.runKind,
        inProgressSteps: row.inProgressSteps,
        scanCreatedAt: row.scanCreatedAt,
        scanUpdatedAt: row.scanUpdatedAt,
        workflowName: row.workflowName,
        workflowHandle: row.workflowHandle,
        statusError: row.statusError,
      })),
    [workflows],
  );

  const columns = useMemo<ColumnDefinition<WorkflowRow>[]>(
    () => [
      {
        id: "workflow",
        header: "Workflow",
        accessorKey: "workflowId",
        cell: (row: WorkflowRow) => (
          <div className="space-y-1">
            <p className="font-medium">{row.workflowId}</p>
            <p className="text-muted-foreground text-xs">
              {row.workflowName ?? "workflow"} · {row.workflowHandle ?? "unknown-handle"}
            </p>
          </div>
        ),
      },
      {
        id: "scan",
        header: "Scan Run",
        accessorKey: "scanRunId",
        cell: (row: WorkflowRow) => (
          <Link href={`/admin/scans/${row.scanRunId}`} className="underline underline-offset-4">
            {row.scanRunId}
          </Link>
        ),
      },
      { id: "scanStatus", header: "Scan Status", accessorKey: "scanStatus" },
      { id: "runKind", header: "Workflow Result", accessorKey: "runKind" },
      {
        id: "inProgress",
        header: "In Progress Steps",
        accessorKey: "inProgressSteps",
      },
      {
        id: "updated",
        header: "Updated",
        accessorKey: "scanUpdatedAt",
        cell: (row: WorkflowRow) => (
          <span className="text-muted-foreground text-xs">{new Date(row.scanUpdatedAt).toLocaleString()}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "workflowId",
        cell: (row: WorkflowRow) => (
          <Button
            size="sm"
            variant="destructive"
            disabled={deletingWorkflowId === row.workflowId}
            onClick={async () => {
              const confirmed = window.confirm(
                "Delete this workflow from the workflow component? This will cancel/cleanup background execution.",
              );
              if (!confirmed) return;
              try {
                setDeletingWorkflowId(row.workflowId);
                const result = await deleteWorkflow({ workflowId: row.workflowId });
                setStatusMessage(
                  `Workflow deleted. canceled=${String(result.canceled)} cleanup=${String(result.cleanedUp)} affectedRuns=${result.affectedScanRuns}`,
                );
              } catch (error) {
                setStatusMessage(error instanceof Error ? error.message : "Failed to delete workflow.");
              } finally {
                setDeletingWorkflowId(null);
              }
            }}
          >
            Delete Workflow
          </Button>
        ),
      },
    ],
    [deleteWorkflow, deletingWorkflowId],
  );

  return (
    <section className="min-h-0 flex-1 p-4">
      <EntityList<WorkflowRow>
        data={rows}
        columns={columns}
        title="Workflows"
        description="Workflow component runs linked to your scan runs."
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        isLoading={workflows === undefined}
        getRowId={(row) => row.workflowId}
      />
      {statusMessage ? (
        <p className="text-muted-foreground mt-3 text-xs" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}

