import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

export const currentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      isAdmin: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    };
  },
});

export const dashboardStats = query({
  args: {},
  returns: v.union(
    v.object({
      assets: v.number(),
      urlAssets: v.number(),
      pdfAssets: v.number(),
      queuedRuns: v.number(),
      runningRuns: v.number(),
      completedRuns: v.number(),
      failedRuns: v.number(),
      findings: v.number(),
      criticalFindings: v.number(),
      reports: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .collect();
    const scanRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .collect();
    const reports = await ctx.db.query("reports").collect();
    const assetIds = new Set(assets.map((asset) => String(asset._id)));
    const findings = await ctx.db.query("findings").collect();
    const ownedFindings = findings.filter((row) => assetIds.has(String(row.assetId)));

    return {
      assets: assets.length,
      urlAssets: assets.filter((asset) => asset.kind === "url").length,
      pdfAssets: assets.filter((asset) => asset.kind === "file_pdf").length,
      queuedRuns: scanRuns.filter((run) => run.status === "queued").length,
      runningRuns: scanRuns.filter((run) => run.status === "running").length,
      completedRuns: scanRuns.filter((run) => run.status === "completed").length,
      failedRuns: scanRuns.filter((run) => run.status === "failed").length,
      findings: ownedFindings.length,
      criticalFindings: ownedFindings.filter((row) => row.severity === "critical").length,
      reports: reports.filter((row) => scanRuns.some((run) => run._id === row.scanRunId)).length,
    };
  },
});
