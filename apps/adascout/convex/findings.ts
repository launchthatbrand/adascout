import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";
import {
  findingSeverityValidator,
  findingSourceValidator,
  findingStatusValidator,
} from "./scanTypes";

const findingRowValidator = v.object({
  _id: v.id("findings"),
  _creationTime: v.number(),
  assetId: v.id("assets"),
  scanRunId: v.id("scanRuns"),
  scanRunPageId: v.optional(v.id("scanRunPages")),
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
  createdAt: v.number(),
});

const nowMs = () => Date.now();

export const listMyFindingsByScanRun = query({
  args: {
    scanRunId: v.id("scanRuns"),
    scanRunPageId: v.optional(v.id("scanRunPages")),
    severity: v.optional(findingSeverityValidator),
    source: v.optional(findingSourceValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(findingRowValidator),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      return [];
    }
    const limit = Math.max(1, Math.min(1000, Number(args.limit ?? 500)));
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", args.scanRunId))
      .order("desc")
      .take(limit);
    return rows.filter((row) => {
      if (args.scanRunPageId && row.scanRunPageId !== args.scanRunPageId) return false;
      if (args.severity && row.severity !== args.severity) return false;
      if (args.source && row.source !== args.source) return false;
      return true;
    });
  },
});

export const listMyFindingsByAsset = query({
  args: {
    assetId: v.id("assets"),
    status: v.optional(findingStatusValidator),
    assignee: v.optional(v.id("users")),
    severity: v.optional(findingSeverityValidator),
    source: v.optional(findingSourceValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(findingRowValidator),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return [];
    }
    const limit = Math.max(1, Math.min(2000, Number(args.limit ?? 1000)));
    const rows = await ctx.db
      .query("findings")
      .withIndex("by_asset_severity", (q) => q.eq("assetId", args.assetId))
      .collect();
    return rows
      .filter((row) => {
        if (args.status && (row.status ?? "open") !== args.status) return false;
        if (args.assignee && row.assignee !== args.assignee) return false;
        if (args.severity && row.severity !== args.severity) return false;
        if (args.source && row.source !== args.source) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },
});

export const updateMyFindingStatus = mutation({
  args: {
    findingId: v.id("findings"),
    status: findingStatusValidator,
    resolutionNotes: v.optional(v.string()),
  },
  returns: findingRowValidator,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const finding = await ctx.db.get(args.findingId);
    if (!finding) {
      throw new Error("Finding not found.");
    }
    const asset = await ctx.db.get(finding.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new Error("Unauthorized.");
    }

    const now = nowMs();
    await ctx.db.patch(args.findingId, {
      status: args.status,
      resolutionNotes: args.resolutionNotes ?? finding.resolutionNotes,
      lastStateChangeAt: now,
      resolvedAt:
        args.status === "resolved" || args.status === "verified_on_rescan" ? now : finding.resolvedAt,
      verifiedAt: args.status === "verified_on_rescan" ? now : finding.verifiedAt,
    });
    const updated = await ctx.db.get(args.findingId);
    if (!updated) {
      throw new Error("Finding not found after update.");
    }
    return updated;
  },
});

export const assignMyFinding = mutation({
  args: {
    findingId: v.id("findings"),
    assignee: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
  },
  returns: findingRowValidator,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const finding = await ctx.db.get(args.findingId);
    if (!finding) {
      throw new Error("Finding not found.");
    }
    const asset = await ctx.db.get(finding.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new Error("Unauthorized.");
    }
    await ctx.db.patch(args.findingId, {
      assignee: args.assignee,
      dueAt: args.dueAt,
      lastStateChangeAt: nowMs(),
    });
    const updated = await ctx.db.get(args.findingId);
    if (!updated) {
      throw new Error("Finding not found after update.");
    }
    return updated;
  },
});

export const bulkUpdateMyFindings = mutation({
  args: {
    findingIds: v.array(v.id("findings")),
    status: v.optional(findingStatusValidator),
    assignee: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
    resolutionNotes: v.optional(v.string()),
  },
  returns: v.object({
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = nowMs();
    let updated = 0;
    for (const findingId of args.findingIds) {
      const finding = await ctx.db.get(findingId);
      if (!finding) continue;
      const asset = await ctx.db.get(finding.assetId);
      if (!asset || asset.createdBy !== userId) continue;
      await ctx.db.patch(findingId, {
        ...(args.status ? { status: args.status } : {}),
        ...(args.assignee !== undefined ? { assignee: args.assignee } : {}),
        ...(args.dueAt !== undefined ? { dueAt: args.dueAt } : {}),
        ...(args.resolutionNotes !== undefined ? { resolutionNotes: args.resolutionNotes } : {}),
        lastStateChangeAt: now,
        ...(args.status === "resolved" || args.status === "verified_on_rescan"
          ? { resolvedAt: now }
          : {}),
        ...(args.status === "verified_on_rescan" ? { verifiedAt: now } : {}),
      });
      updated += 1;
    }
    return { updated };
  },
});

export const getMyFindingActor = query({
  args: {},
  returns: v.object({ userId: v.id("users") }),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return { userId };
  },
});

