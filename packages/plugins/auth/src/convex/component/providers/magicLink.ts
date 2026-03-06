import type { AuthProviderConfig } from "./types";

export const buildMagicLinkProviderConfig = (): AuthProviderConfig => ({
  providerKey: "magic_link",
  providerType: "magic_link",
  displayName: "Magic Link",
  enabled: process.env.AUTH_ENABLE_MAGIC_LINK === "true",
  metadata: {
    delivery: "email",
    envFlag: "AUTH_ENABLE_MAGIC_LINK",
  },
});
