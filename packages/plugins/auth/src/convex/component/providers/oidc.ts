import type { AuthProviderConfig } from "./types";

type OidcProviderConfigInput = {
  providerKey: string;
  displayName: string;
  issuer?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: Array<string>;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
};

export const buildOidcProviderConfig = (input: OidcProviderConfigInput): AuthProviderConfig => ({
  providerKey: input.providerKey,
  providerType: "oidc",
  displayName: input.displayName,
  enabled: input.enabled ?? true,
  issuer: input.issuer,
  authorizationUrl: input.authorizationUrl,
  tokenUrl: input.tokenUrl,
  userInfoUrl: input.userInfoUrl,
  scopes: input.scopes,
  metadata: input.metadata,
});
