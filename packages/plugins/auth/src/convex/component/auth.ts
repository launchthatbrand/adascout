import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";

import { buildGithubProviderConfig } from "./providers/github";
import { buildMagicLinkProviderConfig } from "./providers/magicLink";
import { buildOidcProviderConfig } from "./providers/oidc";
import { buildPasswordProviderConfig } from "./providers/password";
import { buildWeb3ProviderConfig } from "./providers/web3";

const passwordProvider = Password({
  profile(params) {
    const email = typeof params.email === "string" ? params.email : "";
    const name = typeof params.name === "string" ? params.name : undefined;
    return {
      email,
      ...(name?.trim() ? { name: name.trim() } : {}),
    };
  },
});

const shouldEnableMagicLink = process.env.AUTH_ENABLE_MAGIC_LINK === "true";
const magicLinkProvider = shouldEnableMagicLink
  ? Email({
      authorize: undefined,
      async sendVerificationRequest({ identifier, url }) {
        console.info(
          JSON.stringify({
            service: "launchthat-plugin-auth",
            event: "magic_link_requested",
            identifier,
            url,
          }),
        );
      },
    })
  : null;

const providers = magicLinkProvider ? [passwordProvider, magicLinkProvider] : [passwordProvider];

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
});

export const providerDefaults = [
  buildPasswordProviderConfig(),
  buildMagicLinkProviderConfig(),
  buildGithubProviderConfig(),
  buildOidcProviderConfig({
    providerKey: "oidc_custom",
    displayName: "Custom OIDC",
  }),
  buildWeb3ProviderConfig(),
] as const;
