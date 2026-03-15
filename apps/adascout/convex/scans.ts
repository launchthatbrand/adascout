import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { nowMs, requireUserId } from "./helpers";
import { discoverWebsiteUrls } from "./scanRunner";
import {
  findingSeverityValidator,
  findingSourceValidator,
  findingStatusValidator,
  scanRunModeValidator,
  scanRunPageStatusValidator,
  scanRunStatusValidator,
  scanSummaryValidator,
  wcagProfileValidator,
} from "./scanTypes";
import { workflow } from "./workflow";

interface FindingSummaryRow {
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  manualReviewRequired?: boolean;
}

interface WorkflowStarter {
  start: (
    ctx: unknown,
    workflowRef: unknown,
    args: Record<string, unknown>,
  ) => Promise<string>;
}

const workflowStarter = workflow as unknown as WorkflowStarter;
const websiteScanWorkflowRef = (
  internal as unknown as {
    websiteScanWorkflow: { runWebsiteScanWorkflow: unknown };
  }
).websiteScanWorkflow.runWebsiteScanWorkflow;

const computeSummary = (findings: FindingSummaryRow[]) => {
  const summary = {
    total: findings.length,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    info: 0,
    manualReviewRequired: 0,
  };
  for (const finding of findings) {
    summary[finding.severity] += 1;
    if (finding.manualReviewRequired) {
      summary.manualReviewRequired += 1;
    }
  }
  return summary;
};

const computeEvidenceHash = (args: {
  source: "axe" | "ibm" | "pdf" | "stagehand";
  ruleId: string;
  target?: string;
  pageUrl?: string;
  codeSnippet?: string;
}) =>
  [
    args.source,
    args.ruleId,
    args.target ?? "",
    args.pageUrl ?? "",
    args.codeSnippet ?? "",
  ]
    .join("|")
    .toLowerCase();

export { computeEvidenceHash };

const deleteScanRunCascade = async (
  ctx: MutationCtx,
  scanRunId: Id<"scanRuns">,
): Promise<void> => {
  const scanRun = await ctx.db.get(scanRunId);
  if (scanRun?.workflowId) {
    await ctx
      .runMutation(components.workflow.workflow.cancel, {
        workflowId: scanRun.workflowId,
      })
      .catch(() => null);
    await ctx
      .runMutation(components.workflow.workflow.cleanup, {
        workflowId: scanRun.workflowId,
      })
      .catch(() => false);
  }

  const pageRows = await ctx.db
    .query("scanRunPages")
    .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", scanRunId))
    .collect();
  for (const pageRow of pageRows) {
    const pageFindings = await ctx.db
      .query("findings")
      .withIndex("by_scanRunPage_createdAt", (q) =>
        q.eq("scanRunPageId", pageRow._id),
      )
      .collect();
    for (const finding of pageFindings) {
      await ctx.db.delete(finding._id);
    }
  }

  const runFindings = await ctx.db
    .query("findings")
    .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", scanRunId))
    .collect();
  for (const finding of runFindings) {
    await ctx.db.delete(finding._id);
  }

  const reports = await ctx.db
    .query("reports")
    .withIndex("by_scanRun", (q) => q.eq("scanRunId", scanRunId))
    .collect();
  for (const report of reports) {
    await ctx.db.delete(report._id);
  }

  const leases = await ctx.db
    .query("scanSessionLeases")
    .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", scanRunId))
    .collect();
  for (const lease of leases) {
    await ctx.db.delete(lease._id);
  }

  for (const pageRow of pageRows) {
    await ctx.db.delete(pageRow._id);
  }

  await ctx.db.delete(scanRunId);
};

