import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { normalizeHttpUrl, nowMs, requireUserId } from "./helpers";
import { discoverWebsiteUrls } from "./scanRunner";
import {
  findingPageRegionValidator,
  findingSeverityValidator,
  findingSourceValidator,
  findingStatusValidator,
  scanRunModeValidator,
  scanRunPageStatusValidator,
  scanRunStatusValidator,
  scanSummaryValidator,
  urlAssetScopeValidator,
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

type ExternalDiscoveryJobStatus = "queued" | "running" | "completed" | "failed";
type WorkerTaskClaim =
  | {
    kind: "discovery";
    jobId: Id<"externalDiscoveryJobs">;
    assetId: Id<"assets">;
    sourceUrl: string;
    maxUrls: number;
  }
  | {
    kind: "page";
    scanRunId: Id<"scanRuns">;
    pageRunId: Id<"scanRunPages">;
    assetId: Id<"assets">;
    pageUrl: string;
    queueWaitMs: number;
  };

const EXTERNAL_SCANNER_WAKE_CHANNEL = "external_scanner";
const EXTERNAL_SCANNER_WAKE_DEBOUNCE_MS = 1_000;
const ADASCOUT_BROWSERLAUNCH_APP = "adascout";
const scanRunnerInternal = (internal as unknown as {
  scanRunner: { notifyExternalScannerWorker: unknown };
}).scanRunner;
interface BrowserLaunchComponentRefs {
  launchthat_browserlaunch?: {
    mutations?: Record<string, unknown>;
    queries?: Record<string, unknown>;
  };
}
const browserLaunchComponent = (components as unknown as BrowserLaunchComponentRefs)
  .launchthat_browserlaunch;
const browserLaunchMutations: Record<string, unknown> | undefined =
  browserLaunchComponent?.mutations;
const browserLaunchQueries: Record<string, unknown> | undefined =
  browserLaunchComponent?.queries;

const sleep = async (ms: number) =>
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

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

const computeCompliance = (
  summary: ReturnType<typeof computeSummary>,
): {
  score: number;
  band: "pass" | "warn" | "fail";
  weightedPenalty: number;
} => {
  const weightedPenalty =
    summary.critical * 20 +
    summary.serious * 12 +
    summary.moderate * 6 +
    summary.minor * 2 +
    summary.info +
    summary.manualReviewRequired * 2;
  const score = Math.max(0, Math.min(100, Math.round(100 - weightedPenalty)));
  const band: "pass" | "warn" | "fail" =
    score >= 90 ? "pass" : score >= 70 ? "warn" : "fail";
  return { score, band, weightedPenalty };
};

const computeEvidenceHash = (args: {
  source: "axe" | "ibm" | "pdf" | "stagehand";
  ruleId: string;
  target?: string;
  pageUrl?: string;
  codeSnippet?: string;
}) => {
  const normalizeForHash = (value: string | undefined): string =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const normalizePageUrlForHash = (value: string | undefined): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      parsed.hash = "";
      parsed.pathname =
        parsed.pathname === "/"
          ? "/"
          : parsed.pathname.replace(/\/+$/, "") || "/";
      return parsed.toString().toLowerCase();
    } catch {
      return normalizeForHash(raw);
    }
  };
  const normalizedTarget = normalizeForHash(args.target);
  const normalizedPageUrl = normalizePageUrlForHash(args.pageUrl);
  const normalizedRuleId = normalizeForHash(args.ruleId);
  const normalizedSource = normalizeForHash(args.source);
  return [
    normalizedSource,
    normalizedRuleId,
    normalizedTarget,
    normalizedPageUrl,
  ].join("|");
};

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
  compliance: ReturnType<typeof computeCompliance>;
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
    "",
    "## Compliance",
    `- Score: ${args.compliance.score}/100 (${args.compliance.band})`,
    `- Weighted penalty: ${args.compliance.weightedPenalty}`,
    "",
    "## Disclaimer",
    "- This is an automated best-effort pre-audit and not a legal certification.",
    "- Manual accessibility verification is recommended for complex content.",
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
    const assetUrlScope = (asset as { urlScope?: "single_page" | "website" })
      .urlScope;
    const mode = asset.kind === "url" ? "website_pages" : "single_asset";
    const singlePageUrl = asset.normalizedUrl ?? asset.sourceUrl;
    const singlePageSeedUrl =
      asset.kind === "url" &&
        assetUrlScope === "single_page" &&
        singlePageUrl
        ? [normalizeHttpUrl(singlePageUrl)]
        : undefined;
    const workflowPageUrls =
      args.pageUrls && args.pageUrls.length > 0
        ? args.pageUrls
        : singlePageSeedUrl;
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
        { scanRunId, pageUrls: workflowPageUrls },
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
    const assetUrlScope = (asset as { urlScope?: "single_page" | "website" })
      .urlScope;
    const mode = asset.kind === "url" ? "website_pages" : "single_asset";
    const singlePageUrl = asset.normalizedUrl ?? asset.sourceUrl;
    const workflowPageUrls =
      asset.kind === "url" &&
        assetUrlScope === "single_page" &&
        singlePageUrl
        ? [normalizeHttpUrl(singlePageUrl)]
        : undefined;
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
        { scanRunId, pageUrls: workflowPageUrls },
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
      pageScreenshotStorageId: v.optional(v.id("_storage")),
      pageScreenshotCapturedAt: v.optional(v.number()),
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
      pageScreenshotStorageId: v.optional(v.id("_storage")),
      pageScreenshotCapturedAt: v.optional(v.number()),
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

    interface PageRow {
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
      pageScreenshotStorageId?: Id<"_storage">;
      pageScreenshotCapturedAt?: number;
      createdAt: number;
      updatedAt: number;
    }

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
    const statusRank = (status: PageRow["status"]): number => {
      switch (status) {
        case "completed":
          return 5;
        case "running":
          return 4;
        case "queued":
          return 3;
        case "failed":
          return 2;
        case "canceled":
          return 1;
        default:
          return 0;
      }
    };
    const latestByUrl = new Map<string, PageRow>();
    for (const page of allPages) {
      const key = page.normalizedUrl || page.pageUrl;
      const current = latestByUrl.get(key);
      if (!current) {
        latestByUrl.set(key, page);
        continue;
      }
      if (page.updatedAt > current.updatedAt) {
        latestByUrl.set(key, page);
        continue;
      }
      if (
        page.updatedAt === current.updatedAt &&
        statusRank(page.status) > statusRank(current.status)
      ) {
        latestByUrl.set(key, page);
      }
    }
    return Array.from(latestByUrl.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
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
      pageScreenshotStorageId: v.optional(v.id("_storage")),
      pageScreenshotCapturedAt: v.optional(v.number()),
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

export const getMyScanRunPageScreenshotUrl = query({
  args: {
    pageId: v.id("scanRunPages"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await ctx.db.get(args.pageId);
    if (!page || !page.pageScreenshotStorageId) {
      return null;
    }
    const scanRun = await ctx.db.get(page.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      return null;
    }
    return await ctx.storage.getUrl(page.pageScreenshotStorageId);
  },
});

export const getMyAssetPageDetail = query({
  args: {
    assetId: v.id("assets"),
    pageId: v.id("discoveredPages"),
  },
  returns: v.union(
    v.object({
      _id: v.id("discoveredPages"),
      assetId: v.id("assets"),
      pageUrl: v.string(),
      normalizedUrl: v.string(),
      discoveredAt: v.number(),
      lastScannedAt: v.optional(v.number()),
      lastScanStatus: v.optional(scanRunPageStatusValidator),
      lastFindingCount: v.optional(v.number()),
      latestScanRunPageId: v.optional(v.id("scanRunPages")),
      scanRunId: v.optional(v.id("scanRuns")),
      status: v.optional(scanRunPageStatusValidator),
      attempt: v.optional(v.number()),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      failedAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      findingCount: v.optional(v.number()),
      retryCount: v.optional(v.number()),
      terminalErrorCategory: v.optional(v.string()),
      updatedAt: v.optional(v.number()),
      pageScreenshotCapturedAt: v.optional(v.number()),
      screenshotUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return null;
    }
    const discovered = await ctx.db.get(args.pageId);
    if (!discovered || discovered.assetId !== args.assetId) {
      return null;
    }

    const scanRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .take(200);

    let latestPageRun:
      | {
        _id: Id<"scanRunPages">;
        scanRunId: Id<"scanRuns">;
        status: "queued" | "running" | "completed" | "failed" | "canceled";
        attempt: number;
        startedAt?: number;
        completedAt?: number;
        failedAt?: number;
        errorMessage?: string;
        findingCount?: number;
        retryCount?: number;
        terminalErrorCategory?: string;
        updatedAt: number;
        pageScreenshotStorageId?: Id<"_storage">;
        pageScreenshotCapturedAt?: number;
      }
      | null = null;

    for (const run of scanRuns) {
      const row = await ctx.db
        .query("scanRunPages")
        .withIndex("by_scanRun_normalizedUrl", (q) =>
          q.eq("scanRunId", run._id).eq("normalizedUrl", discovered.normalizedUrl),
        )
        .first();
      if (row) {
        latestPageRun = row;
        break;
      }
    }

    const screenshotUrl =
      latestPageRun?.pageScreenshotStorageId
        ? await ctx.storage.getUrl(latestPageRun.pageScreenshotStorageId)
        : null;

    return {
      _id: discovered._id,
      assetId: discovered.assetId,
      pageUrl: discovered.pageUrl,
      normalizedUrl: discovered.normalizedUrl,
      discoveredAt: discovered.discoveredAt,
      lastScannedAt: discovered.lastScannedAt,
      lastScanStatus: discovered.lastScanStatus,
      lastFindingCount: discovered.lastFindingCount,
      latestScanRunPageId: latestPageRun?._id,
      scanRunId: latestPageRun?.scanRunId,
      status: latestPageRun?.status,
      attempt: latestPageRun?.attempt,
      startedAt: latestPageRun?.startedAt,
      completedAt: latestPageRun?.completedAt,
      failedAt: latestPageRun?.failedAt,
      errorMessage: latestPageRun?.errorMessage,
      findingCount: latestPageRun?.findingCount,
      retryCount: latestPageRun?.retryCount,
      terminalErrorCategory: latestPageRun?.terminalErrorCategory,
      updatedAt: latestPageRun?.updatedAt,
      pageScreenshotCapturedAt: latestPageRun?.pageScreenshotCapturedAt,
      screenshotUrl,
    };
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
    if (insertedCount > 0) {
      if (isAdascoutBrowserLaunchEnabled()) {
        const enqueueTask = browserLaunchMutations?.enqueueTask;
        if (enqueueTask) {
          await (
            ctx.runMutation as unknown as (
              functionRef: unknown,
              args: unknown,
            ) => Promise<unknown>
          )(enqueueTask, {
            app: ADASCOUT_BROWSERLAUNCH_APP,
            taskType: "scan_run_pages_available",
            queue: "adascout_scans",
            externalRef: `scanRun:${args.scanRunId}`,
            payloadJson: JSON.stringify({
              scanRunId: args.scanRunId,
              insertedCount,
              totalQueuedUrls: args.pageUrls.length,
            }),
            maxAttempts: 2,
          }).catch(() => undefined);
        }
      }
      await scheduleExternalScannerWake(ctx, "scan_run_pages_upserted");
    }
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

export const getScanRunProgressForWorkflow = internalMutation({
  args: {
    scanRunId: v.id("scanRuns"),
    pageRunIds: v.optional(v.array(v.id("scanRunPages"))),
  },
  returns: v.object({
    status: scanRunStatusValidator,
    totalPages: v.number(),
    queuedPages: v.number(),
    runningPages: v.number(),
    completedPages: v.number(),
    failedPages: v.number(),
    canceledPages: v.number(),
  }),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) {
      throw new ConvexError("Scan run not found.");
    }
    const rows = args.pageRunIds?.length
      ? (
        await Promise.all(args.pageRunIds.map(async (pageRunId) => await ctx.db.get(pageRunId)))
      ).filter(
        (row): row is NonNullable<typeof row> => Boolean(row && row.scanRunId === args.scanRunId),
      )
      : await ctx.db
        .query("scanRunPages")
        .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", args.scanRunId))
        .collect();

    let queuedPages = 0;
    let runningPages = 0;
    let completedPages = 0;
    let failedPages = 0;
    let canceledPages = 0;

    for (const row of rows) {
      if (row.status === "queued") queuedPages += 1;
      if (row.status === "running") runningPages += 1;
      if (row.status === "completed") completedPages += 1;
      if (row.status === "failed") failedPages += 1;
      if (row.status === "canceled") canceledPages += 1;
    }

    const totalPages = rows.length;
    const status =
      queuedPages > 0 || runningPages > 0 ? ("running" as const) : scanRun.status;

    return {
      status,
      totalPages,
      queuedPages,
      runningPages,
      completedPages,
      failedPages,
      canceledPages,
    };
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
    pageScreenshotStorageId: v.optional(v.id("_storage")),
    pageScreenshotCapturedAt: v.optional(v.number()),
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
      pageScreenshotStorageId:
        args.pageScreenshotStorageId ?? page.pageScreenshotStorageId,
      pageScreenshotCapturedAt:
        args.pageScreenshotCapturedAt ?? page.pageScreenshotCapturedAt,
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
        pageRegion: v.optional(findingPageRegionValidator),
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
        highlightId: v.optional(v.number()),
        bboxX: v.optional(v.number()),
        bboxY: v.optional(v.number()),
        bboxWidth: v.optional(v.number()),
        bboxHeight: v.optional(v.number()),
        screenshotViewportWidth: v.optional(v.number()),
        screenshotViewportHeight: v.optional(v.number()),
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
        pageRegion: v.optional(findingPageRegionValidator),
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
        highlightId: v.optional(v.number()),
        bboxX: v.optional(v.number()),
        bboxY: v.optional(v.number()),
        bboxWidth: v.optional(v.number()),
        bboxHeight: v.optional(v.number()),
        screenshotViewportWidth: v.optional(v.number()),
        screenshotViewportHeight: v.optional(v.number()),
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
    const compliance = computeCompliance(summary);
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
      compliance,
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
      json: JSON.stringify({ summary, compliance }, null, 2),
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

    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "discover_pages_start",
        assetId: args.assetId,
        sourceUrl: asset.sourceUrl,
        userId,
      }),
    );

    const startedAt = nowMs();
    let pageUrls: string[] = [];
    const assetUrlScope = (asset as { urlScope?: "single_page" | "website" })
      .urlScope;
    try {
      if (assetUrlScope === "single_page") {
        pageUrls = [normalizeHttpUrl(asset.sourceUrl)];
      } else {
        pageUrls = await discoverWebsiteUrls(asset.sourceUrl, 500, {
          useTimeouts: false,
        });
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          component: "adascout-scan",
          event: "discover_pages_error",
          assetId: args.assetId,
          sourceUrl: asset.sourceUrl,
          durationMs: nowMs() - startedAt,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
    if (pageUrls.length === 0) {
      console.info(
        JSON.stringify({
          component: "adascout-scan",
          event: "discover_pages_complete",
          assetId: args.assetId,
          sourceUrl: asset.sourceUrl,
          discoveredCount: 0,
          insertedCount: 0,
          durationMs: nowMs() - startedAt,
        }),
      );
      return [];
    }

    const now = nowMs();
    const insertedPages: {
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
    }[] = [];

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

    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "discover_pages_complete",
        assetId: args.assetId,
        sourceUrl: asset.sourceUrl,
        discoveredCount: pageUrls.length,
        insertedCount: insertedPages.length,
        durationMs: nowMs() - startedAt,
      }),
    );

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
      .take(limit * 3);
    const deduped = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = row.normalizedUrl || row.pageUrl;
      if (!deduped.has(key)) {
        deduped.set(key, row);
      }
      if (deduped.size >= limit) break;
    }
    return Array.from(deduped.values());
  },
});

