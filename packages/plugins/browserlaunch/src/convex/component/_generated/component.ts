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
    actions: {
      createArtifactUploadUrl: FunctionReference<
        "action",
        "internal",
        {},
        { uploadUrl: string },
        Name
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
        string,
        Name
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
        } | null,
        Name
      >;
      completeTask: FunctionReference<
        "mutation",
        "internal",
        { runId?: string; summary?: string; taskId: string },
        null,
        Name
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
        string,
        Name
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
        string,
        Name
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
        null,
        Name
      >;
      heartbeatLease: FunctionReference<
        "mutation",
        "internal",
        { leaseMs?: number; taskId: string; workerId: string },
        boolean,
        Name
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
        null,
        Name
      >;
      touchWakeSignal: FunctionReference<
        "mutation",
        "internal",
        { channel: string; debounceMs?: number },
        boolean,
        Name
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
        string,
        Name
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
        string,
        Name
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
        },
        Name
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
        } | null,
        Name
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
        } | null,
        Name
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
        }>,
        Name
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
        }>,
        Name
      >;
    };
  };
