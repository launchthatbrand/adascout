export type AuthProviderType = "password" | "magic_link" | "github" | "oidc" | "web3";

export type AuthProviderConfig = {
  providerKey: string;
  providerType: AuthProviderType;
  displayName: string;
  enabled: boolean;
  issuer?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: Array<string>;
  metadata?: Record<string, unknown>;
};
