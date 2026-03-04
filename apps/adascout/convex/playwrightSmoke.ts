"use node";
/* eslint-disable no-restricted-properties */
/* eslint-disable turbo/no-undeclared-env-vars */

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Browser, Page } from "playwright";

const modeValidator = v.union(
  v.literal("import_only"),
  v.literal("launch_local"),
  v.literal("navigate_local"),
  v.literal("connect_cdp"),
);

export const smoke = action({
  args: {
    mode: v.optional(modeValidator),
    url: v.optional(v.string()),
    cdpUrl: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    mode: modeValidator,
    durationMs: v.number(),
    stepLog: v.array(v.string()),
    browserVersion: v.optional(v.string()),
    title: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const startedAt = Date.now();
    const mode = args.mode ?? "navigate_local";
    const stepLog: string[] = [];
    let browser: Browser | null = null;
    try {
      stepLog.push("import_playwright_start");
      const playwright = await import("playwright");
      stepLog.push("import_playwright_complete");

      if (mode === "import_only") {
        return {
          ok: true,
          mode,
          durationMs: Date.now() - startedAt,
          stepLog,
        };
      }

      const targetUrl = args.url ?? "https://example.com";
      if (mode === "connect_cdp") {
        const cdpUrl =
          args.cdpUrl ??
          process.env.ADA_SCANNER_CDP_URL ??
          process.env.BROWSERLESS_CDP_URL ??
          process.env.BROWSERBASE_CDP_URL;
        if (!cdpUrl) {
          throw new Error(
            "cdpUrl is required for connect_cdp mode. Set args.cdpUrl or ADA_SCANNER_CDP_URL.",
          );
        }
        stepLog.push("connect_cdp_start");
        browser = await playwright.chromium.connectOverCDP(cdpUrl);
        stepLog.push("connect_cdp_complete");
      } else {
        stepLog.push("launch_browser_start");
        browser = await playwright.chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        stepLog.push("launch_browser_complete");
      }

      if (mode === "launch_local") {
        return {
          ok: true,
          mode,
          durationMs: Date.now() - startedAt,
          stepLog,
          browserVersion: typeof browser.version === "function" ? browser.version() : undefined,
        };
      }

      stepLog.push("open_page_start");
      const context = await browser.newContext();
      const page: Page = await context.newPage();
      stepLog.push("open_page_complete");

      stepLog.push("goto_start");
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
      stepLog.push("goto_complete");

      const title = await page.title();
      const userAgent = await page.evaluate(() => globalThis.navigator.userAgent);
      stepLog.push("read_metadata_complete");

      return {
        ok: true,
        mode,
        durationMs: Date.now() - startedAt,
        stepLog,
        browserVersion: typeof browser.version === "function" ? browser.version() : undefined,
        title,
        userAgent,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stepLog.push(`error:${errorMessage}`);
      return {
        ok: false,
        mode,
        durationMs: Date.now() - startedAt,
        stepLog,
        error: errorMessage,
      };
    } finally {
      if (browser) {
        try {
          await browser.close();
          stepLog.push("browser_close_complete");
        } catch {
          stepLog.push("browser_close_failed");
        }
      }
    }
  },
});

