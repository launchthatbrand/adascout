import type { AuthProviderConfig } from "./types";

export const buildGithubProviderConfig = (): AuthProviderConfig => ({
  providerKey: "github",
  providerType: "github",
  displayName: "GitHub",
  enabled: process.env.AUTH_GITHUB_ID !== undefined && process.env.AUTH_GITHUB_SECRET !== undefined,
  authorizationUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  userInfoUrl: "https://api.github.com/user",
  scopes: ["read:user", "user:email"],
});
