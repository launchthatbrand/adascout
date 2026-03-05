/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
"use node";

import { z } from "zod";

export interface StagehandSdkFinding {
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  ruleId: string;
  title: string;
  description?: string;
  selector?: string;
  helpUrl?: string;
  evidenceHash?: string;
}

const findingSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(["critical", "serious", "moderate", "minor", "info"]),
      ruleId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      selector: z.string().optional(),
      helpUrl: z.string().optional(),
    }),
  ),
});

export const runStagehandSdkAccessibilityScan = async (args: {
  url: string;
  browserbaseApiKey: string;
  browserbaseProjectId: string;
  minimaxApiKey: string;
}): Promise<StagehandSdkFinding[]> => {
  const { V3 } = await import("@browserbasehq/stagehand/lib/v3/v3.js");
  const { AISdkClient } = await import("@browserbasehq/stagehand/lib/v3/external_clients/aisdk.js");
  const { createMinimax } = await import("vercel-minimax-ai-provider");

  const minimaxProvider = createMinimax({ apiKey: args.minimaxApiKey });
  const llmClient = new AISdkClient({
    model: minimaxProvider("MiniMax-M2-Stable") as any,
  });

  const stagehand = new V3({
    env: "BROWSERBASE",
    apiKey: args.browserbaseApiKey,
    projectId: args.browserbaseProjectId,
    llmClient,
    // Convex runtime does not provide pino-pretty transport resolution.
    disablePino: true,
    verbose: 0,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages().at(0);
    if (!page) {
      throw new Error("Stagehand SDK did not initialize a browser page");
    }
    await page.goto(args.url, { waitUntil: "domcontentloaded", timeoutMs: 45_000 });

    const extracted = await stagehand.extract(
      "Audit this page for WCAG 2.2 AA issues. Return concise findings with severity and selector.",
      findingSchema,
      { timeout: 45_000 },
    );

    return extracted.findings.map((item) => ({
      severity: item.severity,
      ruleId: item.ruleId,
      title: item.title,
      description: item.description,
      selector: item.selector,
      helpUrl: item.helpUrl,
      evidenceHash: `${item.ruleId}|${item.selector ?? ""}|${item.description ?? ""}`.toLowerCase(),
    }));
  } finally {
    await stagehand.close().catch(() => undefined);
  }
};

