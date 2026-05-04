import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const oauthProviderTypeValidator = v.union(
  v.literal("password"),
  v.literal("magic_link"),
  v.literal("github"),
  v.literal("oidc"),
  v.literal("web3"),
);

const oauthConnectionStatusValidator = v.union(
  v.literal("active"),
  v.literal("revoked"),
  v.literal("expired"),
  v.literal("error"),
);

export default defineSchema({
  ...authTables,

  oauthProviderConfigs: defineTable({
    providerKey: v.string(),
    providerType: oauthProviderTypeValidator,
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
  })
    .index("by_providerKey", ["providerKey"])
    .index("by_enabled", ["enabled"]),

  userIdentityLinks: defineTable({
    userId: v.id("users"),
    providerKey: v.string(),
    providerUserId: v.string(),
    email: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
    displayName: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_providerKey_and_providerUserId", ["providerKey", "providerUserId"])
    .index("by_providerKey_and_userId", ["providerKey", "userId"]),

  oauthStates: defineTable({
    state: v.string(),
    providerKey: v.string(),
    userId: v.optional(v.id("users")),
    codeVerifier: v.optional(v.string()),
    returnTo: v.string(),
    flow: v.union(v.literal("sign_in"), v.literal("link_identity")),
    expiresAt: v.number(),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_state", ["state"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_providerKey_and_createdAt", ["providerKey", "createdAt"]),

  oauthConnections: defineTable({
    userId: v.id("users"),
    providerKey: v.string(),
    providerUserId: v.string(),
    status: oauthConnectionStatusValidator,
    tokenType: v.optional(v.string()),
    accessTokenEncrypted: v.optional(v.string()),
    refreshTokenEncrypted: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastVerifiedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_providerKey_and_providerUserId", ["providerKey", "providerUserId"])
    .index("by_userId_and_providerKey", ["userId", "providerKey"])
    .index("by_status", ["status"]),
});
