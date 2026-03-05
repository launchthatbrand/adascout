import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./helpers";

const nowMs = () => Date.now();
const severityValidator = v.union(
  v.literal("critical"),
  v.literal("serious"),
  v.literal("moderate"),
  v.literal("minor"),
  v.literal("info"),
);
const sourceValidator = v.union(
  v.literal("axe"),
  v.literal("ibm"),
  v.literal("pdf"),
  v.literal("stagehand"),
);
const layoutValidator = v.union(v.literal("compact"), v.literal("expanded"));
const profileValidator = v.union(v.literal("wcag_2_2_aa"));
const summaryValidator = v.object({
  total: v.number(),
  critical: v.number(),
  serious: v.number(),
  moderate: v.number(),
  minor: v.number(),
  info: v.number(),
  manualReviewRequired: v.number(),
});

const reportValidator = v.object({
  _id: v.id("reports"),
  _creationTime: v.number(),
  assetId: v.id("assets"),
  scanRunId: v.optional(v.id("scanRuns")),
  generatedBy: v.id("users"),
  profile: profileValidator,
  name: v.optional(v.string()),
  layout: layoutValidator,
  selectedScanRunIds: v.optional(v.array(v.id("scanRuns"))),
  selectedSeverities: v.optional(v.array(severityValidator)),
  selectedSources: v.optional(v.array(sourceValidator)),
  logoStorageId: v.optional(v.id("_storage")),
  companyName: v.optional(v.string()),
  footerText: v.optional(v.string()),
  baselineScanRunId: v.optional(v.id("scanRuns")),
  includeNewResolvedRegressed: v.optional(v.boolean()),
  filterSnapshotJson: v.optional(v.string()),
  formatVersion: v.number(),
  generatedAt: v.number(),
  updatedAt: v.number(),
  totalFindings: v.number(),
  criticalCount: v.number(),
  seriousCount: v.number(),
  moderateCount: v.number(),
  minorCount: v.number(),
  infoCount: v.number(),
  manualReviewRequiredCount: v.number(),
  markdown: v.string(),
  json: v.string(),
  pdfHtml: v.optional(v.string()),
});

interface SummaryFinding {
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  manualReviewRequired?: boolean;
}

const severityRank = (severity: SummaryFinding["severity"]) => {
  if (severity === "critical") return 5;
  if (severity === "serious") return 4;
  if (severity === "moderate") return 3;
  if (severity === "minor") return 2;
  return 1;
};

const computeSummary = (findings: SummaryFinding[]) => {
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
    if (finding.manualReviewRequired) summary.manualReviewRequired += 1;
  }
  return summary;
};

export const upsertReportForScanRun = internalMutation({
  args: {
    assetId: v.id("assets"),
    scanRunId: v.id("scanRuns"),
    generatedBy: v.id("users"),
    profile: profileValidator,
    generatedAt: v.number(),
    summary: summaryValidator,
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
        updatedAt: args.generatedAt,
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
      name: undefined,
      layout: "compact",
      selectedScanRunIds: [args.scanRunId],
      selectedSeverities: undefined,
      selectedSources: undefined,
      logoStorageId: undefined,
      companyName: undefined,
      footerText: undefined,
      baselineScanRunId: undefined,
      includeNewResolvedRegressed: false,
      filterSnapshotJson: undefined,
      formatVersion: 2,
      generatedBy: args.generatedBy,
      generatedAt: args.generatedAt,
      updatedAt: args.generatedAt,
      totalFindings: args.summary.total,
      criticalCount: args.summary.critical,
      seriousCount: args.summary.serious,
      moderateCount: args.summary.moderate,
      minorCount: args.summary.minor,
      infoCount: args.summary.info,
      manualReviewRequiredCount: args.summary.manualReviewRequired,
      markdown: args.markdown,
      json: args.json,
      pdfHtml: undefined,
    });
  },
});

export const createMyReport = mutation({
  args: {
    assetId: v.id("assets"),
    name: v.optional(v.string()),
  },
  returns: v.id("reports"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Asset not found.");
    }
    const now = nowMs();
    return await ctx.db.insert("reports", {
      assetId: args.assetId,
      scanRunId: undefined,
      generatedBy: userId,
      profile: "wcag_2_2_aa",
      name: args.name?.trim() ?? undefined,
      layout: "compact",
      selectedScanRunIds: undefined,
      selectedSeverities: undefined,
      selectedSources: undefined,
      logoStorageId: undefined,
      companyName: undefined,
      footerText: undefined,
      baselineScanRunId: undefined,
      includeNewResolvedRegressed: false,
      filterSnapshotJson: undefined,
      formatVersion: 2,
      generatedAt: now,
      updatedAt: now,
      totalFindings: 0,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
      infoCount: 0,
      manualReviewRequiredCount: 0,
      markdown: "",
      json: "{}",
      pdfHtml: undefined,
    });
  },
});

