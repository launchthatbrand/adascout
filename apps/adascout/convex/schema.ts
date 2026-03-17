import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  assetKindValidator,
  assetStatusValidator,
  findingSeverityValidator,
  findingSourceValidator,
  findingStatusValidator,
  findingPageRegionValidator,
  reportLayoutValidator,
  scanRunModeValidator,
  scanRunPageStatusValidator,
  scanRunStatusValidator,
  urlAssetScopeValidator,
  wcagProfileValidator,
} from "./scanTypes";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
  })
    .index("by_email", ["email"])
    .index("by_isAdmin", ["isAdmin"]),

  assets: defineTable({
    kind: assetKindValidator,
    urlScope: v.optional(urlAssetScopeValidator),
    status: assetStatusValidator,
    title: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    normalizedUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    filename: v.optional(v.string()),
    contentType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    wpUsername: v.optional(v.string()),
    wpAppPassword: v.optional(v.string()),
    wpConnectedAt: v.optional(v.number()),
    mondayApiToken: v.optional(v.string()),
    mondayBoardId: v.optional(v.string()),
    mondayConnectedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdBy_createdAt", ["createdBy", "createdAt"])
    .index("by_createdBy_kind", ["createdBy", "kind"])
    .index("by_createdBy_status", ["createdBy", "status"])
    .index("by_createdBy_normalizedUrl", ["createdBy", "normalizedUrl"]),

  scanRuns: defineTable({
    assetId: v.id("assets"),
    workflowId: v.optional(v.string()),
    profile: wcagProfileValidator,
    mode: v.optional(scanRunModeValidator),
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
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_asset_createdAt", ["assetId", "createdAt"])
    .index("by_createdBy_createdAt", ["createdBy", "createdAt"])
    .index("by_createdBy_status", ["createdBy", "status"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  scanRunPages: defineTable({
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
  })
    .index("by_scanRun_createdAt", ["scanRunId", "createdAt"])
    .index("by_scanRun_status", ["scanRunId", "status"])
    .index("by_scanRun_normalizedUrl", ["scanRunId", "normalizedUrl"])
    .index("by_createdBy_createdAt", ["createdBy", "createdAt"]),

  scanSessionLeases: defineTable({
    leaseKey: v.string(),
    holderId: v.string(),
    scanRunId: v.id("scanRuns"),
    startedAt: v.number(),
    expiresAt: v.number(),
    lastHeartbeatAt: v.number(),
    planTier: v.optional(v.string()),
    maxConcurrentAtAcquire: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_leaseKey_expiresAt", ["leaseKey", "expiresAt"])
    .index("by_leaseKey_holderId", ["leaseKey", "holderId"])
    .index("by_scanRun_createdAt", ["scanRunId", "createdAt"]),

  discoveredPages: defineTable({
    assetId: v.id("assets"),
    pageUrl: v.string(),
    normalizedUrl: v.string(),
    discoveredAt: v.number(),
    lastScannedAt: v.optional(v.number()),
    lastScanStatus: v.optional(scanRunPageStatusValidator),
    lastFindingCount: v.optional(v.number()),
  })
    .index("by_asset_discoveredAt", ["assetId", "discoveredAt"])
    .index("by_asset_normalizedUrl", ["assetId", "normalizedUrl"]),

  externalDiscoveryJobs: defineTable({
    assetId: v.id("assets"),
    sourceUrl: v.string(),
    maxUrls: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    discoveredUrls: v.optional(v.array(v.string())),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_asset_createdAt", ["assetId", "createdAt"]),

  findings: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_scanRun_createdAt", ["scanRunId", "createdAt"])
    .index("by_scanRunPage_createdAt", ["scanRunPageId", "createdAt"])
    .index("by_asset_severity", ["assetId", "severity"])
    .index("by_asset_status", ["assetId", "status"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_assignee_status", ["assignee", "status"])
    .index("by_evidenceHash_createdAt", ["evidenceHash", "createdAt"]),

  reports: defineTable({
    assetId: v.id("assets"),
    scanRunId: v.optional(v.id("scanRuns")),
    profile: wcagProfileValidator,
    name: v.optional(v.string()),
    layout: reportLayoutValidator,
    selectedScanRunIds: v.optional(v.array(v.id("scanRuns"))),
    selectedFindingIds: v.optional(v.array(v.id("findings"))),
    selectedSeverities: v.optional(v.array(findingSeverityValidator)),
    selectedSources: v.optional(v.array(findingSourceValidator)),
    logoStorageId: v.optional(v.id("_storage")),
    companyName: v.optional(v.string()),
    footerText: v.optional(v.string()),
    baselineScanRunId: v.optional(v.id("scanRuns")),
    includeNewResolvedRegressed: v.optional(v.boolean()),
    filterSnapshotJson: v.optional(v.string()),
    formatVersion: v.number(),
    generatedBy: v.id("users"),
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
  })
    .index("by_asset_generatedAt", ["assetId", "generatedAt"])
    .index("by_scanRun", ["scanRunId"])
    .index("by_asset_updatedAt", ["assetId", "updatedAt"]),

  reportExportTemplates: defineTable({
    createdBy: v.id("users"),
    assetId: v.optional(v.id("assets")),
    name: v.string(),
    columns: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdBy_updatedAt", ["createdBy", "updatedAt"])
    .index("by_createdBy_asset_updatedAt", ["createdBy", "assetId", "updatedAt"]),
});
