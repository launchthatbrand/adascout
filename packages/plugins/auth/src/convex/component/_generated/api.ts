/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as index from "../index.js";
import type * as oauth_actions from "../oauth/actions.js";
import type * as oauth_migrations from "../oauth/migrations.js";
import type * as oauth_mutations from "../oauth/mutations.js";
import type * as oauth_queries from "../oauth/queries.js";
import type * as providers_github from "../providers/github.js";
import type * as providers_magicLink from "../providers/magicLink.js";
import type * as providers_oidc from "../providers/oidc.js";
import type * as providers_password from "../providers/password.js";
import type * as providers_types from "../providers/types.js";
import type * as providers_web3 from "../providers/web3.js";
import type * as server from "../server.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  auth: typeof auth;
  index: typeof index;
  "oauth/actions": typeof oauth_actions;
  "oauth/migrations": typeof oauth_migrations;
  "oauth/mutations": typeof oauth_mutations;
  "oauth/queries": typeof oauth_queries;
  "providers/github": typeof providers_github;
  "providers/magicLink": typeof providers_magicLink;
  "providers/oidc": typeof providers_oidc;
  "providers/password": typeof providers_password;
  "providers/types": typeof providers_types;
  "providers/web3": typeof providers_web3;
  server: typeof server;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
