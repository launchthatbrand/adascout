import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const taskStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled"),
);

const runStatusValidator = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled"),
);

const sessionStatusValidator = v.union(
  v.literal("active"),
  v.literal("reauth_required"),
  v.literal("expired"),
  v.literal("revoked"),
);

const artifactKindValidator = v.union(
  v.literal("screenshot"),
  v.literal("log"),
  v.literal("state"),
  v.literal("other"),
);

export default defineSchema({
  automationTasks: defineTable({
    app: v.string(),
    taskType: v.string(),
    queue: v.string(),
    status: taskStatusValidator,
    payloadJson: v.string(),
    externalRef: v.optional(v.string()),
    priority: v.optional(v.number()),
    sessionPolicy: v.optional(v.string()),
    requestedSessionId: v.optional(v.id("automationSessions")),
    claimedBy: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    attempts: v.number(),
    maxAttempts: v.number(),
    enqueuedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_queue_status_createdAt", ["queue", "status", "createdAt"])
    .index("by_app_status_createdAt", ["app", "status", "createdAt"]),

  automationRuns: defineTable({
    app: v.string(),
    taskType: v.string(),
    taskId: v.optional(v.id("automationTasks")),
    externalRef: v.optional(v.string()),
    status: runStatusValidator,
    workerId: v.optional(v.string()),
    sessionId: v.optional(v.id("automationSessions")),
    summary: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_createdAt", ["app", "createdAt"])
    .index("by_app_externalRef", ["app", "externalRef"])
    .index("by_taskId", ["taskId"]),

  automationRunSteps: defineTable({
    runId: v.id("automationRuns"),
    seq: v.number(),
    kind: v.string(),
    status: v.optional(v.string()),
    label: v.optional(v.string()),
    url: v.optional(v.string()),
    selector: v.optional(v.string()),
    inputSummary: v.optional(v.string()),
    resultSummary: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    screenshotStorageId: v.optional(v.id("_storage")),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_run_seq", ["runId", "seq"]),

  automationRunArtifacts: defineTable({
    runId: v.id("automationRuns"),
    kind: artifactKindValidator,
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    stepSeq: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_run_createdAt", ["runId", "createdAt"]),

  automationSessions: defineTable({
    app: v.string(),
    provider: v.string(),
    accountKey: v.string(),
    userKey: v.optional(v.string()),
    status: sessionStatusValidator,
    storageStateStorageId: v.optional(v.id("_storage")),
    proxyProfileId: v.optional(v.string()),
    fingerprintProfileId: v.optional(v.string()),
    notes: v.optional(v.string()),
    lastValidatedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_app_provider_accountKey", ["app", "provider", "accountKey"])
    .index("by_app_userKey_createdAt", ["app", "userKey", "createdAt"]),

  automationWakeSignals: defineTable({
    channel: v.string(),
    lastSignaledAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_channel", ["channel"]),
});