export const detectPages = action({
  args: { assetId: v.id("assets") },
  returns: v.object({
    discoveredCount: v.number(),
    insertedCount: v.number(),
    totalKnownPages: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    discoveredCount: number;
    insertedCount: number;
    totalKnownPages: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const asset = await ctx.runQuery(internal.scans.getAssetForDetection, {
      assetId: args.assetId,
      userId,
    });
    if (!asset) {
      throw new ConvexError("Asset not found.");
    }
    if (!asset.sourceUrl) {
      throw new ConvexError("Asset has no source URL.");
    }

    const startedAt = nowMs();
    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "detect_pages_start",
        assetId: args.assetId,
        sourceUrl: asset.sourceUrl,
        userId,
      }),
    );

    let scopedPageUrls =
      asset.urlScope === "single_page"
        ? [normalizeHttpUrl(asset.normalizedUrl ?? asset.sourceUrl)]
        : await discoverWebsiteUrls(asset.sourceUrl, 500, {
          sitemapOnly: true,
        });

    if (asset.urlScope !== "single_page" && scopedPageUrls.length <= 1) {
      // Before delegating to external browser discovery, attempt full HTTP crawl
      // (still non-browser) so local dev works even when remote worker is offline.
      const httpCrawlUrls = await discoverWebsiteUrls(asset.sourceUrl, 500, {
        sitemapOnly: false,
      });
      if (httpCrawlUrls.length > scopedPageUrls.length) {
        scopedPageUrls = httpCrawlUrls;
        console.info(
          JSON.stringify({
            component: "adascout-scan",
            event: "detect_pages_http_crawl_fallback_used",
            assetId: args.assetId,
            discoveredCount: scopedPageUrls.length,
          }),
        );
      }
    }

    if (asset.urlScope !== "single_page" && scopedPageUrls.length <= 1) {
      const discoveryJobId = (await ctx.runMutation(
        internal.scans.enqueueExternalDiscoveryJob,
        {
          assetId: args.assetId,
          sourceUrl: asset.sourceUrl,
          maxUrls: 500,
        },
      )) as Id<"externalDiscoveryJobs">;
      const pollDeadlineMs = nowMs() + 45_000;
      while (nowMs() < pollDeadlineMs) {
        const job = (await ctx.runQuery(internal.scans.getExternalDiscoveryJob, {
          jobId: discoveryJobId,
        })) as
          | {
            status: ExternalDiscoveryJobStatus;
            discoveredUrls?: string[];
            errorMessage?: string;
          }
          | null;
        if (!job) break;
        if (job.status === "completed") {
          if (
            Array.isArray(job.discoveredUrls) &&
            job.discoveredUrls.length > scopedPageUrls.length
          ) {
            scopedPageUrls = job.discoveredUrls;
            console.info(
              JSON.stringify({
                component: "adascout-scan",
                event: "detect_pages_external_discovery_used",
                assetId: args.assetId,
                discoveredCount: scopedPageUrls.length,
              }),
            );
          }
          break;
        }
        if (job.status === "failed") {
          console.warn(
            JSON.stringify({
              component: "adascout-scan",
              event: "detect_pages_external_discovery_failed",
              assetId: args.assetId,
              errorMessage: job.errorMessage ?? "unknown error",
            }),
          );
          break;
        }
        await sleep(1_000);
      }
    }
    const result = (await ctx.runMutation(internal.scans.upsertDiscoveredPages, {
      assetId: args.assetId,
      pageUrls: scopedPageUrls,
    })) as { insertedCount: number; totalKnownPages: number };

    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "detect_pages_complete",
        assetId: args.assetId,
        sourceUrl: asset.sourceUrl,
        discoveredCount: scopedPageUrls.length,
        insertedCount: result.insertedCount,
        totalKnownPages: result.totalKnownPages,
        durationMs: nowMs() - startedAt,
      }),
    );

    return {
      discoveredCount: scopedPageUrls.length,
      insertedCount: result.insertedCount,
      totalKnownPages: result.totalKnownPages,
    };
  },
});