const buildReportMarkdown = (args: {
  assetLabel: string;
  profile: "wcag_2_2_aa";
  generatedAt: number;
  summary: ReturnType<typeof computeSummary>;
  totalPages?: number;
  completedPages?: number;
  failedPages?: number;
}) =>
  [
    "# ADA Scout Report",
    "",
    `- Asset: ${args.assetLabel}`,
    `- Profile: ${args.profile}`,
    `- Generated: ${new Date(args.generatedAt).toISOString()}`,
    typeof args.totalPages === "number"
      ? `- Pages scanned: ${args.completedPages ?? 0}/${args.totalPages}`
      : null,
    typeof args.failedPages === "number" && args.failedPages > 0
      ? `- Failed pages: ${args.failedPages}`
      : null,
    "",
    "## Summary",
    `- Total: ${args.summary.total}`,
    `- Critical: ${args.summary.critical}`,
    `- Serious: ${args.summary.serious}`,
    `- Moderate: ${args.summary.moderate}`,
    `- Minor: ${args.summary.minor}`,
    `- Info: ${args.summary.info}`,
    `- Manual review required: ${args.summary.manualReviewRequired}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

export const createScanRun = mutation({
  args: {
    assetId: v.id("assets"),
    profile: v.optional(wcagProfileValidator),
    pageUrls: v.optional(v.array(v.string())),
  },
  returns: v.id("scanRuns"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Asset not found.");
    }
    const existing = await ctx.db
      .query("scanRuns")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .first();
    if (
      existing &&
      (existing.status === "queued" || existing.status === "running")
    ) {
      return existing._id;
    }

    const userRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .collect();
    const activeRuns = userRuns.filter(
      (row) => row.status === "queued" || row.status === "running",
    );
    const dayAgo = nowMs() - 24 * 60 * 60 * 1000;
    const recentRuns = userRuns.filter((row) => row.createdAt >= dayAgo);
    if (activeRuns.length >= 3) {
      throw new ConvexError(
        "Too many active scans. Wait for running scans to finish.",
      );
    }
    if (recentRuns.length >= 100) {
      throw new ConvexError(
        "Daily scan quota reached for this MVP environment.",
      );
    }

    const now = nowMs();
    const mode = asset.kind === "url" ? "website_pages" : "single_asset";
    const scanRunId = await ctx.db.insert("scanRuns", {
      assetId: args.assetId,
      profile: args.profile ?? "wcag_2_2_aa",
      mode,
      status: "queued",
      queuedAt: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    if (mode === "website_pages") {
      const workflowId = await workflowStarter.start(
        ctx,
        websiteScanWorkflowRef,
        { scanRunId, pageUrls: args.pageUrls },
      );
      await ctx.db.patch(scanRunId, {
        workflowId,
        updatedAt: nowMs(),
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.scanRunner.processScanRun, {
        scanRunId,
      });
    }
    return scanRunId;
  },
});

export const rerunScan = mutation({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.id("scanRuns"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const previous = await ctx.db.get(args.scanRunId);
    if (!previous || previous.createdBy !== userId) {
      throw new ConvexError("Scan run not found.");
    }
    const now = nowMs();
    const asset = await ctx.db.get(previous.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Asset not found.");
    }
    const mode = asset.kind === "url" ? "website_pages" : "single_asset";
    const scanRunId = await ctx.db.insert("scanRuns", {
      assetId: previous.assetId,
      profile: previous.profile,
      mode,
      status: "queued",
      queuedAt: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    if (mode === "website_pages") {
      const workflowId = await workflowStarter.start(
        ctx,
        websiteScanWorkflowRef,
        { scanRunId },
      );
      await ctx.db.patch(scanRunId, {
        workflowId,
        updatedAt: nowMs(),
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.scanRunner.processScanRun, {
        scanRunId,
      });
    }
    return scanRunId;
  },
});

export const rerunSelectedPages = mutation({
  args: {
    scanRunId: v.id("scanRuns"),
    pageRunIds: v.optional(v.array(v.id("scanRunPages"))),
    onlyFailed: v.optional(v.boolean()),
    includeAllPages: v.optional(v.boolean()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRun = await ctx.db.get(args.scanRunId);
    if (
      !scanRun ||
      scanRun.createdBy !== userId ||
      scanRun.mode !== "website_pages"
    ) {
      throw new ConvexError("Website scan run not found.");
    }

    const rows = await ctx.db
      .query("scanRunPages")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();

    const allowedIds = new Set(rows.map((row) => row._id));
    const requestedIds = (args.pageRunIds ?? []).filter((id) =>
      allowedIds.has(id),
    );

    const eligibleByLifecycle = new Set<Id<"scanRunPages">>();
    const allRunFindings = await ctx.db
      .query("findings")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();
    for (const finding of allRunFindings) {
      if (!finding.scanRunPageId) continue;
      const findingStatus = finding.status ?? "open";
      if (findingStatus === "resolved" || findingStatus === "in_progress") {
        eligibleByLifecycle.add(finding.scanRunPageId);
      }
    }

    const finalTargetIds: Id<"scanRunPages">[] =
      requestedIds.length > 0
        ? requestedIds
        : rows
            .filter((row) => {
              if (args.onlyFailed && row.status !== "failed") return false;
              if (args.includeAllPages) return true;
              return eligibleByLifecycle.has(row._id);
            })
            .map((row) => row._id);

    if (finalTargetIds.length === 0) {
      return 0;
    }

    await ctx.runMutation(internal.scans.preparePageRerun, {
      scanRunId: scanRun._id,
      pageRunIds: finalTargetIds,
    });

    const workflowId = await workflowStarter.start(
      ctx,
      websiteScanWorkflowRef,
      {
        scanRunId: scanRun._id,
        pageRunIds: finalTargetIds,
      },
    );
    await ctx.db.patch(scanRun._id, {
      workflowId,
      updatedAt: nowMs(),
    });

    return finalTargetIds.length;
  },
});

export const cancelMyScanRun = mutation({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.object({
    canceledPages: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      throw new ConvexError("Scan run not found.");
    }
    if (scanRun.status !== "queued" && scanRun.status !== "running") {
      return { canceledPages: 0 };
    }

    const pages = await ctx.db
      .query("scanRunPages")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();
    const now = nowMs();
    let canceledPages = 0;

    for (const page of pages) {
      if (page.status === "queued" || page.status === "running") {
        await ctx.db.patch(page._id, {
          status: "canceled",
          failedAt: now,
          errorMessage: "Scan canceled by user.",
          updatedAt: now,
        });
        canceledPages += 1;
      }
    }

    const leases = await ctx.db
      .query("scanSessionLeases")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();
    for (const lease of leases) {
      await ctx.db.delete(lease._id);
    }

    await ctx.db.patch(args.scanRunId, {
      status: "canceled",
      completedAt: now,
      errorMessage: "Scan canceled by user.",
      updatedAt: now,
      lastProgressAt: now,
    });
    if (scanRun.workflowId) {
      await ctx
        .runMutation(components.workflow.workflow.cancel, {
          workflowId: scanRun.workflowId,
        })
        .catch(() => null);
      await ctx
        .runMutation(components.workflow.workflow.cleanup, {
          workflowId: scanRun.workflowId,
        })
        .catch(() => false);
    }

    return { canceledPages };
  },
});

export const deleteScanRunCascadeInternal = internalMutation({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) return null;
    await deleteScanRunCascade(ctx, args.scanRunId);
    return null;
  },
});

export const deleteMyScanRun = mutation({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      throw new ConvexError("Scan run not found.");
    }
    await deleteScanRunCascade(ctx, args.scanRunId);
    return null;
  },
});

export const listMyScanRuns = query({
  args: {
    assetId: v.optional(v.id("assets")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("scanRuns"),
      _creationTime: v.number(),
      assetId: v.id("assets"),
      workflowId: v.optional(v.string()),
      createdBy: v.id("users"),
      mode: v.optional(scanRunModeValidator),
      profile: wcagProfileValidator,
      status: scanRunStatusValidator,
      queuedAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      findingCount: v.optional(v.number()),
      totalPages: v.optional(v.number()),
      queuedPages: v.optional(v.number()),
      runningPages: v.optional(v.number()),
      completedPages: v.optional(v.number()),
      failedPages: v.optional(v.number()),
      discoveredAt: v.optional(v.number()),
      lastProgressAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
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
    return args.assetId
      ? rows.filter((row) => row.assetId === args.assetId)
      : rows;
  },
});

export const getMyScanRun = query({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.union(
    v.object({
      _id: v.id("scanRuns"),
      _creationTime: v.number(),
      assetId: v.id("assets"),
      workflowId: v.optional(v.string()),
      createdBy: v.id("users"),
      mode: v.optional(scanRunModeValidator),
      profile: wcagProfileValidator,
      status: scanRunStatusValidator,
      queuedAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      findingCount: v.optional(v.number()),
      totalPages: v.optional(v.number()),
      queuedPages: v.optional(v.number()),
      runningPages: v.optional(v.number()),
      completedPages: v.optional(v.number()),
      failedPages: v.optional(v.number()),
      discoveredAt: v.optional(v.number()),
      lastProgressAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.scanRunId);
    if (!row || row.createdBy !== userId) {
      return null;
    }
    return row;
  },
});

export const getScanRunForProcessing = internalQuery({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.union(
    v.object({
      scanRun: v.object({
        _id: v.id("scanRuns"),
        assetId: v.id("assets"),
        profile: wcagProfileValidator,
        mode: v.optional(scanRunModeValidator),
        status: scanRunStatusValidator,
        createdBy: v.id("users"),
      }),
      asset: v.object({
        _id: v.id("assets"),
        kind: v.union(v.literal("url"), v.literal("file_pdf")),
        title: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        normalizedUrl: v.optional(v.string()),
        filename: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) return null;
    const asset = await ctx.db.get(scanRun.assetId);
    if (!asset) return null;
    return {
      scanRun: {
        _id: scanRun._id,
        assetId: scanRun.assetId,
        profile: scanRun.profile,
        mode: scanRun.mode,
        status: scanRun.status,
        createdBy: scanRun.createdBy,
      },
      asset: {
        _id: asset._id,
        kind: asset.kind,
        title: asset.title,
        sourceUrl: asset.sourceUrl,
        normalizedUrl: asset.normalizedUrl,
        filename: asset.filename,
        storageId: asset.storageId,
      },
    };
  },
});

export const listMyScanRunPages = query({
  args: {
    scanRunId: v.id("scanRuns"),
    status: v.optional(scanRunPageStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("scanRunPages"),
      _creationTime: v.number(),
      scanRunId: v.id("scanRuns"),
      assetId: v.id("assets"),
      createdBy: v.id("users"),
      pageUrl: v.string(),
      normalizedUrl: v.string(),
      status: scanRunPageStatusValidator,
      attempt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      findingCount: v.optional(v.number()),
      retryCount: v.optional(v.number()),
      lastQueueWaitMs: v.optional(v.number()),
      lastExtractLatencyMs: v.optional(v.number()),
      lastErrorCategory: v.optional(v.string()),
      terminalErrorCategory: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      return [];
    }
    const limit = Math.max(1, Math.min(2000, Number(args.limit ?? 500)));
    const rows = await ctx.db
      .query("scanRunPages")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .order("asc")
      .take(limit);
    return args.status
      ? rows.filter((row) => row.status === args.status)
      : rows;
  },
});

export const listMyScanRunPagesByAsset = query({
  args: {
    assetId: v.id("assets"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("scanRunPages"),
      _creationTime: v.number(),
      scanRunId: v.id("scanRuns"),
      assetId: v.id("assets"),
      createdBy: v.id("users"),
      pageUrl: v.string(),
      normalizedUrl: v.string(),
      status: scanRunPageStatusValidator,
      attempt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      findingCount: v.optional(v.number()),
      retryCount: v.optional(v.number()),
      lastQueueWaitMs: v.optional(v.number()),
      lastExtractLatencyMs: v.optional(v.number()),
      lastErrorCategory: v.optional(v.string()),
      terminalErrorCategory: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return [];
    }
    const limit = Math.max(1, Math.min(2000, Number(args.limit ?? 1000)));

    const scanRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .take(100);

    type PageRow = {
      _id: Id<"scanRunPages">;
      _creationTime: number;
      scanRunId: Id<"scanRuns">;
      assetId: Id<"assets">;
      createdBy: Id<"users">;
      pageUrl: string;
      normalizedUrl: string;
      status: "queued" | "running" | "completed" | "failed" | "canceled";
      attempt: number;
      startedAt?: number;
      completedAt?: number;
      failedAt?: number;
      errorMessage?: string;
      findingCount?: number;
      retryCount?: number;
      lastQueueWaitMs?: number;
      lastExtractLatencyMs?: number;
      lastErrorCategory?: string;
      terminalErrorCategory?: string;
      createdAt: number;
      updatedAt: number;
    };

    const allPages: PageRow[] = [];
    for (const scanRun of scanRuns) {
      const pages = await ctx.db
        .query("scanRunPages")
        .withIndex("by_scanRun_createdAt", (q) =>
          q.eq("scanRunId", scanRun._id),
        )
        .order("asc")
        .take(limit);
      allPages.push(...(pages as PageRow[]));
    }

    return allPages.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  },
});

export const getMyScanRunPage = query({
  args: {
    pageId: v.id("scanRunPages"),
  },
  returns: v.union(
    v.object({
      _id: v.id("scanRunPages"),
      _creationTime: v.number(),
      scanRunId: v.id("scanRuns"),
      assetId: v.id("assets"),
      createdBy: v.id("users"),
      pageUrl: v.string(),
      normalizedUrl: v.string(),
      status: scanRunPageStatusValidator,
      attempt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      findingCount: v.optional(v.number()),
      retryCount: v.optional(v.number()),
      lastQueueWaitMs: v.optional(v.number()),
      lastExtractLatencyMs: v.optional(v.number()),
      lastErrorCategory: v.optional(v.string()),
      terminalErrorCategory: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await ctx.db.get(args.pageId);
    if (!page) {
      return null;
    }
    const scanRun = await ctx.db.get(page.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      return null;
    }
    return page;
  },
});

const recomputeScanRunProgress = async (
  ctx: MutationCtx,
  scanRunId: Id<"scanRuns">,
) => {
  const scanRun = await ctx.db.get(scanRunId);
  if (!scanRun) {
    return {
      totalPages: 0,
      queuedPages: 0,
      runningPages: 0,
      completedPages: 0,
      failedPages: 0,
      status: "failed" as const,
    };
  }
  if (scanRun.status === "canceled") {
    return {
      totalPages: Number(scanRun.totalPages ?? 0),
      queuedPages: Number(scanRun.queuedPages ?? 0),
      runningPages: Number(scanRun.runningPages ?? 0),
      completedPages: Number(scanRun.completedPages ?? 0),
      failedPages: Number(scanRun.failedPages ?? 0),
      status: "canceled" as const,
    };
  }

  const pages = await ctx.db
    .query("scanRunPages")
    .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", scanRunId))
    .collect();
  let queuedPages = 0;
  let runningPages = 0;
  let completedPages = 0;
  let failedPages = 0;
  for (const page of pages) {
    if (page.status === "queued") queuedPages += 1;
    if (page.status === "running") runningPages += 1;
    if (page.status === "completed") completedPages += 1;
    if (page.status === "failed") failedPages += 1;
  }
  const totalPages = pages.length;
  const now = nowMs();
  const status: "running" | "completed" =
    queuedPages > 0 || runningPages > 0 ? "running" : "completed";
  await ctx.db.patch(scanRunId, {
    status,
    totalPages,
    queuedPages,
    runningPages,
    completedPages,
    failedPages,
    startedAt: now,
    lastProgressAt: now,
    updatedAt: now,
  });
  return {
    totalPages,
    queuedPages,
    runningPages,
    completedPages,
    failedPages,
    status,
  };
};

export const upsertScanRunPages = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    assetId: v.id("assets"),
    createdBy: v.id("users"),
    pageUrls: v.array(v.string()),
  },
  returns: v.object({
    insertedCount: v.number(),
    totalPages: v.number(),
  }),
  handler: async (ctx, args) => {
    const existingRows = await ctx.db
      .query("scanRunPages")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();
    const existing = new Set(existingRows.map((row) => row.normalizedUrl));
    let insertedCount = 0;
    const now = nowMs();
    for (const pageUrl of args.pageUrls) {
      if (existing.has(pageUrl)) continue;
      await ctx.db.insert("scanRunPages", {
        scanRunId: args.scanRunId,
        assetId: args.assetId,
        createdBy: args.createdBy,
        pageUrl,
        normalizedUrl: pageUrl,
        status: "queued",
        attempt: 0,
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      existing.add(pageUrl);
      insertedCount += 1;
    }
    await ctx.db.patch(args.scanRunId, {
      mode: "website_pages",
      discoveredAt: now,
      startedAt: now,
      status: "running",
      updatedAt: now,
    });
    const progress = await recomputeScanRunProgress(ctx, args.scanRunId);
    return { insertedCount, totalPages: progress.totalPages };
  },
});

export const claimQueuedScanRunPages = internalMutation({
  args: { scanRunId: v.id("scanRuns"), limit: v.number() },
  returns: v.array(v.id("scanRunPages")),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("scanRunPages")
      .withIndex("by_scanRun_status", (q) =>
        q.eq("scanRunId", args.scanRunId).eq("status", "queued"),
      )
      .order("asc")
      .take(Math.max(1, Math.min(25, args.limit)));
    return rows.map((row) => row._id);
  },
});

export const cleanupExpiredSessionLeases = internalMutation({
  args: {
    leaseKey: v.string(),
    now: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const expired = await ctx.db
      .query("scanSessionLeases")
      .withIndex("by_leaseKey_expiresAt", (q) =>
        q.eq("leaseKey", args.leaseKey).lt("expiresAt", args.now),
      )
      .collect();
    for (const lease of expired) {
      await ctx.db.delete(lease._id);
    }
    return expired.length;
  },
});

export const acquireSessionLease = internalMutation({
  args: {
    leaseKey: v.string(),
    holderId: v.string(),
    scanRunId: v.id("scanRuns"),
    maxConcurrent: v.number(),
    ttlMs: v.number(),
    now: v.number(),
    planTier: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scanSessionLeases")
      .withIndex("by_leaseKey_holderId", (q) =>
        q.eq("leaseKey", args.leaseKey).eq("holderId", args.holderId),
      )
      .first();
    if (existing) {
      if (existing.expiresAt > args.now) {
        await ctx.db.patch(existing._id, {
          expiresAt: args.now + args.ttlMs,
          lastHeartbeatAt: args.now,
          updatedAt: args.now,
        });
        return true;
      }
      await ctx.db.delete(existing._id);
    }

    const active = await ctx.db
      .query("scanSessionLeases")
      .withIndex("by_leaseKey_expiresAt", (q) =>
        q.eq("leaseKey", args.leaseKey).gt("expiresAt", args.now),
      )
      .collect();
    if (active.length >= Math.max(1, args.maxConcurrent)) {
      return false;
    }

    await ctx.db.insert("scanSessionLeases", {
      leaseKey: args.leaseKey,
      holderId: args.holderId,
      scanRunId: args.scanRunId,
      startedAt: args.now,
      expiresAt: args.now + args.ttlMs,
      lastHeartbeatAt: args.now,
      planTier: args.planTier,
      maxConcurrentAtAcquire: args.maxConcurrent,
      createdAt: args.now,
      updatedAt: args.now,
    });
    return true;
  },
});

export const heartbeatSessionLease = internalMutation({
  args: {
    leaseKey: v.string(),
    holderId: v.string(),
    ttlMs: v.number(),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("scanSessionLeases")
      .withIndex("by_leaseKey_holderId", (q) =>
        q.eq("leaseKey", args.leaseKey).eq("holderId", args.holderId),
      )
      .first();
    if (!lease) return false;
    await ctx.db.patch(lease._id, {
      expiresAt: args.now + args.ttlMs,
      lastHeartbeatAt: args.now,
      updatedAt: args.now,
    });
    return true;
  },
});

export const releaseSessionLease = internalMutation({
  args: {
    leaseKey: v.string(),
    holderId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("scanSessionLeases")
      .withIndex("by_leaseKey_holderId", (q) =>
        q.eq("leaseKey", args.leaseKey).eq("holderId", args.holderId),
      )
      .collect();
    for (const lease of matches) {
      await ctx.db.delete(lease._id);
    }
    return matches.length;
  },
});

export const getScanRunPageForProcessing = internalQuery({
  args: { scanRunId: v.id("scanRuns"), pageRunId: v.id("scanRunPages") },
  returns: v.union(
    v.object({
      scanRun: v.object({
        _id: v.id("scanRuns"),
        assetId: v.id("assets"),
        profile: wcagProfileValidator,
        createdBy: v.id("users"),
      }),
      pageRun: v.object({
        _id: v.id("scanRunPages"),
        pageUrl: v.string(),
        normalizedUrl: v.string(),
        status: scanRunPageStatusValidator,
        attempt: v.number(),
        createdAt: v.number(),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) return null;
    const pageRun = await ctx.db.get(args.pageRunId);
    if (!pageRun || pageRun.scanRunId !== args.scanRunId) return null;
    return {
      scanRun: {
        _id: scanRun._id,
        assetId: scanRun.assetId,
        profile: scanRun.profile,
        createdBy: scanRun.createdBy,
      },
      pageRun: {
        _id: pageRun._id,
        pageUrl: pageRun.pageUrl,
        normalizedUrl: pageRun.normalizedUrl,
        status: pageRun.status,
        attempt: pageRun.attempt,
        createdAt: pageRun.createdAt,
      },
    };
  },
});

export const isScanRunCanceled = internalQuery({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) return true;
    return scanRun.status === "canceled";
  },
});

export const isScanRunCanceledForWorkflow = internalMutation({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) return true;
    return scanRun.status === "canceled";
  },
});

export const markScanRunPageRunning = internalMutation({
  args: {
    pageRunId: v.id("scanRunPages"),
    queueWaitMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageRunId);
    if (!page) return null;
    const now = nowMs();
    await ctx.db.patch(args.pageRunId, {
      status: "running",
      attempt: page.attempt + 1,
      retryCount: Math.max(0, page.attempt),
      lastQueueWaitMs: args.queueWaitMs,
      startedAt: now,
      errorMessage: undefined,
      lastErrorCategory: undefined,
      updatedAt: now,
    });
    await recomputeScanRunProgress(ctx, page.scanRunId);
    return null;
  },
});

export const claimScanRunPageForExecution = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
    queueWaitMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageRunId);
    if (!page) return false;
    if (page.scanRunId !== args.scanRunId) return false;
    if (page.status !== "queued") return false;
    const now = nowMs();
    await ctx.db.patch(args.pageRunId, {
      status: "running",
      attempt: page.attempt + 1,
      retryCount: Math.max(0, page.attempt),
      lastQueueWaitMs: args.queueWaitMs,
      startedAt: now,
      errorMessage: undefined,
      lastErrorCategory: undefined,
      updatedAt: now,
    });
    await recomputeScanRunProgress(ctx, args.scanRunId);
    return true;
  },
});

export const completeScanRunPage = internalMutation({
  args: {
    pageRunId: v.id("scanRunPages"),
    findingCount: v.number(),
    extractLatencyMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageRunId);
    if (!page) return null;
    const now = nowMs();
    await ctx.db.patch(args.pageRunId, {
      status: "completed",
      completedAt: now,
      findingCount: args.findingCount,
      lastExtractLatencyMs: args.extractLatencyMs,
      errorMessage: undefined,
      updatedAt: now,
    });
    await recomputeScanRunProgress(ctx, page.scanRunId);
    return null;
  },
});

export const failScanRunPage = internalMutation({
  args: {
    pageRunId: v.id("scanRunPages"),
    errorMessage: v.string(),
    errorCategory: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageRunId);
    if (!page) return null;
    const now = nowMs();
    await ctx.db.patch(args.pageRunId, {
      status: "failed",
      failedAt: now,
      errorMessage: args.errorMessage,
      lastErrorCategory: args.errorCategory,
      terminalErrorCategory: args.errorCategory,
      updatedAt: now,
    });
    await recomputeScanRunProgress(ctx, page.scanRunId);
    return null;
  },
});

export const preparePageRerun = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    pageRunIds: v.array(v.id("scanRunPages")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let updated = 0;
    const now = nowMs();
    for (const pageRunId of args.pageRunIds) {
      const page = await ctx.db.get(pageRunId);
      if (!page || page.scanRunId !== args.scanRunId) continue;
      const oldFindings = await ctx.db
        .query("findings")
        .withIndex("by_scanRunPage_createdAt", (q) =>
          q.eq("scanRunPageId", pageRunId),
        )
        .collect();
      for (const finding of oldFindings) {
        await ctx.db.delete(finding._id);
      }
      await ctx.db.patch(pageRunId, {
        status: "queued",
        startedAt: undefined,
        completedAt: undefined,
        failedAt: undefined,
        errorMessage: undefined,
        findingCount: undefined,
        terminalErrorCategory: undefined,
        updatedAt: now,
      });
      updated += 1;
    }
    await recomputeScanRunProgress(ctx, args.scanRunId);
    return updated;
  },
});

export const getAssetStorageUrl = internalQuery({
  args: { assetId: v.id("assets") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset?.storageId) return null;
    return await ctx.storage.getUrl(asset.storageId);
  },
});

export const replaceFindingsForRun = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    assetId: v.id("assets"),
    findings: v.array(
      v.object({
        source: findingSourceValidator,
        severity: findingSeverityValidator,
        ruleId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        help: v.optional(v.string()),
        helpUrl: v.optional(v.string()),
        target: v.optional(v.string()),
        pageUrl: v.optional(v.string()),
        pageNumber: v.optional(v.number()),
        codeSnippet: v.optional(v.string()),
        manualReviewRequired: v.optional(v.boolean()),
        confidence: v.optional(v.number()),
        status: v.optional(findingStatusValidator),
        resolvedAt: v.optional(v.number()),
        verifiedAt: v.optional(v.number()),
        assignee: v.optional(v.id("users")),
        dueAt: v.optional(v.number()),
        resolutionNotes: v.optional(v.string()),
        lastStateChangeAt: v.optional(v.number()),
        evidenceHash: v.optional(v.string()),
        domSnippet: v.optional(v.string()),
        selectorSnapshot: v.optional(v.string()),
        pageTitle: v.optional(v.string()),
        capturedAt: v.optional(v.number()),
        screenshotStorageId: v.optional(v.id("_storage")),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("findings")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    const now = nowMs();
    for (const finding of args.findings) {
      await ctx.db.insert("findings", {
        ...finding,
        assetId: args.assetId,
        scanRunId: args.scanRunId,
        status: finding.status ?? "open",
        lastStateChangeAt: finding.lastStateChangeAt ?? now,
        capturedAt: finding.capturedAt ?? now,
        evidenceHash:
          finding.evidenceHash ??
          computeEvidenceHash({
            source: finding.source,
            ruleId: finding.ruleId,
            target: finding.target,
            pageUrl: finding.pageUrl,
            codeSnippet: finding.codeSnippet,
          }),
        selectorSnapshot: finding.selectorSnapshot ?? finding.target,
        domSnippet: finding.domSnippet ?? finding.codeSnippet,
        createdAt: now,
      });
    }
    return null;
  },
});

export const replaceFindingsForPage = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    scanRunPageId: v.id("scanRunPages"),
    assetId: v.id("assets"),
    findings: v.array(
      v.object({
        source: findingSourceValidator,
        severity: findingSeverityValidator,
        ruleId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        help: v.optional(v.string()),
        helpUrl: v.optional(v.string()),
        target: v.optional(v.string()),
        pageUrl: v.optional(v.string()),
        pageNumber: v.optional(v.number()),
        codeSnippet: v.optional(v.string()),
        manualReviewRequired: v.optional(v.boolean()),
        confidence: v.optional(v.number()),
        status: v.optional(findingStatusValidator),
        resolvedAt: v.optional(v.number()),
        verifiedAt: v.optional(v.number()),
        assignee: v.optional(v.id("users")),
        dueAt: v.optional(v.number()),
        resolutionNotes: v.optional(v.string()),
        lastStateChangeAt: v.optional(v.number()),
        evidenceHash: v.optional(v.string()),
        domSnippet: v.optional(v.string()),
        selectorSnapshot: v.optional(v.string()),
        pageTitle: v.optional(v.string()),
        capturedAt: v.optional(v.number()),
        screenshotStorageId: v.optional(v.id("_storage")),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("findings")
      .withIndex("by_scanRunPage_createdAt", (q) =>
        q.eq("scanRunPageId", args.scanRunPageId),
      )
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    const now = nowMs();
    for (const finding of args.findings) {
      await ctx.db.insert("findings", {
        ...finding,
        assetId: args.assetId,
        scanRunId: args.scanRunId,
        scanRunPageId: args.scanRunPageId,
        status: finding.status ?? "open",
        lastStateChangeAt: finding.lastStateChangeAt ?? now,
        capturedAt: finding.capturedAt ?? now,
        evidenceHash:
          finding.evidenceHash ??
          computeEvidenceHash({
            source: finding.source,
            ruleId: finding.ruleId,
            target: finding.target,
            pageUrl: finding.pageUrl,
            codeSnippet: finding.codeSnippet,
          }),
        selectorSnapshot: finding.selectorSnapshot ?? finding.target,
        domSnippet: finding.domSnippet ?? finding.codeSnippet,
        createdAt: now,
      });
    }
    return null;
  },
});

export const markScanRunning = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    startedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanRunId, {
      status: "running",
      startedAt: args.startedAt,
      updatedAt: args.startedAt,
    });
    return null;
  },
});

export const completeScanRun = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    completedAt: v.number(),
    findingCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanRunId, {
      status: "completed",
      completedAt: args.completedAt,
      findingCount: args.findingCount,
      errorMessage: undefined,
      updatedAt: args.completedAt,
    });
    return null;
  },
});

export const failScanRun = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    failedAt: v.number(),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanRunId, {
      status: "failed",
      failedAt: args.failedAt,
      errorMessage: args.errorMessage,
      updatedAt: args.failedAt,
    });
    return null;
  },
});

export const finalizeWebsiteScanRun = internalMutation({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.union(
    v.object({
      scanRunId: v.id("scanRuns"),
      assetId: v.id("assets"),
      createdBy: v.id("users"),
      profile: wcagProfileValidator,
      summary: scanSummaryValidator,
      totalPages: v.number(),
      completedPages: v.number(),
      failedPages: v.number(),
      generatedAt: v.number(),
      markdown: v.string(),
      json: v.string(),
      status: scanRunStatusValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) return null;
    const progress = await recomputeScanRunProgress(ctx, args.scanRunId);
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();
    const findings = rows.map((row) => ({
      severity: row.severity,
      manualReviewRequired: row.manualReviewRequired,
    })) satisfies FindingSummaryRow[];
    const summary = computeSummary(findings);
    const generatedAt = nowMs();
    const asset = await ctx.db.get(scanRun.assetId);
    const assetLabel =
      asset?.title ??
      asset?.sourceUrl ??
      asset?.filename ??
      String(scanRun.assetId);
    const markdown = buildReportMarkdown({
      assetLabel,
      profile: scanRun.profile,
      generatedAt,
      summary,
      totalPages: progress.totalPages,
      completedPages: progress.completedPages,
      failedPages: progress.failedPages,
    });

    await ctx.db.patch(args.scanRunId, {
      status: "completed",
      completedAt: generatedAt,
      findingCount: rows.length,
      errorMessage:
        progress.failedPages > 0
          ? `${progress.failedPages} page scans failed.`
          : undefined,
      updatedAt: generatedAt,
    });

    return {
      scanRunId: scanRun._id,
      assetId: scanRun.assetId,
      createdBy: scanRun.createdBy,
      profile: scanRun.profile,
      summary,
      totalPages: progress.totalPages,
      completedPages: progress.completedPages,
      failedPages: progress.failedPages,
      generatedAt,
      markdown,
      json: JSON.stringify({ summary }, null, 2),
      status: "completed" as const,
    };
  },
});

export const getScanSummary = query({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.union(scanSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      return null;
    }
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();
    const findings = rows.map((row) => ({
      severity: row.severity,
      manualReviewRequired: row.manualReviewRequired,
    })) satisfies FindingSummaryRow[];
    return computeSummary(findings);
  },
});

export const discoverPages = mutation({
  args: { assetId: v.id("assets") },
  returns: v.array(
    v.object({
      _id: v.id("discoveredPages"),
      _creationTime: v.number(),
      assetId: v.id("assets"),
      pageUrl: v.string(),
      normalizedUrl: v.string(),
      discoveredAt: v.number(),
      lastScannedAt: v.optional(v.number()),
      lastScanStatus: v.optional(scanRunPageStatusValidator),
      lastFindingCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Asset not found.");
    }
    if (!asset.sourceUrl) {
      throw new ConvexError("Asset has no source URL.");
    }

    const pageUrls = await discoverWebsiteUrls(asset.sourceUrl, 500);
    if (pageUrls.length === 0) {
      return [];
    }

    const now = nowMs();
    const insertedPages: Array<{
      _id: Id<"discoveredPages">;
      _creationTime: number;
      assetId: Id<"assets">;
      pageUrl: string;
      normalizedUrl: string;
      discoveredAt: number;
      lastScannedAt?: number;
      lastScanStatus?:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "canceled";
      lastFindingCount?: number;
    }> = [];

    for (const pageUrl of pageUrls) {
      const existing = await ctx.db
        .query("discoveredPages")
        .withIndex("by_asset_normalizedUrl", (q) =>
          q.eq("assetId", args.assetId).eq("normalizedUrl", pageUrl),
        )
        .first();

      if (!existing) {
        const pageId = await ctx.db.insert("discoveredPages", {
          assetId: args.assetId,
          pageUrl,
          normalizedUrl: pageUrl,
          discoveredAt: now,
        });
        insertedPages.push({
          _id: pageId,
          _creationTime: now,
          assetId: args.assetId,
          pageUrl,
          normalizedUrl: pageUrl,
          discoveredAt: now,
        });
      }
    }

    return insertedPages;
  },
});

export const listDiscoveredPages = query({
  args: {
    assetId: v.id("assets"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("discoveredPages"),
      _creationTime: v.number(),
      assetId: v.id("assets"),
      pageUrl: v.string(),
      normalizedUrl: v.string(),
      discoveredAt: v.number(),
      lastScannedAt: v.optional(v.number()),
      lastScanStatus: v.optional(scanRunPageStatusValidator),
      lastFindingCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return [];
    }
    const limit = Math.max(1, Math.min(500, Number(args.limit ?? 100)));
    const rows = await ctx.db
      .query("discoveredPages")
      .withIndex("by_asset_discoveredAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .take(limit);
    return rows;
  },
});
