import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./helpers";
import { findingSeverityValidator, findingSourceValidator } from "./scanTypes";

export const listMyFindingsByScanRun = query({
  args: {
    scanRunId: v.id("scanRuns"),
    scanRunPageId: v.optional(v.id("scanRunPages")),
    severity: v.optional(findingSeverityValidator),
    source: v.optional(findingSourceValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
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
      createdAt: v.number(),
    }),
  ),
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