export const normalizeDiscoveredPagesForAsset = mutation({
  args: { assetId: v.id("assets") },
  returns: v.object({
    removedCount: v.number(),
    remainingCount: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ removedCount: number; remainingCount: number }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Asset not found.");
    }
    return await ctx.runMutation(internal.scans.backfillDiscoveredPageUniqueness, {
      assetId: args.assetId,
    });
  },
});

export const normalizeDiscoveredPagesForAssetByToken = action({
  args: {
    workerToken: v.string(),
    assetId: v.id("assets"),
  },
  returns: v.object({
    removedCount: v.number(),
    remainingCount: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ removedCount: number; remainingCount: number }> => {
    assertScannerWorkerAuthorized(args.workerToken);
    return (await ctx.runMutation(internal.scans.backfillDiscoveredPageUniqueness, {
      assetId: args.assetId,
    })) as { removedCount: number; remainingCount: number };
  },
});

export const getAssetForDetection = internalQuery({
  args: {
    assetId: v.id("assets"),
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      _id: v.id("assets"),
      sourceUrl: v.optional(v.string()),
      normalizedUrl: v.optional(v.string()),
      urlScope: v.optional(urlAssetScopeValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== args.userId) {
      return null;
    }
    return {
      _id: asset._id,
      sourceUrl: asset.sourceUrl,
      normalizedUrl: asset.normalizedUrl,
      urlScope: (asset as { urlScope?: "single_page" | "website" }).urlScope,
    };
  },
});

export const upsertDiscoveredPages = internalMutation({
  args: {
    assetId: v.id("assets"),
    pageUrls: v.array(v.string()),
  },
  returns: v.object({
    insertedCount: v.number(),
    totalKnownPages: v.number(),
  }),
  handler: async (ctx, args) => {
    const normalizePageUrl = (raw: string): string => {
      try {
        return normalizeHttpUrl(raw);
      } catch {
        return raw.trim();
      }
    };
    const now = nowMs();
    const existingRows = await ctx.db
      .query("discoveredPages")
      .withIndex("by_asset_discoveredAt", (q) => q.eq("assetId", args.assetId))
      .collect();
    const existingUrls = new Set(
      existingRows.map((row) => normalizePageUrl(row.normalizedUrl)),
    );
    let insertedCount = 0;

    for (const pageUrl of args.pageUrls) {
      const normalizedPageUrl = normalizePageUrl(pageUrl);
      if (existingUrls.has(normalizedPageUrl)) continue;
      await ctx.db.insert("discoveredPages", {
        assetId: args.assetId,
        pageUrl: normalizedPageUrl,
        normalizedUrl: normalizedPageUrl,
        discoveredAt: now,
      });
      existingUrls.add(normalizedPageUrl);
      insertedCount += 1;
    }

    return {
      insertedCount,
      totalKnownPages: existingUrls.size,
    };
  },
});

export const enqueueExternalDiscoveryJob = internalMutation({
  args: {
    assetId: v.id("assets"),
    sourceUrl: v.string(),
    maxUrls: v.number(),
  },
  returns: v.id("externalDiscoveryJobs"),
  handler: async (ctx, args) => {
    const now = nowMs();
    const maxUrls = Math.max(1, Math.min(500, Number(args.maxUrls)));
    const jobId = await ctx.db.insert("externalDiscoveryJobs", {
      assetId: args.assetId,
      sourceUrl: normalizeHttpUrl(args.sourceUrl),
      maxUrls,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });
    if (isAdascoutBrowserLaunchEnabled()) {
      const enqueueTask = browserLaunchMutations?.enqueueTask;
      if (enqueueTask) {
        await (
          ctx.runMutation as unknown as (
            functionRef: unknown,
            args: unknown,
          ) => Promise<unknown>
        )(enqueueTask, {
          app: ADASCOUT_BROWSERLAUNCH_APP,
          taskType: "external_discovery",
          queue: "adascout_scans",
          externalRef: `externalDiscoveryJob:${jobId}`,
          payloadJson: JSON.stringify({
            jobId,
            assetId: args.assetId,
            sourceUrl: args.sourceUrl,
            maxUrls,
          }),
          maxAttempts: 3,
        }).catch(() => undefined);
      }
    }
    await scheduleExternalScannerWake(ctx, "external_discovery_enqueued");
    return jobId;
  },
});

export const getExternalDiscoveryJob = internalQuery({
  args: { jobId: v.id("externalDiscoveryJobs") },
  returns: v.union(
    v.object({
      _id: v.id("externalDiscoveryJobs"),
      assetId: v.id("assets"),
      status: v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      discoveredUrls: v.optional(v.array(v.string())),
      errorMessage: v.optional(v.string()),
      updatedAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.jobId);
    if (!row) return null;
    return {
      _id: row._id,
      assetId: row.assetId,
      status: row.status,
      discoveredUrls: row.discoveredUrls,
      errorMessage: row.errorMessage,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    };
  },
});

const getScannerWorkerToken = (): string | null => {
  const envValue = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.ADA_SCANNER_WORKER_TOKEN;
  if (!envValue || envValue.trim().length === 0) return null;
  return envValue.trim();
};

const assertScannerWorkerAuthorized = (providedToken: string) => {
  const expectedToken = getScannerWorkerToken();
  if (!expectedToken) {
    throw new ConvexError("Scanner worker token is not configured.");
  }
  if (providedToken !== expectedToken) {
    throw new ConvexError("Unauthorized scanner worker.");
  }
};

const isAdascoutBrowserLaunchEnabled = (): boolean => {
  const raw = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.ADA_SCOUT_BROWSERLAUNCH_ENABLED;
  if (!raw) return true;
  return raw.trim().toLowerCase() !== "false";
};

const upsertAdascoutReplayRun = async (
  ctx: unknown,
  externalRef: string,
  taskType: string,
): Promise<string | null> => {
  if (!isAdascoutBrowserLaunchEnabled()) return null;
  const upsertRunForExternalRef = browserLaunchMutations?.upsertRunForExternalRef;
  if (!upsertRunForExternalRef) return null;
  const runMutation = (
    ctx as { runMutation: (functionRef: unknown, args: unknown) => Promise<unknown> }
  ).runMutation;
  return (await runMutation(upsertRunForExternalRef, {
    app: ADASCOUT_BROWSERLAUNCH_APP,
    externalRef,
    taskType,
  })) as string;
};

const appendAdascoutReplayStep = async (
  ctx: unknown,
  args: {
    runId: string;
    seq: number;
    kind: string;
    status?: string;
    label?: string;
    url?: string;
    resultSummary?: string;
    errorMessage?: string;
    screenshotStorageId?: Id<"_storage">;
  },
): Promise<void> => {
  const appendRunStep = browserLaunchMutations?.appendRunStep;
  if (!appendRunStep) return;
  const runMutation = (
    ctx as { runMutation: (functionRef: unknown, args: unknown) => Promise<unknown> }
  ).runMutation;
  await runMutation(appendRunStep, {
      runId: args.runId,
      seq: args.seq,
      kind: args.kind,
      status: args.status,
      label: args.label,
      url: args.url,
      resultSummary: args.resultSummary,
      errorMessage: args.errorMessage,
      screenshotStorageId: args.screenshotStorageId,
      metadataJson: JSON.stringify({
        source: "adascout",
        at: nowMs(),
      }),
    }).catch(() => undefined);
  if (args.screenshotStorageId) {
    const createRunArtifact = browserLaunchMutations.createRunArtifact;
    if (createRunArtifact) {
      await runMutation(createRunArtifact, {
          runId: args.runId,
          kind: "screenshot",
          storageId: args.screenshotStorageId,
          stepSeq: args.seq,
          metadataJson: JSON.stringify({
            source: "adascout",
            kind: args.kind,
          }),
        }).catch(() => undefined);
    }
  }
};

const scheduleExternalScannerWake = async (
  ctx: MutationCtx,
  reason: string,
): Promise<void> => {
  const now = nowMs();
  const existing = await ctx.db
    .query("scannerWakeSignals")
    .withIndex("by_channel", (q) => q.eq("channel", EXTERNAL_SCANNER_WAKE_CHANNEL))
    .first();
  if (
    existing &&
    now - existing.lastSignaledAt < EXTERNAL_SCANNER_WAKE_DEBOUNCE_MS
  ) {
    return;
  }
  if (existing) {
    await ctx.db.patch(existing._id, {
      lastSignaledAt: now,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("scannerWakeSignals", {
      channel: EXTERNAL_SCANNER_WAKE_CHANNEL,
      lastSignaledAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  await (
    ctx.scheduler.runAfter as unknown as (
      delayMs: number,
      functionRef: unknown,
      args: unknown,
    ) => Promise<unknown>
  )(0, scanRunnerInternal.notifyExternalScannerWorker, { reason });
};

export const listRunningWebsiteScanRunsForWorker = internalQuery({
  args: {},
  returns: v.array(v.id("scanRuns")),
  handler: async (ctx) => {
    const queuedRows = await ctx.db
      .query("scanRuns")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "queued"))
      .order("desc")
      .take(200);
    const runningRows = await ctx.db
      .query("scanRuns")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "running"))
      .order("desc")
      .take(200);
    const rows = [...queuedRows, ...runningRows];
    return rows
      .filter((row) => row.mode === "website_pages")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => row._id);
  },
});

export const listQueuedExternalDiscoveryJobs = internalQuery({
  args: {},
  returns: v.array(v.id("externalDiscoveryJobs")),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("externalDiscoveryJobs")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(25);
    return rows.map((row) => row._id);
  },
});

export const claimExternalDiscoveryJob = internalMutation({
  args: { jobId: v.id("externalDiscoveryJobs") },
  returns: v.union(
    v.object({
      _id: v.id("externalDiscoveryJobs"),
      assetId: v.id("assets"),
      sourceUrl: v.string(),
      maxUrls: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.jobId);
    if (!row || row.status !== "queued") return null;
    const now = nowMs();
    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: now,
      updatedAt: now,
      errorMessage: undefined,
    });
    return {
      _id: row._id,
      assetId: row.assetId,
      sourceUrl: row.sourceUrl,
      maxUrls: row.maxUrls,
    };
  },
});

