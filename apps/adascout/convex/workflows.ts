import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { nowMs, requireUserId } from "./helpers";
import { scanRunStatusValidator } from "./scanTypes";

type WorkflowRunKind = "success" | "failed" | "canceled" | "pending";

const getWorkflowRunKind = (status: unknown): WorkflowRunKind => {
  const kind = (status as { workflow?: { runResult?: { kind?: unknown } } })?.workflow?.runResult?.kind;
  if (kind === "success" || kind === "failed" || kind === "canceled") return kind;
  return "pending";
};

export const listMyWorkflows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      workflowId: v.string(),
      scanRunId: v.id("scanRuns"),
      scanStatus: scanRunStatusValidator,
      scanCreatedAt: v.number(),
      scanUpdatedAt: v.number(),
      runKind: v.union(v.literal("success"), v.literal("failed"), v.literal("canceled"), v.literal("pending")),
      inProgressSteps: v.number(),
      workflowName: v.optional(v.string()),
      workflowHandle: v.optional(v.string()),
      statusError: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(200, Number(args.limit ?? 100)));
    const rows = await ctx.db
      .query("scanRuns")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .order("desc")
      .take(limit);

    const workflowRows = rows.filter((row) => typeof row.workflowId === "string" && row.workflowId.length > 0);
    const result: Array<{
      workflowId: string;
      scanRunId: Id<"scanRuns">;
      scanStatus: "queued" | "running" | "completed" | "failed" | "canceled";
      scanCreatedAt: number;
      scanUpdatedAt: number;
      runKind: WorkflowRunKind;
      inProgressSteps: number;
      workflowName?: string;
      workflowHandle?: string;
      statusError?: string;
    }> = [];

    for (const row of workflowRows) {
      const workflowId = row.workflowId as string;
      try {
        const status = await ctx.runQuery(components.workflow.workflow.getStatus, { workflowId });
        result.push({
          workflowId,
          scanRunId: row._id,
          scanStatus: row.status,
          scanCreatedAt: row.createdAt,
          scanUpdatedAt: row.updatedAt,
          runKind: getWorkflowRunKind(status),
          inProgressSteps: Array.isArray(status.inProgress) ? status.inProgress.length : 0,
          workflowName: status.workflow?.name,
          workflowHandle: status.workflow?.workflowHandle,
        });
      } catch (error) {
        result.push({
          workflowId,
          scanRunId: row._id,
          scanStatus: row.status,
          scanCreatedAt: row.createdAt,
          scanUpdatedAt: row.updatedAt,
          runKind: "pending",
          inProgressSteps: 0,
          statusError: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  },
});

export const deleteMyWorkflow = mutation({
  args: { workflowId: v.string() },
  returns: v.object({
    canceled: v.boolean(),
    cleanedUp: v.boolean(),
    affectedScanRuns: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("scanRuns")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .collect();
    const matching = rows.filter((row) => row.workflowId === args.workflowId);
    if (matching.length === 0) {
      throw new ConvexError("Workflow not found.");
    }

    let canceled = false;
    let cleanedUp = false;
    try {
      await ctx.runMutation(components.workflow.workflow.cancel, { workflowId: args.workflowId });
      canceled = true;
    } catch {
      canceled = false;
    }
    try {
      cleanedUp = await ctx.runMutation(components.workflow.workflow.cleanup, { workflowId: args.workflowId });
    } catch {
      cleanedUp = false;
    }

    const now = nowMs();
    for (const row of matching) {
      await ctx.db.patch(row._id, {
        workflowId: undefined,
        updatedAt: now,
      });
    }

    return {
      canceled,
      cleanedUp,
      affectedScanRuns: matching.length,
    };
  },
});