export const updateMyReportConfig = mutation({
  args: {
    reportId: v.id("reports"),
    name: v.optional(v.string()),
    layout: v.optional(layoutValidator),
    selectedScanRunIds: v.optional(v.array(v.id("scanRuns"))),
    selectedSeverities: v.optional(v.array(severityValidator)),
    selectedSources: v.optional(v.array(sourceValidator)),
    logoStorageId: v.optional(v.id("_storage")),
    companyName: v.optional(v.string()),
    footerText: v.optional(v.string()),
    baselineScanRunId: v.optional(v.id("scanRuns")),
    includeNewResolvedRegressed: v.optional(v.boolean()),
  },
  returns: reportValidator,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError("Report not found.");
    }
    const asset = await ctx.db.get(report.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Unauthorized.");
    }

    if (args.selectedScanRunIds && args.selectedScanRunIds.length > 0) {
      const runs = await ctx.db
        .query("scanRuns")
        .withIndex("by_asset_createdAt", (q) => q.eq("assetId", report.assetId))
        .collect();
      const allowed = new Set(
        runs.filter((run) => run.createdBy === userId).map((run) => String(run._id)),
      );
      const invalid = args.selectedScanRunIds.find((id) => !allowed.has(String(id)));
      if (invalid) {
        throw new ConvexError("One or more selected runs are invalid.");
      }
    }

    await ctx.db.patch(report._id, {
      name: args.name?.trim() ?? undefined,
      layout: args.layout ?? report.layout,
      selectedScanRunIds:
        args.selectedScanRunIds && args.selectedScanRunIds.length > 0
          ? Array.from(new Set(args.selectedScanRunIds))
          : undefined,
      selectedSeverities:
        args.selectedSeverities && args.selectedSeverities.length > 0
          ? Array.from(new Set(args.selectedSeverities))
          : undefined,
      selectedSources:
        args.selectedSources && args.selectedSources.length > 0
          ? Array.from(new Set(args.selectedSources))
          : undefined,
      logoStorageId: args.logoStorageId ?? report.logoStorageId,
      companyName: args.companyName?.trim() ?? report.companyName,
      footerText: args.footerText?.trim() ?? report.footerText,
      baselineScanRunId: args.baselineScanRunId ?? report.baselineScanRunId,
      includeNewResolvedRegressed: args.includeNewResolvedRegressed ?? report.includeNewResolvedRegressed,
      filterSnapshotJson: JSON.stringify(
        {
          selectedScanRunIds:
            args.selectedScanRunIds && args.selectedScanRunIds.length > 0
              ? Array.from(new Set(args.selectedScanRunIds))
              : report.selectedScanRunIds ?? [],
          selectedSeverities:
            args.selectedSeverities && args.selectedSeverities.length > 0
              ? Array.from(new Set(args.selectedSeverities))
              : report.selectedSeverities ?? [],
          selectedSources:
            args.selectedSources && args.selectedSources.length > 0
              ? Array.from(new Set(args.selectedSources))
              : report.selectedSources ?? [],
          baselineScanRunId: args.baselineScanRunId ?? report.baselineScanRunId,
          includeNewResolvedRegressed:
            args.includeNewResolvedRegressed ?? report.includeNewResolvedRegressed ?? false,
        },
        null,
        2,
      ),
      updatedAt: nowMs(),
    });

    const updated = await ctx.db.get(report._id);
    if (!updated) {
      throw new ConvexError("Report not found.");
    }
    return updated;
  },
});

export const getMyReportByScanRun = query({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.union(reportValidator, v.null()),
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
    return report ?? null;
  },
});

