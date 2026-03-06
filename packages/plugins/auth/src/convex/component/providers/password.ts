import type { AuthProviderConfig } from "./types";

export const buildPasswordProviderConfig = (): AuthProviderConfig => ({
  providerKey: "password",
  providerType: "password",
  displayName: "Password",
  enabled: true,
});
