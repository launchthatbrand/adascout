import { v } from "convex/values";

import { internal } from "./_generated/api";
import { workflow } from "./workflow";

interface WorkflowStepRunner {
  runAction: (
    actionRef: unknown,
    args: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  runMutation: (
    mutationRef: unknown,
    args: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
}

interface WorkflowRunner {
  define: (config: {
    args: Record<string, unknown>;
    returns: unknown;
    handler: (
      step: unknown,
      args: { scanRunId: string; pageRunIds?: string[] },
    ) => Promise<null>;
  }) => unknown;
}

const workflowRunner = workflow as unknown as WorkflowRunner;

const getIntEnv = (name: string, fallback: number): number => {
  const envValue = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.[name];
  const parsed = Number.parseInt(envValue ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const getStringEnv = (name: string, fallback: string): string => {
  const envValue = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.[name];
  if (!envValue) return fallback;
  return envValue;
};

export const runWebsiteScanWorkflow = workflowRunner.define({
  args: {
    scanRunId: v.id("scanRuns"),
    pageRunIds: v.optional(v.array(v.id("scanRunPages"))),
    pageUrls: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (
    step: unknown,
    args: { scanRunId: string; pageRunIds?: string[]; pageUrls?: string[] },
  ) => {
    const runner = step as WorkflowStepRunner;
    const planTier =
      getStringEnv("SCANNER_PLAN_TIER", "free").toLowerCase() === "paid"
        ? "paid"
        : "free";
    const maxConcurrentSessions = Math.max(
      1,
      Math.min(
        100,
        planTier === "free"
          ? 1
          : getIntEnv("SCANNER_MAX_CONCURRENT_SESSIONS", 1) || 1,
      ),
    );
    const pagesPerSession = Math.max(
      1,
      Math.min(50, getIntEnv("SCANNER_PAGES_PER_SESSION", 10) || 10),
    );

    if (args.pageUrls && args.pageUrls.length > 0) {
      await runner.runAction(internal.scanRunner.discoverAndQueueSitePages, {
        scanRunId: args.scanRunId,
        pageUrls: args.pageUrls,
      });
    } else if (!args.pageRunIds || args.pageRunIds.length === 0) {
      await runner.runAction(internal.scanRunner.discoverAndQueueSitePages, {
        scanRunId: args.scanRunId,
        maxUrls: 100,
      });
    }

    const explicitPageRunIds = args.pageRunIds ?? [];
    if (explicitPageRunIds.length > 0) {
      for (const pageRunId of explicitPageRunIds) {
        await runner.runAction(
          internal.scanRunner.scanQueuedPage,
          { scanRunId: args.scanRunId, pageRunId },
          { retry: false },
        );
      }
      await runner.runAction(
        internal.scanRunner.finalizeWebsiteScanRunReport,
        { scanRunId: args.scanRunId },
        { retry: false },
      );
      return null;
    }

    let stalledPasses = 0;
    const maxStalledPasses = Math.max(
      2,
      getIntEnv("SCANNER_MAX_STALLED_PASSES", 4),
    );
    while (true) {
      const canceled = (await runner.runMutation(
        internal.scans.isScanRunCanceledForWorkflow,
        {
          scanRunId: args.scanRunId,
        },
      )) as boolean;
      if (canceled) {
        break;
      }
      const workers = Array.from(
        { length: maxConcurrentSessions },
        (_value, index) =>
          runner.runAction(
            internal.scanRunner.processQueuedPagesWithSessionLease,
            {
              scanRunId: args.scanRunId,
              workerId: `workflow-worker-${index + 1}`,
              pageLimit: pagesPerSession,
            },
            { retry: false },
          ),
      );
      const results = (await Promise.all(workers)) as {
        processedPages: number;
        leaseAcquired: boolean;
        claimedPages: number;
      }[];
      const processedInPass = results.reduce(
        (sum, item) => sum + item.processedPages,
        0,
      );
      const claimedInPass = results.reduce(
        (sum, item) => sum + item.claimedPages,
        0,
      );
      const leaseAcquiredCount = results.filter(
        (item) => item.leaseAcquired,
      ).length;
      if (leaseAcquiredCount === 0) {
        stalledPasses += 1;
      } else if (processedInPass > 0 || claimedInPass > 0) {
        stalledPasses = 0;
      }
      if (stalledPasses >= maxStalledPasses) {
        break;
      }
      if (processedInPass === 0 && claimedInPass === 0) {
        break;
      }
    }

    const canceled = (await runner.runMutation(
      internal.scans.isScanRunCanceledForWorkflow,
      {
        scanRunId: args.scanRunId,
      },
    )) as boolean;
    if (canceled) {
      return null;
    }

    await runner.runAction(
      internal.scanRunner.finalizeWebsiteScanRunReport,
      { scanRunId: args.scanRunId },
      { retry: false },
    );
    return null;
  },
});
