/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as findings from "../findings.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as httpActions from "../httpActions.js";
import type * as migrations from "../migrations.js";
import type * as mondayConnector from "../mondayConnector.js";
import type * as playwrightSmoke from "../playwrightSmoke.js";
import type * as pluginAuth from "../pluginAuth.js";
import type * as remediation from "../remediation.js";
import type * as reports from "../reports.js";
import type * as scanRunner from "../scanRunner.js";
import type * as scanTypes from "../scanTypes.js";
import type * as scans from "../scans.js";
import type * as stagehandSdkScan from "../stagehandSdkScan.js";
import type * as viewer from "../viewer.js";
import type * as websiteScanWorkflow from "../websiteScanWorkflow.js";
import type * as workflow from "../workflow.js";
import type * as workflows from "../workflows.js";
import type * as wpConnector from "../wpConnector.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assets: typeof assets;
  auth: typeof auth;
  findings: typeof findings;
  helpers: typeof helpers;
  http: typeof http;
  httpActions: typeof httpActions;
  migrations: typeof migrations;
  mondayConnector: typeof mondayConnector;
  playwrightSmoke: typeof playwrightSmoke;
  pluginAuth: typeof pluginAuth;
  remediation: typeof remediation;
  reports: typeof reports;
  scanRunner: typeof scanRunner;
  scanTypes: typeof scanTypes;
  scans: typeof scans;
  stagehandSdkScan: typeof stagehandSdkScan;
  viewer: typeof viewer;
  websiteScanWorkflow: typeof websiteScanWorkflow;
  workflow: typeof workflow;
  workflows: typeof workflows;
  wpConnector: typeof wpConnector;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  launchthat_auth: import("launchthat-plugin-auth/convex/component/_generated/component.js").ComponentApi<"launchthat_auth">;
  launchthat_browserlaunch: import("launchthat-plugin-browserlaunch/convex/component/_generated/component.js").ComponentApi<"launchthat_browserlaunch">;
  stagehand: import("../stagehand/_generated/component.js").ComponentApi<"stagehand">;
};
