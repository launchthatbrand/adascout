import { v } from "convex/values";
import { mutation } from "./server";

const nowMs = () => Date.now();

export const enqueueTask = mutation({
  args: {
    app: v.string(),
    taskType: v.string(),
    queue: v.optional(v.string()),
    payloadJson: v.string(),
    externalRef: v.optional(v.string()),
    priority: v.optional(v.number()),
    sessionPolicy: v.optional(v.string()),
    requestedSessionId: v.optional(v.id("automationSessions")),
    maxAttempts: v.optional(v.number()),
  },
  returns: v.id("automationTasks"),
  handler: async (ctx: any, args: any) => {
    const now = nowMs();
    return await ctx.db.insert("automationTasks", {
      app: args.app,
      taskType: args.taskType,
      queue: String(args.queue ?? "default"),
      status: "queued",
      payloadJson: args.payloadJson,
      externalRef: args.externalRef,
      priority: args.priority,
      sessionPolicy: args.sessionPolicy,
      requestedSessionId: args.requestedSessionId,
      attempts: 0,
      maxAttempts: Math.max(1, Number(args.maxAttempts ?? 3)),
      enqueuedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const claimNextTask = mutation({
  args: {
    workerId: v.string(),
    queue: v.optional(v.string()),
    app: v.optional(v.string()),
    leaseMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      taskId: v.id("automationTasks"),
      runId: v.id("automationRuns"),
      app: v.string(),
      taskType: v.string(),
      payloadJson: v.string(),
      externalRef: v.optional(v.string()),
      requestedSessionId: v.optional(v.id("automationSessions")),
      sessionPolicy: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx: any, args: any) => {
    const queue = String(args.queue ?? "default");
    const leaseMs = Math.max(10_000, Number(args.leaseMs ?? 120_000));
    const rows = await ctx.db
      .query("automationTasks")
      .withIndex("by_queue_status_createdAt", (q: any) =>
        q.eq("queue", queue).eq("status", "queued"),
      )
      .order("asc")
      .take(50);
    const target = (rows as Array<any>).find((row) =>
      args.app ? row.app === args.app : true,
    );
    if (!target) return null;
    const now = nowMs();
    await ctx.db.patch(target._id, {
      status: "running",
      claimedBy: args.workerId,
      leaseExpiresAt: now + leaseMs,
      attempts: Number(target.attempts ?? 0) + 1,
      startedAt: target.startedAt ?? now,
      updatedAt: now,
    });
    const runId = await ctx.db.insert("automationRuns", {
      app: target.app,
      taskType: target.taskType,
      taskId: target._id,
      externalRef: target.externalRef,
      status: "running",
      workerId: args.workerId,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return {
      taskId: target._id,
      runId,
      app: target.app,
      taskType: target.taskType,
      payloadJson: target.payloadJson,
      externalRef: target.externalRef,
      requestedSessionId: target.requestedSessionId,
      sessionPolicy: target.sessionPolicy,
    };
  },
});

export const heartbeatLease = mutation({
  args: {
    taskId: v.id("automationTasks"),
    workerId: v.string(),
    leaseMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.taskId);
    if (!row || row.status !== "running") return false;
    if (row.claimedBy !== args.workerId) return false;
    const now = nowMs();
    await ctx.db.patch(args.taskId, {
      leaseExpiresAt: now + Math.max(10_000, Number(args.leaseMs ?? 120_000)),
      updatedAt: now,
    });
    return true;
  },
});

export const completeTask = mutation({
  args: {
    taskId: v.id("automationTasks"),
    runId: v.optional(v.id("automationRuns")),
    summary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx: any, args: any) => {
    const now = nowMs();
    await ctx.db.patch(args.taskId, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
      errorMessage: undefined,
    });
    if (args.runId) {
      await ctx.db.patch(args.runId, {
        status: "completed",
        summary: args.summary,
        endedAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const failTask = mutation({
  args: {
    taskId: v.id("automationTasks"),
    runId: v.optional(v.id("automationRuns")),
    errorMessage: v.string(),
    retryable: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) return null;
    const now = nowMs();
    const canRetry =
      Boolean(args.retryable) &&
      Number(row.attempts ?? 0) < Number(row.maxAttempts ?? 1);
    await ctx.db.patch(args.taskId, {
      status: canRetry ? "queued" : "failed",
      claimedBy: canRetry ? undefined : row.claimedBy,
      leaseExpiresAt: canRetry ? undefined : row.leaseExpiresAt,
      failedAt: canRetry ? undefined : now,
      updatedAt: now,
      errorMessage: args.errorMessage.slice(0, 2_000),
    });
    if (args.runId) {
      await ctx.db.patch(args.runId, {
        status: "failed",
        summary: args.errorMessage.slice(0, 2_000),
        endedAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const upsertRunForExternalRef = mutation({
  args: {
    app: v.string(),
    externalRef: v.string(),
    taskType: v.string(),
    workerId: v.optional(v.string()),
    sessionId: v.optional(v.id("automationSessions")),
  },
  returns: v.id("automationRuns"),
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("automationRuns")
      .withIndex("by_app_externalRef", (q: any) =>
        q.eq("app", args.app).eq("externalRef", args.externalRef),
      )
      .first();
    const now = nowMs();
    if (existing) {
      await ctx.db.patch(existing._id, {
        workerId: args.workerId ?? existing.workerId,
        sessionId: args.sessionId ?? existing.sessionId,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("automationRuns", {
      app: args.app,
      taskType: args.taskType,
      externalRef: args.externalRef,
      status: "running",
      workerId: args.workerId,
      sessionId: args.sessionId,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const appendRunStep = mutation({
  args: {
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
  },
  returns: v.id("automationRunSteps"),
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("automationRunSteps", {
      ...args,
      createdAt: nowMs(),
    });
  },
});

export const createRunArtifact = mutation({
  args: {
    runId: v.id("automationRuns"),
    kind: v.union(
      v.literal("screenshot"),
      v.literal("log"),
      v.literal("state"),
      v.literal("other"),
    ),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    stepSeq: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
  },
  returns: v.id("automationRunArtifacts"),
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("automationRunArtifacts", {
      ...args,
      createdAt: nowMs(),
    });
  },
});

export const upsertSession = mutation({
  args: {
    app: v.string(),
    provider: v.string(),
    accountKey: v.string(),
    userKey: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("reauth_required"),
        v.literal("expired"),
        v.literal("revoked"),
      ),
    ),
    proxyProfileId: v.optional(v.string()),
    fingerprintProfileId: v.optional(v.string()),
    notes: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("automationSessions"),
  handler: async (ctx: any, args: any) => {
    const now = nowMs();
    const existing = await ctx.db
      .query("automationSessions")
      .withIndex("by_app_provider_accountKey", (q: any) =>
        q.eq("app", args.app).eq("provider", args.provider).eq("accountKey", args.accountKey),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userKey: args.userKey ?? existing.userKey,
        status: args.status ?? existing.status,
        proxyProfileId: args.proxyProfileId ?? existing.proxyProfileId,
        fingerprintProfileId:
          args.fingerprintProfileId ?? existing.fingerprintProfileId,
        notes: args.notes ?? existing.notes,
        expiresAt: args.expiresAt ?? existing.expiresAt,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("automationSessions", {
      app: args.app,
      provider: args.provider,
      accountKey: args.accountKey,
      userKey: args.userKey,
      status: args.status ?? "active",
      proxyProfileId: args.proxyProfileId,
      fingerprintProfileId: args.fingerprintProfileId,
      notes: args.notes,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveSessionState = mutation({
  args: {
    sessionId: v.id("automationSessions"),
    storageStateStorageId: v.id("_storage"),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("reauth_required"),
        v.literal("expired"),
        v.literal("revoked"),
      ),
    ),
    expiresAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.sessionId, {
      storageStateStorageId: args.storageStateStorageId,
      status: args.status ?? "active",
      lastValidatedAt: nowMs(),
      expiresAt: args.expiresAt,
      updatedAt: nowMs(),
    });
    return null;
  },
});

export const touchWakeSignal = mutation({
  args: {
    channel: v.string(),
    debounceMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx: any, args: any) => {
    const now = nowMs();
    const debounceMs = Math.max(0, Number(args.debounceMs ?? 1_000));
    const existing = await ctx.db
      .query("automationWakeSignals")
      .withIndex("by_channel", (q: any) => q.eq("channel", args.channel))
      .first();
    if (existing && now - existing.lastSignaledAt < debounceMs) {
      return false;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSignaledAt: now,
        updatedAt: now,
      });
      return true;
    }
    await ctx.db.insert("automationWakeSignals", {
      channel: args.channel,
      lastSignaledAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return true;
  },
});

