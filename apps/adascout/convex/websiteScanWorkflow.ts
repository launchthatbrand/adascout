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
    let stalledPasses = 0;
    const maxStalledPasses = Math.max(3, getIntEnv("SCANNER_MAX_STALLED_PASSES", 30));
    let lastRemaining = Number.POSITIVE_INFINITY;
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
      const progress = (await runner.runMutation(
        internal.scans.getScanRunProgressForWorkflow,
        {
          scanRunId: args.scanRunId,
          pageRunIds:
            explicitPageRunIds.length > 0
              ? explicitPageRunIds
              : undefined,
        },
      )) as {
        queuedPages: number;
        runningPages: number;
      };
      const remaining = progress.queuedPages + progress.runningPages;
      if (remaining <= 0) {
        break;
      }
      if (remaining < lastRemaining) {
        stalledPasses = 0;
      } else {
        stalledPasses += 1;
      }
      lastRemaining = remaining;
      if (stalledPasses >= maxStalledPasses) break;
      await runner.runAction(
        internal.scanRunner.sleepForWorkflow,
        { ms: 1000 },
        { retry: false },
      );
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

    const finalProgress = (await runner.runMutation(
      internal.scans.getScanRunProgressForWorkflow,
      {
        scanRunId: args.scanRunId,
        pageRunIds:
          explicitPageRunIds.length > 0
            ? explicitPageRunIds
            : undefined,
      },
    )) as {
      queuedPages: number;
      runningPages: number;
    };
    if (finalProgress.queuedPages + finalProgress.runningPages > 0) {
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
