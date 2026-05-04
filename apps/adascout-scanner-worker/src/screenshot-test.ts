import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright-core";

const parseArgs = (): { url: string; outputPath: string } => {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!key?.startsWith("--") || !value) continue;
    map.set(key.slice(2), value);
  }
  const url = map.get("url") ?? process.env.SCREENSHOT_TEST_URL ?? "https://fl-msp.com/";
  const outputPath =
    map.get("out") ??
    process.env.SCREENSHOT_TEST_OUT ??
    "/tmp/adascout-screenshot-test.jpg";
  return { url, outputPath };
};

const waitForVisualReadiness = async (
  page: {
    waitForLoadState: (
      state: "domcontentloaded" | "load" | "networkidle",
      options?: { timeout?: number },
    ) => Promise<void>;
    evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
): Promise<void> => {
  await page
    .waitForLoadState("networkidle", {
      timeout: 15_000,
    })
    .catch(() => undefined);

  await page
    .evaluate(async () => {
      const root = globalThis as unknown as {
        document?: {
          images?: ArrayLike<{
            complete?: boolean;
            naturalWidth?: number;
            decode?: () => Promise<void>;
            addEventListener?: (
              name: string,
              cb: () => void,
              options?: { once?: boolean },
            ) => void;
          }>;
          fonts?: { ready?: Promise<unknown> };
        };
      };
      const doc = root.document;
      if (!doc) return;

      const fontsReady = (() => {
        const fonts = doc.fonts;
        if (!fonts?.ready) return Promise.resolve();
        return fonts.ready.catch(() => undefined);
      })();

      const imagePromises = Array.from(doc.images ?? [])
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .slice(0, 150)
        .map(async (img) => {
          try {
            if (typeof img.decode === "function") {
              await img.decode();
            } else {
              await new Promise<void>((resolveImage) => {
                const done = () => resolveImage();
                if (img.addEventListener) {
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                } else {
                  resolveImage();
                }
                setTimeout(done, 1_000);
              });
            }
          } catch {
            // Ignore single-image failures.
          }
        });

      await Promise.race([
        Promise.all([fontsReady, ...imagePromises]),
        new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 3_500)),
      ]);
    })
    .catch(() => undefined);

  await page.waitForTimeout(250);
};

