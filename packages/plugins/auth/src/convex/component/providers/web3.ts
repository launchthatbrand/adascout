import type { AuthProviderConfig } from "./types";

export const buildWeb3ProviderConfig = (): AuthProviderConfig => ({
  providerKey: "web3",
  providerType: "web3",
  displayName: "Web3 Wallet",
  enabled: false,
  metadata: {
    flow: "siwe",
  },
});