export const listMyReports = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("reports"),
      assetId: v.id("assets"),
      scanRunId: v.optional(v.id("scanRuns")),
      name: v.optional(v.string()),
      layout: layoutValidator,
      generatedAt: v.number(),
      updatedAt: v.number(),
      totalFindings: v.number(),
      criticalCount: v.number(),
      seriousCount: v.number(),
      moderateCount: v.number(),
      minorCount: v.number(),
      infoCount: v.number(),
      profile: profileValidator,
      companyName: v.optional(v.string()),
      baselineScanRunId: v.optional(v.id("scanRuns")),
      includeNewResolvedRegressed: v.optional(v.boolean()),
      assetTitle: v.optional(v.string()),
      assetSource: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(200, Number(args.limit ?? 100)));

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .collect();
    const allowedAssetIds = new Set(assets.map((asset) => String(asset._id)));
    const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));

    const rows = await ctx.db
      .query("reports")
      .withIndex("by_asset_generatedAt")
      .order("desc")
      .take(2000);

    return rows
      .filter((row) => allowedAssetIds.has(String(row.assetId)))
      .slice(0, limit)
      .map((row) => {
        const asset = assetById.get(String(row.assetId));
        return {
          _id: row._id,
          assetId: row.assetId,
          scanRunId: row.scanRunId,
          name: row.name,
          layout: row.layout,
          generatedAt: row.generatedAt,
          updatedAt: row.updatedAt,
          totalFindings: row.totalFindings,
          criticalCount: row.criticalCount,
          seriousCount: row.seriousCount,
          moderateCount: row.moderateCount,
          minorCount: row.minorCount,
          infoCount: row.infoCount,
          profile: row.profile,
          companyName: row.companyName,
          baselineScanRunId: row.baselineScanRunId,
          includeNewResolvedRegressed: row.includeNewResolvedRegressed,
          assetTitle: asset?.title ?? asset?.filename ?? undefined,
          assetSource: asset?.sourceUrl ?? asset?.normalizedUrl ?? asset?.filename ?? undefined,
        };
      });
  },
});

export const getMyReportById = query({
  args: { reportId: v.id("reports") },
  returns: v.union(reportValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    const asset = await ctx.db.get(report.assetId);
    if (!asset || asset.createdBy !== userId) {
      return null;
    }
    return report;
  },
});

