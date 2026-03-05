import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  assetKindValidator,
  assetStatusValidator,
  findingSeverityValidator,
  findingSourceValidator,
  scanRunModeValidator,
  scanRunPageStatusValidator,
  scanRunStatusValidator,
  wcagProfileValidator,
  reportLayoutValidator,
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
    status: assetStatusValidator,
    title: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    normalizedUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    filename: v.optional(v.string()),
    contentType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
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
    .index("by_createdBy_status", ["createdBy", "status"]),

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
    pageUrl: v.optional(v.string()),
    pageNumber: v.optional(v.number()),
    codeSnippet: v.optional(v.string()),
    manualReviewRequired: v.optional(v.boolean()),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_scanRun_createdAt", ["scanRunId", "createdAt"])
    .index("by_scanRunPage_createdAt", ["scanRunPageId", "createdAt"])
    .index("by_asset_severity", ["assetId", "severity"]),

  reports: defineTable({
    assetId: v.id("assets"),
    scanRunId: v.optional(v.id("scanRuns")),
    profile: wcagProfileValidator,
    name: v.optional(v.string()),
    layout: reportLayoutValidator,
    selectedScanRunIds: v.optional(v.array(v.id("scanRuns"))),
    selectedSeverities: v.optional(v.array(findingSeverityValidator)),
    selectedSources: v.optional(v.array(findingSourceValidator)),
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
});
