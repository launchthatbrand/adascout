import { v } from "convex/values";

export const assetKindValidator = v.union(v.literal("url"), v.literal("file_pdf"));
export const assetStatusValidator = v.union(v.literal("ready"), v.literal("archived"));
export const urlAssetScopeValidator = v.union(
  v.literal("single_page"),
  v.literal("website"),
);

export const scanRunStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled"),
);

export const scanRunModeValidator = v.union(
  v.literal("single_asset"),
  v.literal("website_pages"),
);

export const scanRunPageStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled"),
);

export const findingSeverityValidator = v.union(
  v.literal("critical"),
  v.literal("serious"),
  v.literal("moderate"),
  v.literal("minor"),
  v.literal("info"),
);

export const findingSourceValidator = v.union(
  v.literal("axe"),
  v.literal("ibm"),
  v.literal("pdf"),
  v.literal("stagehand"),
);

export const findingStatusValidator = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("resolved"),
  v.literal("verified_on_rescan"),
  v.literal("regressed"),
);

export const wcagProfileValidator = v.union(v.literal("wcag_2_2_aa"));
export const reportLayoutValidator = v.union(v.literal("compact"), v.literal("expanded"));

export const scanSummaryValidator = v.object({
  total: v.number(),
  critical: v.number(),
  serious: v.number(),
  moderate: v.number(),
  minor: v.number(),
  info: v.number(),
  manualReviewRequired: v.number(),
});