export const getMyReportPreviewData = query({
  args: { reportId: v.id("reports") },
  returns: v.object({
    reportId: v.id("reports"),
    reportName: v.optional(v.string()),
    layout: layoutValidator,
    profile: profileValidator,
    generatedAt: v.number(),
    asset: v.object({
      assetId: v.id("assets"),
      title: v.string(),
      source: v.optional(v.string()),
    }),
    branding: v.object({
      logoStorageId: v.optional(v.id("_storage")),
      companyName: v.optional(v.string()),
      footerText: v.optional(v.string()),
    }),
    availableRuns: v.array(
      v.object({
        scanRunId: v.id("scanRuns"),
        createdAt: v.number(),
        status: v.string(),
      }),
    ),
    selected: v.object({
      scanRunIds: v.array(v.id("scanRuns")),
      severities: v.array(severityValidator),
      sources: v.array(sourceValidator),
    }),
    delta: v.object({
      baselineScanRunId: v.optional(v.id("scanRuns")),
      includeNewResolvedRegressed: v.boolean(),
      newCount: v.number(),
      resolvedCount: v.number(),
      regressedCount: v.number(),
    }),
    summary: summaryValidator,
    findings: v.array(
      v.object({
        findingId: v.id("findings"),
        scanRunId: v.id("scanRuns"),
        scanRunPageId: v.optional(v.id("scanRunPages")),
        severity: severityValidator,
        source: sourceValidator,
        ruleId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        target: v.optional(v.string()),
        pageUrl: v.optional(v.string()),
        helpUrl: v.optional(v.string()),
        manualReviewRequired: v.optional(v.boolean()),
        status: v.optional(v.string()),
        evidenceHash: v.optional(v.string()),
        pageTitle: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
    groupedByPage: v.array(
      v.object({
        pageUrl: v.string(),
        findingCount: v.number(),
        findings: v.array(
          v.object({
            findingId: v.string(),
            severity: severityValidator,
            source: sourceValidator,
            ruleId: v.string(),
            title: v.string(),
            description: v.optional(v.string()),
            target: v.optional(v.string()),
            helpUrl: v.optional(v.string()),
          status: v.optional(v.string()),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError("Report not found.");
    }
    const asset = await ctx.db.get(report.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Unauthorized.");
    }

    const assetRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", report.assetId))
      .collect();
    const ownedRuns = assetRuns
      .filter((run) => run.createdBy === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
    const runIds = new Set(ownedRuns.map((run) => String(run._id)));

    const selectedRunIds =
      report.selectedScanRunIds && report.selectedScanRunIds.length > 0
        ? report.selectedScanRunIds.filter((id) => runIds.has(String(id)))
        : ownedRuns.map((run) => run._id);

    const severityFilter =
      report.selectedSeverities && report.selectedSeverities.length > 0
        ? new Set(report.selectedSeverities)
        : null;
    const sourceFilter =
      report.selectedSources && report.selectedSources.length > 0
        ? new Set(report.selectedSources)
        : null;

    const findings = [];
    const baselineScanRunId = report.baselineScanRunId;
    const baselineRows = baselineScanRunId
      ? await ctx.db
        .query("findings")
        .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", baselineScanRunId))
        .collect()
      : [];
    const baselineKeys = new Set(
      baselineRows.map((row) => `${row.ruleId}|${row.pageUrl ?? ""}|${row.target ?? ""}`),
    );
    for (const runId of selectedRunIds) {
      const rows = await ctx.db
        .query("findings")
        .withIndex("by_scanRun_createdAt", (q) => q.eq("scanRunId", runId))
        .collect();
      for (const row of rows) {
        if (severityFilter && !severityFilter.has(row.severity)) continue;
        if (sourceFilter && !sourceFilter.has(row.source)) continue;
        findings.push({
          findingId: row._id,
          scanRunId: row.scanRunId,
          scanRunPageId: row.scanRunPageId,
          severity: row.severity,
          source: row.source,
          ruleId: row.ruleId,
          title: row.title,
          description: row.description,
          target: row.target,
          pageUrl: row.pageUrl,
          helpUrl: row.helpUrl,
          manualReviewRequired: row.manualReviewRequired,
          status: row.status,
          evidenceHash: row.evidenceHash,
          pageTitle: row.pageTitle,
          createdAt: row.createdAt,
        });
      }
    }

    findings.sort((a, b) => {
      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      if (severityDelta !== 0) return severityDelta;
      return b.createdAt - a.createdAt;
    });

    const summary = computeSummary(
      findings.map((row) => ({
        severity: row.severity,
        manualReviewRequired: row.manualReviewRequired,
      })),
    );

    const groupedByPageMap = new Map<
      string,
      {
        pageUrl: string;
        findingCount: number;
        findings: {
          findingId: string;
          severity: "critical" | "serious" | "moderate" | "minor" | "info";
          source: "axe" | "ibm" | "pdf" | "stagehand";
          ruleId: string;
          title: string;
          description?: string;
          target?: string;
          helpUrl?: string;
          status?: string;
        }[];
      }
    >();
    for (const row of findings) {
      const pageUrl = row.pageUrl ?? "Asset-level findings";
      const current = groupedByPageMap.get(pageUrl) ?? {
        pageUrl,
        findingCount: 0,
        findings: [],
      };
      current.findings.push({
        findingId: String(row.findingId),
        severity: row.severity,
        source: row.source,
        ruleId: row.ruleId,
        title: row.title,
        description: row.description,
        target: row.target,
        helpUrl: row.helpUrl,
        status: row.status,
      });
      current.findingCount += 1;
      groupedByPageMap.set(pageUrl, current);
    }
    const groupedByPage = Array.from(groupedByPageMap.values()).sort(
      (a, b) => b.findingCount - a.findingCount,
    );

    const currentKeys = new Set(
      findings.map((row) => `${row.ruleId}|${row.pageUrl ?? ""}|${row.target ?? ""}`),
    );
    let newCount = 0;
    let resolvedCount = 0;
    let regressedCount = 0;
    if (report.baselineScanRunId) {
      for (const key of currentKeys) {
        if (!baselineKeys.has(key)) newCount += 1;
      }
      for (const key of baselineKeys) {
        if (!currentKeys.has(key)) resolvedCount += 1;
      }
      if (report.includeNewResolvedRegressed) {
        for (const row of findings) {
          if ((row.status ?? "open") === "regressed") regressedCount += 1;
        }
      }
    }

    return {
      reportId: report._id,
      reportName: report.name,
      layout: report.layout,
      profile: report.profile,
      generatedAt: report.generatedAt,
      asset: {
        assetId: asset._id,
        title: asset.title ?? asset.filename ?? asset.sourceUrl ?? String(asset._id),
        source: asset.sourceUrl ?? asset.normalizedUrl ?? asset.filename ?? undefined,
      },
      branding: {
        logoStorageId: report.logoStorageId,
        companyName: report.companyName,
        footerText: report.footerText,
      },
      availableRuns: ownedRuns.map((run) => ({
        scanRunId: run._id,
        createdAt: run.createdAt,
        status: run.status,
      })),
      selected: {
        scanRunIds: selectedRunIds,
        severities: report.selectedSeverities ?? [],
        sources: report.selectedSources ?? [],
      },
      delta: {
        baselineScanRunId: report.baselineScanRunId,
        includeNewResolvedRegressed: report.includeNewResolvedRegressed ?? false,
        newCount,
        resolvedCount,
        regressedCount,
      },
      summary,
      findings,
      groupedByPage,
    };
  },
});

export const getMyReportExport = query({
  args: {
    reportId: v.id("reports"),
    format: v.union(v.literal("json"), v.literal("markdown")),
  },
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
    const asset = await ctx.db.get(report.assetId);
    if (!asset || asset.createdBy !== userId) {
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