export const completeExternalDiscoveryJob = internalMutation({
  args: {
    jobId: v.id("externalDiscoveryJobs"),
    pageUrls: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.jobId);
    if (!row) return null;
    const normalized = Array.from(
      new Set(
        args.pageUrls
          .map((value) => {
            try {
              return normalizeHttpUrl(value);
            } catch {
              return value.trim();
            }
          })
          .filter((value) => value.length > 0),
      ),
    ).slice(0, Math.max(1, Math.min(500, row.maxUrls)));
    const now = nowMs();
    await ctx.db.patch(args.jobId, {
      status: "completed",
      discoveredUrls: normalized,
      errorMessage: undefined,
      completedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const markExternalDiscoveryJobFailed = internalMutation({
  args: {
    jobId: v.id("externalDiscoveryJobs"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.jobId);
    if (!row) return null;
    const now = nowMs();
    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: args.errorMessage.slice(0, 2_000),
      completedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const claimNextExternalDiscoveryJob = action({
  args: {
    workerToken: v.string(),
  },
  returns: v.union(
    v.object({
      jobId: v.id("externalDiscoveryJobs"),
      assetId: v.id("assets"),
      sourceUrl: v.string(),
      maxUrls: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    const queued = await ctx.runQuery(internal.scans.listQueuedExternalDiscoveryJobs, {});
    const jobId = (queued as Id<"externalDiscoveryJobs">[])[0];
    if (!jobId) return null;
    const claimed = (await ctx.runMutation(internal.scans.claimExternalDiscoveryJob, {
      jobId,
    })) as
      | {
        _id: Id<"externalDiscoveryJobs">;
        assetId: Id<"assets">;
        sourceUrl: string;
        maxUrls: number;
      }
      | null;
    if (!claimed) return null;
    return {
      jobId: claimed._id,
      assetId: claimed.assetId,
      sourceUrl: claimed.sourceUrl,
      maxUrls: claimed.maxUrls,
    };
  },
});

export const claimNextPageForExternalScanner = action({
  args: {
    workerToken: v.string(),
    scanRunId: v.optional(v.id("scanRuns")),
  },
  returns: v.union(
    v.object({
      scanRunId: v.id("scanRuns"),
      pageRunId: v.id("scanRunPages"),
      assetId: v.id("assets"),
      pageUrl: v.string(),
      queueWaitMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{
    scanRunId: Id<"scanRuns">;
    pageRunId: Id<"scanRunPages">;
    assetId: Id<"assets">;
    pageUrl: string;
    queueWaitMs: number;
  } | null> => {
    assertScannerWorkerAuthorized(args.workerToken);
    const candidateScanRunIds: Id<"scanRuns">[] = args.scanRunId
      ? [args.scanRunId]
      : ((await ctx.runQuery(
        internal.scans.listRunningWebsiteScanRunsForWorker,
        {},
        )) as Id<"scanRuns">[]);
    for (const scanRunId of candidateScanRunIds) {
      const pageIds = (await ctx.runMutation(internal.scans.claimQueuedScanRunPages, {
        scanRunId,
        limit: 1,
      })) as Id<"scanRunPages">[];
      const pageRunId: Id<"scanRunPages"> | undefined = pageIds[0];
      if (!pageRunId) continue;
      const processing = (await ctx.runQuery(
        internal.scans.getScanRunPageForProcessing,
        {
          scanRunId,
          pageRunId,
        },
      )) as
        | {
          scanRun: { assetId: Id<"assets"> };
          pageRun: { pageUrl: string; createdAt: number };
        }
        | null;
      if (!processing) continue;
      const queueWaitMs = Math.max(0, nowMs() - processing.pageRun.createdAt);
      const claimed = await ctx.runMutation(
        internal.scans.claimScanRunPageForExecution,
        {
          scanRunId,
          pageRunId,
          queueWaitMs,
        },
      );
      if (!claimed) continue;
      return {
        scanRunId,
        pageRunId,
        assetId: processing.scanRun.assetId,
        pageUrl: processing.pageRun.pageUrl,
        queueWaitMs,
      };
    }
    return null;
  },
});

const workerTaskClaimValidator = v.union(
  v.object({
    kind: v.literal("discovery"),
    jobId: v.id("externalDiscoveryJobs"),
    assetId: v.id("assets"),
    sourceUrl: v.string(),
    maxUrls: v.number(),
  }),
  v.object({
    kind: v.literal("page"),
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
    assetId: v.id("assets"),
    pageUrl: v.string(),
    queueWaitMs: v.number(),
  }),
);

export const claimNextWorkerTask = action({
  args: {
    workerToken: v.string(),
    preferredScanRunId: v.optional(v.id("scanRuns")),
  },
  returns: v.union(workerTaskClaimValidator, v.null()),
  handler: async (ctx, args): Promise<WorkerTaskClaim | null> => {
    assertScannerWorkerAuthorized(args.workerToken);

    const queued = await ctx.runQuery(internal.scans.listQueuedExternalDiscoveryJobs, {});
    const discoveryJobId = (queued as Id<"externalDiscoveryJobs">[])[0];
    if (discoveryJobId) {
      const claimed = (await ctx.runMutation(internal.scans.claimExternalDiscoveryJob, {
        jobId: discoveryJobId,
      })) as
        | {
          _id: Id<"externalDiscoveryJobs">;
          assetId: Id<"assets">;
          sourceUrl: string;
          maxUrls: number;
        }
        | null;
      if (claimed) {
        return {
          kind: "discovery",
          jobId: claimed._id,
          assetId: claimed.assetId,
          sourceUrl: claimed.sourceUrl,
          maxUrls: claimed.maxUrls,
        };
      }
    }

    const candidateScanRunIds: Id<"scanRuns">[] = [];
    if (args.preferredScanRunId) {
      candidateScanRunIds.push(args.preferredScanRunId);
    }
    const discoveredCandidates = (await ctx.runQuery(
      internal.scans.listRunningWebsiteScanRunsForWorker,
      {},
    )) as Id<"scanRuns">[];
    for (const scanRunId of discoveredCandidates) {
      if (candidateScanRunIds.includes(scanRunId)) continue;
      candidateScanRunIds.push(scanRunId);
    }

    for (const scanRunId of candidateScanRunIds) {
      const pageIds = (await ctx.runMutation(internal.scans.claimQueuedScanRunPages, {
        scanRunId,
        limit: 1,
      })) as Id<"scanRunPages">[];
      const pageRunId: Id<"scanRunPages"> | undefined = pageIds[0];
      if (!pageRunId) continue;
      const processing = (await ctx.runQuery(
        internal.scans.getScanRunPageForProcessing,
        {
          scanRunId,
          pageRunId,
        },
      )) as
        | {
          scanRun: { assetId: Id<"assets"> };
          pageRun: { pageUrl: string; createdAt: number };
        }
        | null;
      if (!processing) continue;
      const queueWaitMs = Math.max(0, nowMs() - processing.pageRun.createdAt);
      const claimed = await ctx.runMutation(
        internal.scans.claimScanRunPageForExecution,
        {
          scanRunId,
          pageRunId,
          queueWaitMs,
        },
      );
      if (!claimed) continue;
      return {
        kind: "page",
        scanRunId,
        pageRunId,
        assetId: processing.scanRun.assetId,
        pageUrl: processing.pageRun.pageUrl,
        queueWaitMs,
      };
    }

    return null;
  },
});

export const createExternalPageScreenshotUploadUrl = action({
  args: {
    workerToken: v.string(),
  },
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const listBrowserLaunchReplayStepsForPageRun = action({
  args: {
    pageRunId: v.id("scanRunPages"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      seq: v.number(),
      kind: v.string(),
      status: v.optional(v.string()),
      label: v.optional(v.string()),
      url: v.optional(v.string()),
      resultSummary: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      screenshotUrl: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const listRunsForApp = browserLaunchQueries?.listRunsForApp;
    const listRunSteps = browserLaunchQueries?.listRunSteps;
    if (!listRunsForApp || !listRunSteps) return [];
    const runs = (await (
      ctx.runQuery as unknown as (
        functionRef: unknown,
        args: unknown,
      ) => Promise<unknown>
    )(listRunsForApp, {
      app: ADASCOUT_BROWSERLAUNCH_APP,
      limit: 100,
    })) as {
      _id: string;
      externalRef?: string;
      createdAt: number;
    }[];
    const targetRef = `scanRunPage:${args.pageRunId}`;
    const run = runs.find((item) => item.externalRef === targetRef);
    if (!run) return [];
    const steps = (await (
      ctx.runQuery as unknown as (
        functionRef: unknown,
        args: unknown,
      ) => Promise<unknown>
    )(listRunSteps, {
      runId: run._id,
      limit: args.limit ?? 200,
    })) as {
      seq: number;
      kind: string;
      status?: string;
      label?: string;
      url?: string;
      resultSummary?: string;
      errorMessage?: string;
      screenshotUrl?: string;
      createdAt: number;
    }[];
    return steps.map((step) => ({
      seq: step.seq,
      kind: step.kind,
      status: step.status,
      label: step.label,
      url: step.url,
      resultSummary: step.resultSummary,
      errorMessage: step.errorMessage,
      screenshotUrl: step.screenshotUrl,
      createdAt: step.createdAt,
    }));
  },
});

const externalScannerFindingValidator = v.object({
  source: findingSourceValidator,
  severity: findingSeverityValidator,
  ruleId: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  help: v.optional(v.string()),
  helpUrl: v.optional(v.string()),
  target: v.optional(v.string()),
  pageRegion: v.optional(findingPageRegionValidator),
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
  highlightId: v.optional(v.number()),
  bboxX: v.optional(v.number()),
  bboxY: v.optional(v.number()),
  bboxWidth: v.optional(v.number()),
  bboxHeight: v.optional(v.number()),
  screenshotViewportWidth: v.optional(v.number()),
  screenshotViewportHeight: v.optional(v.number()),
  pageTitle: v.optional(v.string()),
  capturedAt: v.optional(v.number()),
  screenshotStorageId: v.optional(v.id("_storage")),
});

export const submitExternalPageFindings = action({
  args: {
    workerToken: v.string(),
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
    findings: v.array(externalScannerFindingValidator),
    extractLatencyMs: v.optional(v.number()),
    pageScreenshotStorageId: v.optional(v.id("_storage")),
    pageScreenshotCapturedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    const processing = await ctx.runQuery(internal.scans.getScanRunPageForProcessing, {
      scanRunId: args.scanRunId,
      pageRunId: args.pageRunId,
    });
    if (!processing) return null;
    await ctx.runMutation(internal.scans.replaceFindingsForPage, {
      scanRunId: args.scanRunId,
      scanRunPageId: args.pageRunId,
      assetId: processing.scanRun.assetId,
      findings: args.findings,
    });
    await ctx.runMutation(internal.scans.completeScanRunPage, {
      pageRunId: args.pageRunId,
      findingCount: args.findings.length,
      extractLatencyMs: args.extractLatencyMs,
      pageScreenshotStorageId: args.pageScreenshotStorageId,
      pageScreenshotCapturedAt: args.pageScreenshotCapturedAt,
    });
    const replayRunId = await upsertAdascoutReplayRun(
      ctx,
      `scanRunPage:${args.pageRunId}`,
      "page_scan",
    );
    if (replayRunId) {
      await appendAdascoutReplayStep(ctx, {
        runId: replayRunId,
        seq: nowMs(),
        kind: "submit_findings",
        status: "completed",
        label: "External page findings submitted",
        url: processing.pageRun.pageUrl,
        resultSummary: `findings=${args.findings.length}; latencyMs=${args.extractLatencyMs ?? 0}`,
        screenshotStorageId: args.pageScreenshotStorageId,
      });
    }
    return null;
  },
});

export const failExternalPageScan = action({
  args: {
    workerToken: v.string(),
    pageRunId: v.id("scanRunPages"),
    errorMessage: v.string(),
    errorCategory: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    await ctx.runMutation(internal.scans.failScanRunPage, {
      pageRunId: args.pageRunId,
      errorMessage: args.errorMessage,
      errorCategory: args.errorCategory,
    });
    const replayRunId = await upsertAdascoutReplayRun(
      ctx,
      `scanRunPage:${args.pageRunId}`,
      "page_scan",
    );
    if (replayRunId) {
      await appendAdascoutReplayStep(ctx, {
        runId: replayRunId,
        seq: nowMs(),
        kind: "scan_failed",
        status: "failed",
        label: "External page scan failed",
        errorMessage: args.errorMessage,
      });
    }
    return null;
  },
});

export const submitExternalDiscoveredPages = action({
  args: {
    workerToken: v.string(),
    jobId: v.id("externalDiscoveryJobs"),
    pageUrls: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    const job = await ctx.runQuery(internal.scans.getExternalDiscoveryJob, {
      jobId: args.jobId,
    });
    if (!job) {
      throw new ConvexError("External discovery job not found.");
    }
    await ctx.runMutation(internal.scans.completeExternalDiscoveryJob, {
      jobId: args.jobId,
      pageUrls: args.pageUrls,
    });
    await ctx.runMutation(internal.scans.upsertDiscoveredPages, {
      assetId: job.assetId,
      pageUrls: args.pageUrls,
    });
    const replayRunId = await upsertAdascoutReplayRun(
      ctx,
      `externalDiscoveryJob:${args.jobId}`,
      "external_discovery",
    );
    if (replayRunId) {
      await appendAdascoutReplayStep(ctx, {
        runId: replayRunId,
        seq: nowMs(),
        kind: "discovery_completed",
        status: "completed",
        label: "External discovery completed",
        resultSummary: `discoveredUrls=${args.pageUrls.length}`,
      });
    }
    return null;
  },
});

export const failExternalDiscoveryJob = action({
  args: {
    workerToken: v.string(),
    jobId: v.id("externalDiscoveryJobs"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    await ctx.runMutation(internal.scans.markExternalDiscoveryJobFailed, {
      jobId: args.jobId,
      errorMessage: args.errorMessage,
    });
    const replayRunId = await upsertAdascoutReplayRun(
      ctx,
      `externalDiscoveryJob:${args.jobId}`,
      "external_discovery",
    );
    if (replayRunId) {
      await appendAdascoutReplayStep(ctx, {
        runId: replayRunId,
        seq: nowMs(),
        kind: "discovery_failed",
        status: "failed",
        label: "External discovery failed",
        errorMessage: args.errorMessage,
      });
    }
    return null;
  },
});

export const enqueueExternalScannerSmokeTest = action({
  args: {
    workerToken: v.string(),
    assetId: v.id("assets"),
    pageUrl: v.string(),
  },
  returns: v.object({
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
  }),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    const created = (await ctx.runMutation(internal.scans.createExternalWorkerSmokeRun, {
      assetId: args.assetId,
      pageUrl: args.pageUrl,
    })) as { scanRunId: Id<"scanRuns">; pageRunId: Id<"scanRunPages"> };
    return created;
  },
});

export const getExternalScannerSmokeResult = action({
  args: {
    workerToken: v.string(),
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
  },
  returns: v.object({
    scanRunStatus: scanRunStatusValidator,
    pageStatus: scanRunPageStatusValidator,
    pageErrorMessage: v.optional(v.string()),
    pageFindingCount: v.number(),
    totalFindingsForPage: v.number(),
    sources: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    assertScannerWorkerAuthorized(args.workerToken);
    const snapshot = (await ctx.runQuery(internal.scans.getExternalScannerSmokeSnapshot, {
      scanRunId: args.scanRunId,
      pageRunId: args.pageRunId,
    })) as {
      scanRunStatus: "queued" | "running" | "completed" | "failed" | "canceled";
      pageStatus: "queued" | "running" | "completed" | "failed" | "canceled";
      pageErrorMessage?: string;
      pageFindingCount: number;
      totalFindingsForPage: number;
      sources: string[];
    };
    return snapshot;
  },
});

export const createExternalWorkerSmokeRun = internalMutation({
  args: {
    assetId: v.id("assets"),
    pageUrl: v.string(),
  },
  returns: v.object({
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
  }),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new ConvexError("Asset not found.");
    }
    const now = nowMs();
    const scanRunId = await ctx.db.insert("scanRuns", {
      assetId: asset._id,
      profile: "wcag_2_2_aa",
      mode: "website_pages",
      status: "running",
      queuedAt: now,
      startedAt: now,
      totalPages: 1,
      queuedPages: 1,
      runningPages: 0,
      completedPages: 0,
      failedPages: 0,
      createdBy: asset.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    const pageRunId = await ctx.db.insert("scanRunPages", {
      scanRunId,
      assetId: asset._id,
      createdBy: asset.createdBy,
      pageUrl: args.pageUrl,
      normalizedUrl: args.pageUrl,
      status: "queued",
      attempt: 0,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await scheduleExternalScannerWake(ctx, "external_worker_smoke_run_enqueued");
    return { scanRunId, pageRunId };
  },
});

export const getExternalScannerSmokeSnapshot = internalQuery({
  args: {
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
  },
  returns: v.object({
    scanRunStatus: scanRunStatusValidator,
    pageStatus: scanRunPageStatusValidator,
    pageErrorMessage: v.optional(v.string()),
    pageFindingCount: v.number(),
    totalFindingsForPage: v.number(),
    sources: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun) {
      throw new ConvexError("Scan run not found.");
    }
    const page = await ctx.db.get(args.pageRunId);
    if (!page || page.scanRunId !== args.scanRunId) {
      throw new ConvexError("Scan run page not found.");
    }
    const findings = await ctx.db
      .query("findings")
      .withIndex("by_scanRunPage_createdAt", (q) =>
        q.eq("scanRunPageId", args.pageRunId),
      )
      .collect();
    return {
      scanRunStatus: scanRun.status,
      pageStatus: page.status,
      pageErrorMessage: page.errorMessage,
      pageFindingCount: page.findingCount ?? 0,
      totalFindingsForPage: findings.length,
      sources: Array.from(new Set(findings.map((finding) => finding.source))),
    };
  },
});

export const backfillDiscoveredPageUniqueness = internalMutation({
  args: {
    assetId: v.id("assets"),
  },
  returns: v.object({
    removedCount: v.number(),
    remainingCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const normalizePageUrl = (raw: string): string => {
      try {
        return normalizeHttpUrl(raw);
      } catch {
        return raw.trim();
      }
    };
    const rows = await ctx.db
      .query("discoveredPages")
      .withIndex("by_asset_discoveredAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .collect();
    const scanRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .take(500);
    const scanRunPages: {
      pageUrl: string;
      normalizedUrl: string;
      updatedAt: number;
    }[] = [];
    for (const run of scanRuns) {
      const pages = await ctx.db
        .query("scanRunPages")
        .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", run._id))
        .take(2000);
      for (const page of pages) {
        scanRunPages.push({
          pageUrl: page.pageUrl,
          normalizedUrl: page.normalizedUrl,
          updatedAt: page.updatedAt,
        });
      }
    }
    const seen = new Set<string>();
    let removedCount = 0;
    for (const row of rows) {
      const key = normalizePageUrl(row.normalizedUrl || row.pageUrl);
      if (seen.has(key)) {
        await ctx.db.delete(row._id);
        removedCount += 1;
        continue;
      }
      seen.add(key);
      if (row.normalizedUrl !== key || row.pageUrl !== key) {
        await ctx.db.patch(row._id, {
          normalizedUrl: key,
          pageUrl: key,
        });
      }
    }
    const now = nowMs();
    const seenBeforeInsert = new Set(seen);
    for (const row of scanRunPages) {
      const key = normalizePageUrl(row.normalizedUrl || row.pageUrl);
      if (seenBeforeInsert.has(key)) continue;
      await ctx.db.insert("discoveredPages", {
        assetId: args.assetId,
        pageUrl: key,
        normalizedUrl: key,
        discoveredAt: row.updatedAt || now,
      });
      seenBeforeInsert.add(key);
    }
    return {
      removedCount,
      remainingCount: seenBeforeInsert.size,
    };
  },
});
