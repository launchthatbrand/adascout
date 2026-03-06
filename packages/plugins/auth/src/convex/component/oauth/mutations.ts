import { v } from "convex/values";

import { mutation } from "../server";
import { providerDefaults } from "../auth";

const providerTypeValidator = v.union(
  v.literal("password"),
  v.literal("magic_link"),
  v.literal("github"),
  v.literal("oidc"),
  v.literal("web3"),
);

export const upsertProviderConfig = mutation({
  args: {
    providerKey: v.string(),
    providerType: providerTypeValidator,
    displayName: v.string(),
    enabled: v.boolean(),
    issuer: v.optional(v.string()),
    authorizationUrl: v.optional(v.string()),
    tokenUrl: v.optional(v.string()),
    userInfoUrl: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
  },
  returns: v.object({ providerKey: v.string() }),
  handler: async (ctx, args) => {
    const existing = await (ctx.db.query("oauthProviderConfigs") as any)
      .withIndex("by_providerKey", (q: any) => q.eq("providerKey", args.providerKey))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        providerType: args.providerType,
        displayName: args.displayName,
        enabled: args.enabled,
        issuer: args.issuer,
        authorizationUrl: args.authorizationUrl,
        tokenUrl: args.tokenUrl,
        userInfoUrl: args.userInfoUrl,
        scopes: args.scopes,
        metadata: args.metadata,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("oauthProviderConfigs", {
        providerKey: args.providerKey,
        providerType: args.providerType,
        displayName: args.displayName,
        enabled: args.enabled,
        issuer: args.issuer,
        authorizationUrl: args.authorizationUrl,
        tokenUrl: args.tokenUrl,
        userInfoUrl: args.userInfoUrl,
        scopes: args.scopes,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { providerKey: args.providerKey };
  },
});

export const seedDefaultProviderConfigs = mutation({
  args: {},
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    const now = Date.now();

    for (const provider of providerDefaults) {
      const existing = await (ctx.db.query("oauthProviderConfigs") as any)
        .withIndex("by_providerKey", (q: any) => q.eq("providerKey", provider.providerKey))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          providerType: provider.providerType,
          displayName: provider.displayName,
          enabled: provider.enabled,
          issuer: provider.issuer,
          authorizationUrl: provider.authorizationUrl,
          tokenUrl: provider.tokenUrl,
          userInfoUrl: provider.userInfoUrl,
          scopes: provider.scopes,
          metadata: provider.metadata,
          updatedAt: now,
        });
        updated += 1;
      } else {
        await ctx.db.insert("oauthProviderConfigs", {
          providerKey: provider.providerKey,
          providerType: provider.providerType,
          displayName: provider.displayName,
          enabled: provider.enabled,
          issuer: provider.issuer,
          authorizationUrl: provider.authorizationUrl,
          tokenUrl: provider.tokenUrl,
          userInfoUrl: provider.userInfoUrl,
          scopes: provider.scopes,
          metadata: provider.metadata,
          createdAt: now,
          updatedAt: now,
        });
        inserted += 1;
      }
    }

    return { inserted, updated };
  },
});

export const ensurePrimaryIdentityLinkForUser = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    providerKey: v.string(),
    providerUserId: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await (ctx.db.query("userIdentityLinks") as any)
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      return {
        providerKey: existing.providerKey,
        providerUserId: existing.providerUserId,
        created: false,
      };
    }

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    const now = Date.now();
    const providerUserId = typeof user.email === "string" && user.email.trim() ? user.email : String(user._id);
    await ctx.db.insert("userIdentityLinks", {
      userId: user._id,
      providerKey: "password",
      providerUserId,
      email: typeof user.email === "string" ? user.email : undefined,
      displayName: typeof user.name === "string" ? user.name : undefined,
      metadata: {
        source: "ensure_primary_identity",
      },
      createdAt: now,
      updatedAt: now,
    });
    return {
      providerKey: "password",
      providerUserId,
      created: true,
    };
  },
});

export const backfillIdentityLinksFromUsers = mutation({
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

export const purgeExpiredOauthStates = mutation({
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
