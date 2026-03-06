import { mutation, query } from "./_generated/server";

import { components } from "./_generated/api";
import { v } from "convex/values";

const providerTypeValidator = v.union(
  v.literal("password"),
  v.literal("magic_link"),
  v.literal("github"),
  v.literal("oidc"),
  v.literal("web3"),
);

export const listProviderConfigs = query({
  args: {
    enabledOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
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
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.launchthat_auth.oauth.queries.listProviderConfigs, {
      enabledOnly: args.enabledOnly,
    });
  },
});

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
    return await ctx.runMutation(components.launchthat_auth.oauth.mutations.upsertProviderConfig, {
      ...args,
    });
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
    return await ctx.runMutation(components.launchthat_auth.oauth.mutations.ensurePrimaryIdentityLinkForUser, {
      userId: args.userId,
    });
  },
});

export const seedDefaultProviderConfigs = mutation({
  args: {},
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    return await ctx.runMutation(components.launchthat_auth.oauth.mutations.seedDefaultProviderConfigs, {});
  },
});

export const backfillIdentityLinks = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.launchthat_auth.oauth.mutations.backfillIdentityLinksFromUsers, {
      limit: args.limit,
    });
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
    return await ctx.runMutation(components.launchthat_auth.oauth.mutations.purgeExpiredOauthStates, {
      limit: args.limit,
    });
  },
});
