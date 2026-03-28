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
  workflow: {
    event: {
      create: FunctionReference<
        "mutation",
        "internal",
        { name: string; workflowId: string },
        string
      >;
      send: FunctionReference<
        "mutation",
        "internal",
        {
          eventId?: string;
          name?: string;
          result:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId?: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        string
      >;
    };
    journal: {
      load: FunctionReference<
        "query",
        "internal",
        { shortCircuit?: boolean; workflowId: string },
        {
          blocked?: boolean;
          journalEntries: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          ok: boolean;
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      startSteps: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          steps: Array<{
            retry?:
              | boolean
              | { base: number; initialBackoffMs: number; maxAttempts: number };
            schedulerOptions?: { runAt?: number } | { runAfter?: number };
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
          }>;
          workflowId: string;
          workpoolOptions?: {
            defaultRetryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            logLevel?: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism?: number;
            retryActionsByDefault?: boolean;
          };
        },
        Array<{
          _creationTime: number;
          _id: string;
          step:
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                functionType: "query" | "mutation" | "action";
                handle: string;
                inProgress: boolean;
                kind?: "function";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workId?: string;
              }
            | {
                args: any;
                argsSize: number;
                completedAt?: number;
                handle: string;
                inProgress: boolean;
                kind: "workflow";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
                workflowId?: string;
              }
            | {
                args: { eventId?: string };
                argsSize: number;
                completedAt?: number;
                eventId?: string;
                inProgress: boolean;
                kind: "event";
                name: string;
                runResult?:
                  | { kind: "success"; returnValue: any }
                  | { error: string; kind: "failed" }
                  | { kind: "canceled" };
                startedAt: number;
              };
          stepNumber: number;
          workflowId: string;
        }>
      >;
    };
    workflow: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { workflowId: string },
        null
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { force?: boolean; workflowId: string },
        boolean
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          generationNumber: number;
          runResult:
            | { kind: "success"; returnValue: any }
            | { error: string; kind: "failed" }
            | { kind: "canceled" };
          workflowId: string;
        },
        null
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          maxParallelism?: number;
          onComplete?: { context?: any; fnHandle: string };
          startAsync?: boolean;
          workflowArgs: any;
          workflowHandle: string;
          workflowName: string;
        },
        string
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { workflowId: string },
        {
          inProgress: Array<{
            _creationTime: number;
            _id: string;
            step:
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  functionType: "query" | "mutation" | "action";
                  handle: string;
                  inProgress: boolean;
                  kind?: "function";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workId?: string;
                }
              | {
                  args: any;
                  argsSize: number;
                  completedAt?: number;
                  handle: string;
                  inProgress: boolean;
                  kind: "workflow";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                  workflowId?: string;
                }
              | {
                  args: { eventId?: string };
                  argsSize: number;
                  completedAt?: number;
                  eventId?: string;
                  inProgress: boolean;
                  kind: "event";
                  name: string;
                  runResult?:
                    | { kind: "success"; returnValue: any }
                    | { error: string; kind: "failed" }
                    | { kind: "canceled" };
                  startedAt: number;
                };
            stepNumber: number;
            workflowId: string;
          }>;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
          workflow: {
            _creationTime: number;
            _id: string;
            args: any;
            generationNumber: number;
            logLevel?: any;
            name?: string;
            onComplete?: { context?: any; fnHandle: string };
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt?: any;
            state?: any;
            workflowHandle: string;
          };
        }
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listByName: FunctionReference<
        "query",
        "internal",
        {
          name: string;
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            context?: any;
            name?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listSteps: FunctionReference<
        "query",
        "internal",
        {
          order: "asc" | "desc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          workflowId: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            args: any;
            completedAt?: number;
            eventId?: string;
            kind: "function" | "workflow" | "event";
            name: string;
            nestedWorkflowId?: string;
            runResult?:
              | { kind: "success"; returnValue: any }
              | { error: string; kind: "failed" }
              | { kind: "canceled" };
            startedAt: number;
            stepId: string;
            stepNumber: number;
            workId?: string;
            workflowId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      restart: FunctionReference<
        "mutation",
        "internal",
        { from?: number | string; startAsync?: boolean; workflowId: string },
        null
      >;
    };
  };
  launchthat_auth: {
    auth: {
      isAuthenticated: FunctionReference<"query", "internal", {}, any>;
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
        any
      >;
      signOut: FunctionReference<"action", "internal", {}, any>;
    };
    index: {
      isAuthenticated: FunctionReference<"query", "internal", {}, any>;
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
        any
      >;
      signOut: FunctionReference<"action", "internal", {}, any>;
    };
    oauth: {
      actions: {
        bootstrapProviders: FunctionReference<
          "action",
          "internal",
          {},
          { ok: boolean }
        >;
      };
      mutations: {
        backfillIdentityLinksFromUsers: FunctionReference<
          "mutation",
          "internal",
          { limit?: number },
          { created: number; scanned: number; updated: number }
        >;
        ensurePrimaryIdentityLinkForUser: FunctionReference<
          "mutation",
          "internal",
          { userId: string },
          { created: boolean; providerKey: string; providerUserId: string }
        >;
        purgeExpiredOauthStates: FunctionReference<
          "mutation",
          "internal",
          { limit?: number },
          { removed: number; scanned: number }
        >;
        seedDefaultProviderConfigs: FunctionReference<
          "mutation",
          "internal",
          {},
          { inserted: number; updated: number }
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
          { providerKey: string }
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
          }
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
          }>
        >;
      };
    };
  };
  launchthat_browserlaunch: {
    actions: {
      createArtifactUploadUrl: FunctionReference<
        "action",
        "internal",
        {},
        { uploadUrl: string }
      >;
    };
    mutations: {
      appendRunStep: FunctionReference<
        "mutation",
        "internal",
        {
          errorMessage?: string;
          inputSummary?: string;
          kind: string;
          label?: string;
          metadataJson?: string;
          resultSummary?: string;
          runId: string;
          screenshotStorageId?: string;
          selector?: string;
          seq: number;
          status?: string;
          url?: string;
        },
        string
      >;
      claimNextTask: FunctionReference<
        "mutation",
        "internal",
        { app?: string; leaseMs?: number; queue?: string; workerId: string },
        {
          app: string;
          externalRef?: string;
          payloadJson: string;
          requestedSessionId?: string;
          runId: string;
          sessionPolicy?: string;
          taskId: string;
          taskType: string;
        } | null
      >;
      completeTask: FunctionReference<
        "mutation",
        "internal",
        { runId?: string; summary?: string; taskId: string },
        null
      >;
      createRunArtifact: FunctionReference<
        "mutation",
        "internal",
        {
          kind: "screenshot" | "log" | "state" | "other";
          metadataJson?: string;
          runId: string;
          stepSeq?: number;
          storageId?: string;
          url?: string;
        },
        string
      >;
      enqueueTask: FunctionReference<
        "mutation",
        "internal",
        {
          app: string;
          externalRef?: string;
          maxAttempts?: number;
          payloadJson: string;
          priority?: number;
          queue?: string;
          requestedSessionId?: string;
          sessionPolicy?: string;
          taskType: string;
        },
        string
      >;
      failTask: FunctionReference<
        "mutation",
        "internal",
        {
          errorMessage: string;
          retryable?: boolean;
          runId?: string;
          taskId: string;
        },
        null
      >;
      heartbeatLease: FunctionReference<
        "mutation",
        "internal",
        { leaseMs?: number; taskId: string; workerId: string },
        boolean
      >;
      saveSessionState: FunctionReference<
        "mutation",
        "internal",
        {
          expiresAt?: number;
          sessionId: string;
          status?: "active" | "reauth_required" | "expired" | "revoked";
          storageStateStorageId: string;
        },
        null
      >;
      touchWakeSignal: FunctionReference<
        "mutation",
        "internal",
        { channel: string; debounceMs?: number },
        boolean
      >;
      upsertRunForExternalRef: FunctionReference<
        "mutation",
        "internal",
        {
          app: string;
          externalRef: string;
          sessionId?: string;
          taskType: string;
          workerId?: string;
        },
        string
      >;
      upsertSession: FunctionReference<
        "mutation",
        "internal",
        {
          accountKey: string;
          app: string;
          expiresAt?: number;
          fingerprintProfileId?: string;
          notes?: string;
          provider: string;
          proxyProfileId?: string;
          status?: "active" | "reauth_required" | "expired" | "revoked";
          userKey?: string;
        },
        string
      >;
    };
    queries: {
      getOpsSummary: FunctionReference<
        "query",
        "internal",
        { app: string },
        {
          activeSessions: number;
          completedTasks: number;
          failedTasks: number;
          queuedTasks: number;
          reauthSessions: number;
          runningTasks: number;
        }
      >;
      getSessionByAccount: FunctionReference<
        "query",
        "internal",
        { accountKey: string; app: string; provider: string },
        {
          _id: string;
          expiresAt?: number;
          fingerprintProfileId?: string;
          lastValidatedAt?: number;
          proxyProfileId?: string;
          status: "active" | "reauth_required" | "expired" | "revoked";
          storageStateStorageId?: string;
          storageStateUrl?: string;
          updatedAt: number;
        } | null
      >;
      getTaskById: FunctionReference<
        "query",
        "internal",
        { taskId: string },
        {
          _id: string;
          app: string;
          createdAt: number;
          errorMessage?: string;
          externalRef?: string;
          payloadJson: string;
          queue: string;
          requestedSessionId?: string;
          sessionPolicy?: string;
          status: "queued" | "running" | "completed" | "failed" | "canceled";
          taskType: string;
          updatedAt: number;
        } | null
      >;
      listRunsForApp: FunctionReference<
        "query",
        "internal",
        { app: string; limit?: number },
        Array<{
          _id: string;
          createdAt: number;
          endedAt?: number;
          externalRef?: string;
          startedAt: number;
          status: "running" | "completed" | "failed" | "canceled";
          summary?: string;
          taskId?: string;
          taskType: string;
        }>
      >;
      listRunSteps: FunctionReference<
        "query",
        "internal",
        { limit?: number; runId: string },
        Array<{
          _id: string;
          createdAt: number;
          errorMessage?: string;
          inputSummary?: string;
          kind: string;
          label?: string;
          resultSummary?: string;
          screenshotStorageId?: string;
          screenshotUrl?: string;
          selector?: string;
          seq: number;
          status?: string;
          url?: string;
        }>
      >;
    };
  };
  stagehand: {
    lib: {
      act: FunctionReference<
        "action",
        "internal",
        {
          action: string;
          browserbaseApiKey: string;
          browserbaseProjectId: string;
          browserbaseSessionCreateParams?: any;
          modelApiKey: string;
          modelName?: string;
          options?: {
            timeout?: number;
            waitUntil?: "load" | "domcontentloaded" | "networkidle";
          };
          sessionId?: string;
          url?: string;
        },
        { actionDescription: string; message: string; success: boolean }
      >;
      agent: FunctionReference<
        "action",
        "internal",
        {
          browserbaseApiKey: string;
          browserbaseProjectId: string;
          browserbaseSessionCreateParams?: any;
          instruction: string;
          modelApiKey: string;
          modelName?: string;
          options?: {
            cua?: boolean;
            maxSteps?: number;
            systemPrompt?: string;
            timeout?: number;
            waitUntil?: "load" | "domcontentloaded" | "networkidle";
          };
          sessionId?: string;
          url?: string;
        },
        {
          actions: Array<{
            action?: string;
            reasoning?: string;
            timeMs?: number;
            type: string;
          }>;
          completed: boolean;
          message: string;
          success: boolean;
        }
      >;
      endSession: FunctionReference<
        "action",
        "internal",
        {
          browserbaseApiKey: string;
          browserbaseProjectId: string;
          modelApiKey: string;
          sessionId: string;
        },
        { success: boolean }
      >;
      extract: FunctionReference<
        "action",
        "internal",
        {
          browserbaseApiKey: string;
          browserbaseProjectId: string;
          browserbaseSessionCreateParams?: any;
          instruction: string;
          modelApiKey: string;
          modelName?: string;
          options?: {
            timeout?: number;
            waitUntil?: "load" | "domcontentloaded" | "networkidle";
          };
          schema: any;
          sessionId?: string;
          url?: string;
        },
        any
      >;
      observe: FunctionReference<
        "action",
        "internal",
        {
          browserbaseApiKey: string;
          browserbaseProjectId: string;
          browserbaseSessionCreateParams?: any;
          instruction: string;
          modelApiKey: string;
          modelName?: string;
          options?: {
            timeout?: number;
            waitUntil?: "load" | "domcontentloaded" | "networkidle";
          };
          sessionId?: string;
          url?: string;
        },
        Array<{
          arguments?: Array<string>;
          description: string;
          method: string;
          selector: string;
        }>
      >;
      startSession: FunctionReference<
        "action",
        "internal",
        {
          browserbaseApiKey: string;
          browserbaseProjectId: string;
          browserbaseSessionCreateParams?: any;
          browserbaseSessionId?: string;
          modelApiKey: string;
          modelName?: string;
          options?: {
            domSettleTimeoutMs?: number;
            selfHeal?: boolean;
            systemPrompt?: string;
            timeout?: number;
            waitUntil?: "load" | "domcontentloaded" | "networkidle";
          };
          url: string;
        },
        { browserbaseSessionId?: string; cdpUrl?: string; sessionId: string }
      >;
    };
  };
};
