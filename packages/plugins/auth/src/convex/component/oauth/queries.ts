import { v } from "convex/values";

import { query } from "../server";

export const listProviderConfigs = query({
  args: {
    enabledOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      providerKey: v.string(),
      providerType: v.union(
        v.literal("password"),
        v.literal("magic_link"),
        v.literal("github"),
        v.literal("oidc"),
        v.literal("web3"),
      ),
      displayName: v.string(),
      enabled: v.boolean(),
      issuer: v.optional(v.string()),
      authorizationUrl: v.optional(v.string()),
      tokenUrl: v.optional(v.string()),
      userInfoUrl: v.optional(v.string()),
      scopes: v.optional(v.array(v.string())),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("oauthProviderConfigs").collect();
    const filtered = args.enabledOnly ? rows.filter((row) => row.enabled) : rows;
    return filtered.map((row) => ({
      providerKey: row.providerKey,
      providerType: row.providerType,
      displayName: row.displayName,
      enabled: row.enabled,
      issuer: row.issuer,
      authorizationUrl: row.authorizationUrl,
      tokenUrl: row.tokenUrl,
      userInfoUrl: row.userInfoUrl,
      scopes: row.scopes,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const getPrimaryIdentityForUser = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      providerKey: v.string(),
      providerUserId: v.string(),
      email: v.optional(v.string()),
      displayName: v.optional(v.string()),
      linkedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const existing = await (ctx.db.query("userIdentityLinks") as any)
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      return {
        providerKey: existing.providerKey,
        providerUserId: existing.providerUserId,
        email: existing.email,
        displayName: existing.displayName,
        linkedAt: existing.createdAt,
      };
    }

    // Compatibility read: derive a synthetic identity from users table until
    // a canonical identity link row is backfilled.
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const providerUserId = typeof user.email === "string" && user.email.trim() ? user.email : String(user._id);
    return {
      providerKey: "password",
      providerUserId,
      email: typeof user.email === "string" ? user.email : undefined,
      displayName: typeof user.name === "string" ? user.name : undefined,
      linkedAt: Number(user._creationTime ?? Date.now()),
    };
  },
});
