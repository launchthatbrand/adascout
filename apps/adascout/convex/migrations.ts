import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const computeEvidenceHash = (args: {
  source: string;
  ruleId: string;
  target?: string;
  pageUrl?: string;
  codeSnippet?: string;
}) =>
  [
    args.source,
    args.ruleId,
    args.target ?? "",
    args.pageUrl ?? "",
    args.codeSnippet ?? "",
  ]
    .join("|")
    .toLowerCase();

export const backfillFindingLifecycleDefaults = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(10_000, Number(args.limit ?? 2000)));
    const rows = await ctx.db.query("findings").order("desc").take(limit);
    let patched = 0;
    const now = Date.now();

    for (const row of rows) {
      const shouldPatchLifecycle = !row.status || !row.lastStateChangeAt || !row.capturedAt;
      const shouldPatchEvidence = !row.evidenceHash;
      if (!shouldPatchLifecycle && !shouldPatchEvidence) continue;
      await ctx.db.patch(row._id, {
        ...(shouldPatchLifecycle
          ? {
            status: row.status ?? "open",
            lastStateChangeAt: row.lastStateChangeAt ?? now,
            capturedAt: row.capturedAt ?? row.createdAt,
          }
          : {}),
        ...(shouldPatchEvidence
          ? {
            evidenceHash: computeEvidenceHash({
              source: row.source,
              ruleId: row.ruleId,
              target: row.target,
              pageUrl: row.pageUrl,
              codeSnippet: row.codeSnippet,
            }),
            selectorSnapshot: row.selectorSnapshot ?? row.target,
            domSnippet: row.domSnippet ?? row.codeSnippet,
          }
          : {}),
      });
      patched += 1;
    }

    return {
      scanned: rows.length,
      patched,
    };
  },
});