const preparePageForScreenshot = async (
  page: {
    evaluate: <T>(fn: () => T) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
): Promise<{ totalHeight: number; contentBottom: number; captureHeight: number; appliedZoom: number }> => {
  const prep = await page.evaluate(() => {
    const dom = (globalThis as unknown as { document?: unknown; innerHeight?: number }).document as
      | {
          body?: {
            scrollHeight?: number;
            style?: { setProperty: (name: string, value: string) => void };
          };
          documentElement?: {
            scrollHeight?: number;
            style?: { setProperty: (name: string, value: string) => void };
          };
        }
      | undefined;
    if (!dom) {
      return { totalHeight: 0, appliedZoom: 1 };
    }
    const totalHeight = Math.max(
      0,
      Number(dom.body?.scrollHeight ?? 0),
      Number(dom.documentElement?.scrollHeight ?? 0),
    );
    const maxTargetHeight = 7_000;
    const appliedZoom =
      totalHeight > maxTargetHeight
        ? Math.max(0.2, maxTargetHeight / Math.max(totalHeight, 1))
        : 1;
    if (appliedZoom < 1) {
      dom.documentElement?.style?.setProperty?.("zoom", String(appliedZoom));
      dom.body?.style?.setProperty?.("zoom", String(appliedZoom));
    }
    const adjustedHeight = Math.max(
      0,
      Number(dom.body?.scrollHeight ?? 0),
      Number(dom.documentElement?.scrollHeight ?? 0),
    );
    return { totalHeight: adjustedHeight, appliedZoom };
  });

  const stepCount = Math.max(
    1,
    Math.min(40, Math.ceil(Math.max(prep.totalHeight || 0, 1200) / 900)),
  );
  for (let i = 0; i < stepCount; i += 1) {
    await page.evaluate(() => {
      const root = globalThis as unknown as {
        scrollBy?: (x: number, y: number) => void;
        innerHeight?: number;
      };
      const delta = Math.max(600, Number(root.innerHeight ?? 900) - 120);
      root.scrollBy?.(0, delta);
      return null;
    });
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => {
    const root = globalThis as unknown as { scrollTo?: (x: number, y: number) => void };
    root.scrollTo?.(0, 0);
    return null;
  });
  await page.waitForTimeout(150);

  const finalMetrics = await page.evaluate(() => {
    const root = globalThis as unknown as {
      document?: {
        body?: { scrollHeight?: number; querySelectorAll?: (selector: string) => Iterable<unknown> };
        documentElement?: { scrollHeight?: number };
      };
      getComputedStyle?: (node: unknown) => {
        display?: string;
        visibility?: string;
        position?: string;
        opacity?: string;
        backgroundImage?: string;
      };
      scrollY?: number;
      innerHeight?: number;
    };
    const doc = root.document;
    if (!doc) {
      return { totalHeight: 0, contentBottom: 0, captureHeight: 0 };
    }
    const totalHeight = Math.max(
      0,
      Number(doc.body?.scrollHeight ?? 0),
      Number(doc.documentElement?.scrollHeight ?? 0),
    );
    const viewportHeight = Math.max(1, Number(root.innerHeight ?? 900));
    const getComputedStyle = root.getComputedStyle;
    const scrollY = Number(root.scrollY ?? 0);
    const elements = Array.from(doc.body?.querySelectorAll?.("*") ?? []);
    let contentBottom = 0;
    for (const node of elements) {
      const element = node as {
        tagName?: string;
        textContent?: string | null;
        getBoundingClientRect?: () => { bottom?: number; width?: number; height?: number };
      };
      const rect = element.getBoundingClientRect?.();
      if (!rect) continue;
      const width = Number(rect.width ?? 0);
      const height = Number(rect.height ?? 0);
      if (width <= 0 || height <= 0) continue;
      const style = getComputedStyle?.(node);
      if (style?.display === "none" || style?.visibility === "hidden") continue;
      if (style?.opacity === "0") continue;
      if (style?.position === "fixed") continue;
      const tagName = String(element.tagName ?? "").toUpperCase();
      const hasText = String(element.textContent ?? "").trim().length > 0;
      const hasMedia = ["IMG", "VIDEO", "IFRAME", "CANVAS", "SVG"].includes(tagName);
      const hasBackgroundImage =
        typeof style?.backgroundImage === "string" &&
        style.backgroundImage.trim() !== "" &&
        style.backgroundImage !== "none";
      if (!hasText && !hasMedia && !hasBackgroundImage && width * height < 30_000) continue;
      const bottom = Number(rect.bottom ?? 0) + scrollY;
      if (Number.isFinite(bottom)) {
        contentBottom = Math.max(contentBottom, bottom);
      }
    }
    if (contentBottom <= 0) {
      contentBottom = totalHeight;
    }
    const captureHeight = Math.max(
      viewportHeight,
      Math.ceil(Math.min(totalHeight, contentBottom + 120)),
    );
    return { totalHeight, contentBottom, captureHeight };
  });

  return {
    totalHeight: finalMetrics.totalHeight || prep.totalHeight,
    contentBottom: finalMetrics.contentBottom || prep.totalHeight,
    captureHeight: finalMetrics.captureHeight || prep.totalHeight,
    appliedZoom: prep.appliedZoom,
  };
};

const main = async () => {
  const { url, outputPath } = parseArgs();
  const cdpUrl = process.env.BROWSERLESS_CDP_URL;
  if (!cdpUrl) {
    throw new Error("BROWSERLESS_CDP_URL is required.");
  }
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 1200 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await waitForVisualReadiness(page);
    const screenshotPrep = await preparePageForScreenshot(page);
    await waitForVisualReadiness(page);
    const viewport = page.viewportSize() ?? { width: 1600, height: 1200 };
    const captureHeight = Math.max(1, Math.ceil(screenshotPrep.captureHeight || viewport.height));
    if (captureHeight > viewport.height) {
      await page.setViewportSize({
        width: viewport.width,
        height: captureHeight,
      });
      await page.waitForTimeout(120);
    }
    const image = await page.screenshot({
      type: "jpeg",
      quality: 75,
      animations: "disabled",
      caret: "hide",
    });
    const resolvedOut = resolve(outputPath);
    await mkdir(dirname(resolvedOut), { recursive: true });
    await writeFile(resolvedOut, image);
    console.info(
      JSON.stringify({
        event: "screenshot_test_complete",
        url,
        status: response?.status() ?? 0,
        outputPath: resolvedOut,
        totalHeight: screenshotPrep.totalHeight,
        contentBottom: screenshotPrep.contentBottom,
        captureHeight,
        appliedZoom: screenshotPrep.appliedZoom,
        bytes: image.byteLength,
      }),
    );
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

void main();
