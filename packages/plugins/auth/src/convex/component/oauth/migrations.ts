import { v } from "convex/values";

import { internalMutation } from "../server";

export const backfillIdentityLinksFromUsers = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(10_000, Number(args.limit ?? 2_000)));
    const users = await ctx.db.query("users").order("desc").take(limit);
    let created = 0;
    let updated = 0;
    const now = Date.now();

    for (const user of users) {
      const providerUserId = typeof user.email === "string" && user.email.trim() ? user.email : String(user._id);
      const existing = await (ctx.db.query("userIdentityLinks") as any)
        .withIndex("by_providerKey_and_providerUserId", (q: any) =>
          q.eq("providerKey", "password").eq("providerUserId", providerUserId),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("userIdentityLinks", {
          userId: user._id,
          providerKey: "password",
          providerUserId,
          email: typeof user.email === "string" ? user.email : undefined,
          displayName: typeof user.name === "string" ? user.name : undefined,
          metadata: {
            source: "migration",
          },
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
        continue;
      }

      if (existing.userId !== user._id || existing.email !== user.email || existing.displayName !== user.name) {
        await ctx.db.patch(existing._id, {
          userId: user._id,
          email: typeof user.email === "string" ? user.email : undefined,
          displayName: typeof user.name === "string" ? user.name : undefined,
          updatedAt: now,
        });
        updated += 1;
      }
    }

    return {
      scanned: users.length,
      created,
      updated,
    };
  },
});

export const purgeExpiredOauthStates = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    removed: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(10_000, Number(args.limit ?? 2_000)));
    const now = Date.now();
    const states = await (ctx.db.query("oauthStates") as any)
      .withIndex("by_expiresAt", (q: any) => q.lte("expiresAt", now))
      .take(limit);

    for (const state of states) {
      await ctx.db.delete(state._id);
    }

    return {
      scanned: states.length,
      removed: states.length,
    };
  },
});
