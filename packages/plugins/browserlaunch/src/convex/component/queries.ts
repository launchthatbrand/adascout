import { v } from "convex/values";
import { query } from "./server";

export const getTaskById = query({
  args: { taskId: v.id("automationTasks") },
  returns: v.union(
    v.object({
      _id: v.id("automationTasks"),
      app: v.string(),
      taskType: v.string(),
      queue: v.string(),
      status: v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("canceled"),
      ),
      payloadJson: v.string(),
      externalRef: v.optional(v.string()),
      requestedSessionId: v.optional(v.id("automationSessions")),
      sessionPolicy: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      updatedAt: v.number(),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db.get(args.taskId);
    if (!row) return null;
    return {
      _id: row._id,
      app: row.app,
      taskType: row.taskType,
      queue: row.queue,
      status: row.status,
      payloadJson: row.payloadJson,
      externalRef: row.externalRef,
      requestedSessionId: row.requestedSessionId,
      sessionPolicy: row.sessionPolicy,
      errorMessage: row.errorMessage,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  },
});

export const listRunsForApp = query({
  args: { app: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("automationRuns"),
      taskId: v.optional(v.id("automationTasks")),
      taskType: v.string(),
      status: v.union(
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("canceled"),
      ),
      externalRef: v.optional(v.string()),
      summary: v.optional(v.string()),
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx: any, args: any) => {
    const rows = await ctx.db
      .query("automationRuns")
      .withIndex("by_app_createdAt", (q: any) => q.eq("app", args.app))
      .order("desc")
      .take(Math.max(1, Math.min(100, Number(args.limit ?? 20))));
    return rows.map((row: any) => ({
      _id: row._id,
      taskId: row.taskId,
      taskType: row.taskType,
      status: row.status,
      externalRef: row.externalRef,
      summary: row.summary,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      createdAt: row.createdAt,
    }));
  },
});

export const listRunSteps = query({
  args: { runId: v.id("automationRuns"), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("automationRunSteps"),
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
      screenshotUrl: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx: any, args: any) => {
    const rows = await ctx.db
      .query("automationRunSteps")
      .withIndex("by_run_seq", (q: any) => q.eq("runId", args.runId))
      .order("asc")
      .take(Math.max(1, Math.min(500, Number(args.limit ?? 200))));
    const result: Array<any> = [];
    for (const row of rows) {
      const screenshotUrl = row.screenshotStorageId
        ? await ctx.storage.getUrl(row.screenshotStorageId)
        : undefined;
      result.push({
        _id: row._id,
        seq: row.seq,
        kind: row.kind,
        status: row.status,
        label: row.label,
        url: row.url,
        selector: row.selector,
        inputSummary: row.inputSummary,
        resultSummary: row.resultSummary,
        errorMessage: row.errorMessage,
        screenshotStorageId: row.screenshotStorageId,
        screenshotUrl,
        createdAt: row.createdAt,
      });
    }
    return result;
  },
});

export const getSessionByAccount = query({
  args: {
    app: v.string(),
    provider: v.string(),
    accountKey: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("automationSessions"),
      status: v.union(
        v.literal("active"),
        v.literal("reauth_required"),
        v.literal("expired"),
        v.literal("revoked"),
      ),
      storageStateStorageId: v.optional(v.id("_storage")),
      storageStateUrl: v.optional(v.string()),
      proxyProfileId: v.optional(v.string()),
      fingerprintProfileId: v.optional(v.string()),
      lastValidatedAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx: any, args: any) => {
    const row = await ctx.db
      .query("automationSessions")
      .withIndex("by_app_provider_accountKey", (q: any) =>
        q.eq("app", args.app).eq("provider", args.provider).eq("accountKey", args.accountKey),
      )
      .first();
    if (!row) return null;
    return {
      _id: row._id,
      status: row.status,
      storageStateStorageId: row.storageStateStorageId,
      storageStateUrl: row.storageStateStorageId
        ? await ctx.storage.getUrl(row.storageStateStorageId)
        : undefined,
      proxyProfileId: row.proxyProfileId,
      fingerprintProfileId: row.fingerprintProfileId,
      lastValidatedAt: row.lastValidatedAt,
      expiresAt: row.expiresAt,
      updatedAt: row.updatedAt,
    };
  },
});

export const getOpsSummary = query({
  args: {
    app: v.string(),
  },
  returns: v.object({
    queuedTasks: v.number(),
    runningTasks: v.number(),
    failedTasks: v.number(),
    completedTasks: v.number(),
    activeSessions: v.number(),
    reauthSessions: v.number(),
  }),
  handler: async (ctx: any, args: any) => {
    const rows = await ctx.db
      .query("automationTasks")
      .withIndex("by_app_status_createdAt", (q: any) =>
        q.eq("app", args.app).eq("status", "queued"),
      )
      .take(10_000);
    const running = await ctx.db
      .query("automationTasks")
      .withIndex("by_app_status_createdAt", (q: any) =>
        q.eq("app", args.app).eq("status", "running"),
      )
      .take(10_000);
    const failed = await ctx.db
      .query("automationTasks")
      .withIndex("by_app_status_createdAt", (q: any) =>
        q.eq("app", args.app).eq("status", "failed"),
      )
      .take(10_000);
    const completed = await ctx.db
      .query("automationTasks")
      .withIndex("by_app_status_createdAt", (q: any) =>
        q.eq("app", args.app).eq("status", "completed"),
      )
      .take(10_000);
    const sessions = await ctx.db
      .query("automationSessions")
      .withIndex("by_app_userKey_createdAt", (q: any) => q.eq("app", args.app))
      .take(10_000);
    return {
      queuedTasks: rows.length,
      runningTasks: running.length,
      failedTasks: failed.length,
      completedTasks: completed.length,
      activeSessions: sessions.filter((s: any) => s.status === "active").length,
      reauthSessions: sessions.filter((s: any) => s.status === "reauth_required")
        .length,
    };
  },
});

