import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";
import { scanSummaryValidator, wcagProfileValidator } from "./scanTypes";

export const upsertReportForScanRun = internalMutation({
  args: {
    assetId: v.id("assets"),
    scanRunId: v.id("scanRuns"),
    generatedBy: v.id("users"),
    profile: wcagProfileValidator,
    generatedAt: v.number(),
    summary: scanSummaryValidator,
    markdown: v.string(),
    json: v.string(),
  },
  returns: v.id("reports"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_scanRun", (q) => q.eq("scanRunId", args.scanRunId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        profile: args.profile,
        generatedAt: args.generatedAt,
        totalFindings: args.summary.total,
        criticalCount: args.summary.critical,
        seriousCount: args.summary.serious,
        moderateCount: args.summary.moderate,
        minorCount: args.summary.minor,
        infoCount: args.summary.info,
        manualReviewRequiredCount: args.summary.manualReviewRequired,
        markdown: args.markdown,
        json: args.json,
      });
      return existing._id;
    }
    return await ctx.db.insert("reports", {
      assetId: args.assetId,
      scanRunId: args.scanRunId,
      profile: args.profile,
      formatVersion: 1,
      generatedBy: args.generatedBy,
      generatedAt: args.generatedAt,
      totalFindings: args.summary.total,
      criticalCount: args.summary.critical,
      seriousCount: args.summary.serious,
      moderateCount: args.summary.moderate,
      minorCount: args.summary.minor,
      infoCount: args.summary.info,
      manualReviewRequiredCount: args.summary.manualReviewRequired,
      markdown: args.markdown,
      json: args.json,
    });
  },
});

export const getMyReportByScanRun = query({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.union(
    v.object({
      _id: v.id("reports"),
      _creationTime: v.number(),
      assetId: v.id("assets"),
      scanRunId: v.id("scanRuns"),
      generatedBy: v.id("users"),
      profile: wcagProfileValidator,
      formatVersion: v.number(),
      generatedAt: v.number(),
      totalFindings: v.number(),
      criticalCount: v.number(),
      seriousCount: v.number(),
      moderateCount: v.number(),
      minorCount: v.number(),
      infoCount: v.number(),
      manualReviewRequiredCount: v.number(),
      markdown: v.string(),
      json: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRun = await ctx.db.get(args.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      return null;
    }
    const report = await ctx.db
      .query("reports")
      .withIndex("by_scanRun", (q) => q.eq("scanRunId", args.scanRunId))
      .first();
    if (!report) {
      return null;
    }
    return report;
  },
});

export const listMyReports = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("reports"),
      _creationTime: v.number(),
      assetId: v.id("assets"),
      scanRunId: v.id("scanRuns"),
      generatedBy: v.id("users"),
      profile: wcagProfileValidator,
      formatVersion: v.number(),
      generatedAt: v.number(),
      totalFindings: v.number(),
      criticalCount: v.number(),
      seriousCount: v.number(),
      moderateCount: v.number(),
      minorCount: v.number(),
      infoCount: v.number(),
      manualReviewRequiredCount: v.number(),
      markdown: v.string(),
      json: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const scanRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .collect();
    const allowedRunIds = new Set(scanRuns.map((run) => String(run._id)));
    const limit = Math.max(1, Math.min(200, Number(args.limit ?? 100)));
    const rows = await ctx.db.query("reports").withIndex("by_asset_generatedAt").order("desc").take(limit);
    return rows.filter((row) => allowedRunIds.has(String(row.scanRunId)));
  },
});

export const getMyReportById = query({
  args: { reportId: v.id("reports") },
  returns: v.union(
    v.object({
      _id: v.id("reports"),
      _creationTime: v.number(),
      assetId: v.id("assets"),
      scanRunId: v.id("scanRuns"),
      generatedBy: v.id("users"),
      profile: wcagProfileValidator,
      formatVersion: v.number(),
      generatedAt: v.number(),
      totalFindings: v.number(),
      criticalCount: v.number(),
      seriousCount: v.number(),
      moderateCount: v.number(),
      minorCount: v.number(),
      infoCount: v.number(),
      manualReviewRequiredCount: v.number(),
      markdown: v.string(),
      json: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    const scanRun = await ctx.db.get(report.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      return null;
    }
    return report;
  },
});

export const getMyReportExport = query({
  args: { reportId: v.id("reports"), format: v.union(v.literal("json"), v.literal("markdown")) },
  returns: v.object({
    filename: v.string(),
    contentType: v.string(),
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError("Report not found.");
    }
    const scanRun = await ctx.db.get(report.scanRunId);
    if (!scanRun || scanRun.createdBy !== userId) {
      throw new ConvexError("Unauthorized.");
    }
    const ext = args.format === "json" ? "json" : "md";
    return {
      filename: `adascout-report-${String(report._id)}.${ext}`,
      contentType: args.format === "json" ? "application/json" : "text/markdown",
      body: args.format === "json" ? report.json : report.markdown,
    };
  },
});

