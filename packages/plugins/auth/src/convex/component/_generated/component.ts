/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    auth: {
      isAuthenticated: FunctionReference<"query", "internal", {}, any, Name>;
      signIn: FunctionReference<
        "action",
        "internal",
        {
          calledBy?: string;
          params?: any;
          provider?: string;
          refreshToken?: string;
          verifier?: string;
        },
        any,
        Name
      >;
      signOut: FunctionReference<"action", "internal", {}, any, Name>;
    };
    index: {
      isAuthenticated: FunctionReference<"query", "internal", {}, any, Name>;
      signIn: FunctionReference<
        "action",
        "internal",
        {
          calledBy?: string;
          params?: any;
          provider?: string;
          refreshToken?: string;
          verifier?: string;
        },
        any,
        Name
      >;
      signOut: FunctionReference<"action", "internal", {}, any, Name>;
    };
    oauth: {
      actions: {
        bootstrapProviders: FunctionReference<
          "action",
          "internal",
          {},
          { ok: boolean },
          Name
        >;
      };
      mutations: {
        backfillIdentityLinksFromUsers: FunctionReference<
          "mutation",
          "internal",
          { limit?: number },
          { created: number; scanned: number; updated: number },
          Name
        >;
        ensurePrimaryIdentityLinkForUser: FunctionReference<
          "mutation",
          "internal",
          { userId: string },
          { created: boolean; providerKey: string; providerUserId: string },
          Name
        >;
        purgeExpiredOauthStates: FunctionReference<
          "mutation",
          "internal",
          { limit?: number },
          { removed: number; scanned: number },
          Name
        >;
        seedDefaultProviderConfigs: FunctionReference<
          "mutation",
          "internal",
          {},
          { inserted: number; updated: number },
          Name
        >;
        upsertProviderConfig: FunctionReference<
          "mutation",
          "internal",
          {
            authorizationUrl?: string;
            displayName: string;
            enabled: boolean;
            issuer?: string;
            metadata?: any;
            providerKey: string;
            providerType:
              | "password"
              | "magic_link"
              | "github"
              | "oidc"
              | "web3";
            scopes?: Array<string>;
            tokenUrl?: string;
            userInfoUrl?: string;
          },
          { providerKey: string },
          Name
        >;
      };
      queries: {
        getPrimaryIdentityForUser: FunctionReference<
          "query",
          "internal",
          { userId: string },
          null | {
            displayName?: string;
            email?: string;
            linkedAt: number;
            providerKey: string;
            providerUserId: string;
          },
          Name
        >;
        listProviderConfigs: FunctionReference<
          "query",
          "internal",
          { enabledOnly?: boolean },
          Array<{
            authorizationUrl?: string;
            createdAt: number;
            displayName: string;
            enabled: boolean;
            issuer?: string;
            metadata?: any;
            providerKey: string;
            providerType:
              | "password"
              | "magic_link"
              | "github"
              | "oidc"
              | "web3";
            scopes?: Array<string>;
            tokenUrl?: string;
            updatedAt: number;
            userInfoUrl?: string;
          }>,
          Name
        >;
      };
    };
  };
