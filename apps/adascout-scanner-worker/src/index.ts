import { AxeBuilder } from "@axe-core/playwright";
import { ConvexHttpClient } from "convex/browser";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";
import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { z } from "zod";

const configSchema = z.object({
  CONVEX_URL: z.string().url(),
  ADA_SCANNER_WORKER_TOKEN: z.string().min(1),
  BROWSERLESS_CDP_URL: z.string().min(1),
  SCANNER_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  SCANNER_IDLE_SLEEP_MS: z.coerce.number().int().min(100).max(60_000).default(1_500),
  SCANNER_WAKE_MODE_ENABLED: z.coerce.boolean().default(true),
  SCANNER_WAKE_SECRET: z.string().optional(),
  SCANNER_FALLBACK_POLL_MS: z.coerce.number().int().min(1_000).max(300_000).default(45_000),
  SCANNER_DRAIN_EMPTY_THRESHOLD: z.coerce.number().int().min(1).max(20).default(2),
  SCANNER_DRAIN_EMPTY_SLEEP_MS: z.coerce.number().int().min(50).max(10_000).default(250),
  SCANNER_ACTIVE_PAUSE_MS: z.coerce.number().int().min(0).max(5_000).default(100),
  SCANNER_PAGE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(180_000).default(45_000),
  SCANNER_SETTLE_MS: z.coerce.number().int().min(0).max(30_000).default(1_000),
  SCANNER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(8081),
  SCANNER_PROXY_MODE: z.enum(["off", "fallback", "always"]).default("fallback"),
  SCANNER_PROXY_PROTOCOL: z.enum(["http", "https", "socks5"]).default("http"),
  SCANNER_PROXY_ENDPOINTS: z.string().optional(),
  SCANNER_PROXY_USERNAME: z.string().optional(),
  SCANNER_PROXY_PASSWORD: z.string().optional(),
  SCANNER_FINGERPRINT_ENABLED: z.coerce.boolean().default(true),
  SCANNER_FINGERPRINT_BROWSERS: z.string().default("chrome"),
  SCANNER_FINGERPRINT_OPERATING_SYSTEMS: z.string().default("linux"),
  SCANNER_FINGERPRINT_DEVICES: z.string().default("desktop"),
  SCANNER_FINGERPRINT_LOCALE: z.string().default("en-US"),
  SCANNER_FINGERPRINT_TIMEZONE: z.string().default("America/New_York"),
});

const config = configSchema.parse(process.env);
const convex = new ConvexHttpClient(config.CONVEX_URL);

type ClaimResponse = {
  scanRunId: string;
  pageRunId: string;
  assetId: string;
  pageUrl: string;
  queueWaitMs: number;
} | null;

type DiscoveryClaimResponse = {
  jobId: string;
  assetId: string;
  sourceUrl: string;
  maxUrls: number;
} | null;

type WorkerTaskClaim =
  | {
      kind: "discovery";
      jobId: string;
      assetId: string;
      sourceUrl: string;
      maxUrls: number;
    }
  | {
      kind: "page";
      scanRunId: string;
      pageRunId: string;
      assetId: string;
      pageUrl: string;
      queueWaitMs: number;
    }
  | null;

type WorkerFinding = {
  source: "axe";
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  ruleId: string;
  title: string;
  description?: string;
  help?: string;
  helpUrl?: string;
  target?: string;
  pageRegion?: "header" | "footer" | "body";
  pageUrl?: string;
  codeSnippet?: string;
  manualReviewRequired?: boolean;
  confidence?: number;
  evidenceHash?: string;
  selectorSnapshot?: string;
  domSnippet?: string;
  pageTitle?: string;
  highlightId?: number;
  bboxX?: number;
  bboxY?: number;
  bboxWidth?: number;
  bboxHeight?: number;
  screenshotViewportWidth?: number;
  screenshotViewportHeight?: number;
};

type WorkerState = {
  startedAt: number;
  processedPages: number;
  failedPages: number;
  inFlight: number;
  lastError?: string;
  wakePending: boolean;
  fallbackPolls: number;
  wakeSignals: number;
  drainCycles: number;
  nullClaims: number;
  lastScanRunId?: string;
};

type PageScanResult = {
  findings: Array<WorkerFinding>;
  pageScreenshotStorageId?: string;
  pageScreenshotCapturedAt?: number;
  screenshotErrorCategory?: string;
  screenshotErrorMessage?: string;
};

type BrowserProxyConfig = {
  server: string;
  username?: string;
  password?: string;
};

type BrowserFingerprintProfile = {
  fingerprint: {
    headers?: Record<string, string>;
    fingerprint: {
      navigator?: {
        userAgent?: string;
      };
      screen?: {
        width?: number;
        height?: number;
      };
    };
  };
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
};

type NavigationDiagnostics = {
  finalUrl: string;
  pageTitle: string;
  bodySnippet: string;
  botSignals: string[];
};

const state: WorkerState = {
  startedAt: Date.now(),
  processedPages: 0,
  failedPages: 0,
  inFlight: 0,
  wakePending: true,
  fallbackPolls: 0,
  wakeSignals: 0,
  drainCycles: 0,
  nullClaims: 0,
};

const proxyEndpoints = String(config.SCANNER_PROXY_ENDPOINTS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const hasProxyConfig = proxyEndpoints.length > 0;
const parseCsvList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const fingerprintInjector = new FingerprintInjector();
const fingerprintGenerator = new FingerprintGenerator({
  // Keep persona stable by default; values can be overridden by env.
  browsers: parseCsvList(config.SCANNER_FINGERPRINT_BROWSERS),
  operatingSystems: parseCsvList(config.SCANNER_FINGERPRINT_OPERATING_SYSTEMS),
  devices: parseCsvList(config.SCANNER_FINGERPRINT_DEVICES),
  locales: parseCsvList(config.SCANNER_FINGERPRINT_LOCALE),
} as unknown as Record<string, unknown>);

const getFingerprintProfile = (): BrowserFingerprintProfile | null => {
  if (!config.SCANNER_FINGERPRINT_ENABLED) {
    return null;
  }
  const generated = fingerprintGenerator.getFingerprint(
    {
      browsers: parseCsvList(config.SCANNER_FINGERPRINT_BROWSERS),
      operatingSystems: parseCsvList(config.SCANNER_FINGERPRINT_OPERATING_SYSTEMS),
      devices: parseCsvList(config.SCANNER_FINGERPRINT_DEVICES),
      locales: parseCsvList(config.SCANNER_FINGERPRINT_LOCALE),
    } as unknown as Record<string, unknown>,
  ) as unknown as BrowserFingerprintProfile["fingerprint"];

  const width = Number(generated.fingerprint.screen?.width ?? 1600);
  const height = Number(generated.fingerprint.screen?.height ?? 1200);
  const userAgent = generated.fingerprint.navigator?.userAgent;
  return {
    fingerprint: generated,
    userAgent: userAgent && userAgent.trim().length > 0 ? userAgent : undefined,
    viewport: {
      width: Number.isFinite(width) ? Math.max(1024, Math.min(2560, width)) : 1600,
      height: Number.isFinite(height) ? Math.max(700, Math.min(2000, height)) : 1200,
    },
  };
};

const pickProxy = (): BrowserProxyConfig | null => {
  if (!hasProxyConfig) return null;
  const endpoint =
    proxyEndpoints[Math.floor(Math.random() * proxyEndpoints.length)] ??
    proxyEndpoints[0];
  if (!endpoint) return null;
  return {
    server: `${config.SCANNER_PROXY_PROTOCOL}://${endpoint}`,
    username: config.SCANNER_PROXY_USERNAME,
    password: config.SCANNER_PROXY_PASSWORD,
  };
};

const sleep = async (ms: number) =>
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const callAction = async <T>(name: string, args: unknown): Promise<T> =>
  await (convex as unknown as { action: (n: string, a: unknown) => Promise<T> }).action(
    name,
    args,
  );

const classifyError = (error: unknown): string => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("timeout")) return "timeout";
  if (message.includes("net::err") || message.includes("econnrefused")) return "network";
  if (message.includes("403") || message.includes("captcha") || message.includes("access denied")) {
    return "bot_protection";
  }
  if (message.includes("navigation")) return "navigation";
  return "unknown";
};

const impactToSeverity = (impact: string | null | undefined): WorkerFinding["severity"] => {
  if (impact === "critical") return "critical";
  if (impact === "serious") return "serious";
  if (impact === "moderate") return "moderate";
  if (impact === "minor") return "minor";
  return "info";
};

const createEvidenceKey = (ruleId: string, selector: string, pageUrl: string): string =>
  `axe|${ruleId}|${selector || "document"}|${pageUrl}`;

const uploadPageScreenshot = async (screenshotBytes: Buffer): Promise<string> => {
  const uploadTarget = await callAction<{ uploadUrl: string }>(
    "scans:createExternalPageScreenshotUploadUrl",
    {
      workerToken: config.ADA_SCANNER_WORKER_TOKEN,
    },
  );
  const uploadResponse = await fetch(uploadTarget.uploadUrl, {
    method: "POST",
    headers: {
      "content-type": "image/jpeg",
    },
    body: screenshotBytes,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Screenshot upload failed with status ${uploadResponse.status}`);
  }
  const payload = (await uploadResponse.json()) as { storageId?: string };
  if (!payload.storageId) {
    throw new Error("Screenshot upload response missing storageId");
  }
  return payload.storageId;
};

const collectNavigationDiagnostics = async (
  page: {
    url: () => string;
    title: () => Promise<string>;
    evaluate: <T>(fn: () => T) => Promise<T>;
  },
): Promise<NavigationDiagnostics> => {
  const finalUrl = page.url();
  const pageTitle = (await page.title().catch(() => "")).slice(0, 200);
  const bodySnippet = await page
    .evaluate(() => {
      const doc = (globalThis as unknown as { document?: unknown }).document as
        | {
            body?: { innerText?: string };
          }
        | undefined;
      return String(doc?.body?.innerText ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);
    })
    .catch(() => "");

  const haystack = `${pageTitle} ${bodySnippet}`.toLowerCase();
  const botSignals: string[] = [];
  if (haystack.includes("403")) botSignals.push("http_403_text");
  if (haystack.includes("access denied")) botSignals.push("access_denied");
  if (haystack.includes("captcha")) botSignals.push("captcha");
  if (haystack.includes("cloudflare")) botSignals.push("cloudflare");
  if (haystack.includes("forbidden")) botSignals.push("forbidden");

  return { finalUrl, pageTitle, bodySnippet, botSignals };
};

const detectPageRegionForSelector = async (
  page: {
    evaluate: <T, A>(fn: (arg: A) => T, arg: A) => Promise<T>;
  },
  selector: string,
): Promise<"header" | "footer" | "body"> => {
  const normalizedSelector = selector.trim();
  if (normalizedSelector.length === 0) {
    return "body";
  }
  return await page
    .evaluate((selectorArg) => {
      const fallback: "header" | "footer" | "body" = "body";
      const globalValue = globalThis as unknown as {
        document?: {
          querySelector: (selector: string) => {
            closest: (selector: string) => unknown;
          } | null;
        };
      };
      const doc = globalValue.document;
      if (!doc) return fallback;
      let element: { closest: (selector: string) => unknown } | null = null;
      try {
        element = doc.querySelector(selectorArg);
      } catch {
        return fallback;
      }
      if (!element) return fallback;
      if (element.closest("header")) return "header" as const;
      if (element.closest("footer")) return "footer" as const;
      return fallback;
    }, normalizedSelector)
    .catch(() => "body");
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
  // Prefer a real browser-idle signal when available.
  await page
    .waitForLoadState("networkidle", {
      timeout: Math.max(1_500, Math.min(15_000, config.SCANNER_PAGE_TIMEOUT_MS)),
    })
    .catch(() => undefined);

  // Then wait for fonts + decodable images to reduce "half-loaded" screenshots.
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
              await new Promise<void>((resolve) => {
                const done = () => resolve();
                if (img.addEventListener) {
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                } else {
                  resolve();
                }
                setTimeout(done, 1_000);
              });
            }
          } catch {
            // Ignore individual image decode errors.
          }
        });

      await Promise.race([
        Promise.all([fontsReady, ...imagePromises]),
        new Promise<void>((resolve) => setTimeout(resolve, 3_500)),
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

    const viewportHeight = Math.max(
      1,
      Number((globalThis as unknown as { innerHeight?: number }).innerHeight ?? 900),
    );
    const totalHeight = Math.max(
      0,
      Number(dom.body?.scrollHeight ?? 0),
      Number(dom.documentElement?.scrollHeight ?? 0),
    );

    // Some remote Chromium runs clip tall screenshots well below desktop
    // Chrome's max texture size. Keep the final page height conservative.
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
    const stepCount = Math.max(
      1,
      Math.min(40, Math.ceil(Math.max(adjustedHeight, viewportHeight) / viewportHeight)),
    );
    return { totalHeight: adjustedHeight, appliedZoom, stepCount, viewportHeight };
  });

  const stepCount = Math.max(
    1,
    Math.min(
      40,
      Math.ceil(Math.max(prep.totalHeight || 0, 1200) / 900),
    ),
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
        getBoundingClientRect?: () => { top?: number; bottom?: number; width?: number; height?: number };
      };
      const rect = element.getBoundingClientRect?.();
      if (!rect) continue;
      const width = Number(rect.width ?? 0);
      const height = Number(rect.height ?? 0);
      if (width <= 0 || height <= 0) continue;
      const style = getComputedStyle?.(node);
      if (style?.display === "none" || style?.visibility === "hidden") continue;
      if (style?.opacity === "0") continue;
      // Fixed elements (sticky bars, floating chat, etc.) shouldn't extend capture height.
      if (style?.position === "fixed") continue;
      const tagName = String(element.tagName ?? "").toUpperCase();
      const hasText = String(element.textContent ?? "").trim().length > 0;
      const hasMedia = ["IMG", "VIDEO", "IFRAME", "CANVAS", "SVG"].includes(tagName);
      const hasBackgroundImage =
        typeof style?.backgroundImage === "string" &&
        style.backgroundImage.trim() !== "" &&
        style.backgroundImage !== "none";
      // Skip large empty layout wrappers that artificially inflate page bottom.
      if (!hasText && !hasMedia && !hasBackgroundImage && width * height < 30_000) continue;
      const bottom = Number(rect.bottom ?? 0) + scrollY;
      if (Number.isFinite(bottom)) {
        contentBottom = Math.max(contentBottom, bottom);
      }
    }
    if (contentBottom <= 0) {
      contentBottom = totalHeight;
    }
    // Include a small buffer for shadows and partially clipped last blocks.
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

type HighlightEntry = {
  selector: string;
  highlightId: number;
};

const applyFindingHighlights = async (
  page: {
    addStyleTag: (args: { content: string }) => Promise<unknown>;
    evaluate: <T>(fn: (entries: Array<HighlightEntry>) => T, arg: Array<HighlightEntry>) => Promise<T>;
  },
  entries: Array<HighlightEntry>,
): Promise<number> => {
  if (entries.length === 0) {
    return 0;
  }

  await page.addStyleTag({
    content: `
      [data-adascout-highlight="true"] {
        outline: 3px solid #ef4444 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3) !important;
      }
      [data-adascout-highlight-index]::after {
        content: attr(data-adascout-highlight-index);
        position: absolute;
        top: 0;
        left: 0;
        transform: translate(-10%, -110%);
        background: #ef4444;
        color: #fff;
        font: 700 10px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        border-radius: 9999px;
        padding: 2px 6px;
        z-index: 2147483647;
        pointer-events: none;
      }
    `,
  });

  return await page.evaluate((rawEntries) => {
    const dom = (globalThis as unknown as { document?: unknown; getComputedStyle?: unknown })
      .document as
      | {
          querySelectorAll: (selector: string) => Iterable<unknown>;
        }
      | undefined;
    const getComputedStyle = (globalThis as unknown as { getComputedStyle?: unknown })
      .getComputedStyle as ((element: unknown) => { position?: string }) | undefined;
    if (!dom) {
      return 0;
    }
    const uniqueEntries = Array.from(
      new Map(
        rawEntries
          .map((entry) => ({
            selector: String(entry.selector || "").trim(),
            highlightId: Number(entry.highlightId || 0),
          }))
          .filter((entry) => entry.selector.length > 0 && entry.highlightId > 0)
          .map((entry) => [entry.highlightId, entry] as const),
      ).values(),
    );
    let highlighted = 0;
    for (const entry of uniqueEntries) {
      try {
        const nodes = dom.querySelectorAll(entry.selector);
        for (const node of nodes) {
          const element = node as {
            dataset?: Record<string, string | undefined>;
            style?: { setProperty: (name: string, value: string, priority?: string) => void };
          };
          if (!element.dataset) {
            continue;
          }
          if (element.dataset.adascoutHighlight === "true") {
            continue;
          }
          highlighted += 1;
          element.dataset.adascoutHighlight = "true";
          element.dataset.adascoutHighlightIndex = String(entry.highlightId);
          if (
            getComputedStyle?.(element).position === "static" &&
            element.style?.setProperty
          ) {
            element.style.setProperty("position", "relative", "important");
          }
        }
      } catch {
        // Ignore invalid selectors emitted by engines.
      }
    }
    return highlighted;
  }, entries);
};

const collectFindingBoundingBoxes = async (
  page: {
    evaluate: <T>(
      fn: (entries: Array<HighlightEntry>) => T,
      arg: Array<HighlightEntry>,
    ) => Promise<T>;
  },
  entries: Array<HighlightEntry>,
): Promise<Map<number, { x: number; y: number; width: number; height: number }>> => {
  if (entries.length === 0) {
    return new Map();
  }
  const boxes = await page.evaluate((rawEntries) => {
    const dom = (globalThis as unknown as { document?: unknown }).document as
      | {
          querySelector: (selector: string) => {
            getBoundingClientRect: () => {
              left: number;
              top: number;
              width: number;
              height: number;
            };
          } | null;
        }
      | undefined;
    if (!dom) {
      return [];
    }
    const results: Array<{
      highlightId: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    for (const entry of rawEntries) {
      const selector = String(entry.selector || "").trim();
      const highlightId = Number(entry.highlightId || 0);
      if (!selector || highlightId <= 0) continue;
      try {
        const element = dom.querySelector(selector);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        const root = globalThis as unknown as { scrollX?: number; scrollY?: number };
        const x = rect.left + Number(root.scrollX ?? 0);
        const y = rect.top + Number(root.scrollY ?? 0);
        results.push({
          highlightId,
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
          width: Number.isFinite(rect.width) ? rect.width : 0,
          height: Number.isFinite(rect.height) ? rect.height : 0,
        });
      } catch {
        // Ignore invalid selectors or inaccessible elements.
      }
    }
    return results;
  }, entries);

  const map = new Map<number, { x: number; y: number; width: number; height: number }>();
  for (const box of boxes) {
    map.set(box.highlightId, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
  }
  return map;
};

type ImageAltPolicyResult = {
  missingAlt: Array<{ selector: string; htmlSnippet?: string }>;
  emptyAlt: Array<{ selector: string; htmlSnippet?: string }>;
};

const collectImageAltPolicyFindings = async (
  page: { evaluate: <T>(fn: () => T) => Promise<T> },
): Promise<ImageAltPolicyResult> =>
  await page.evaluate(() => {
    const dom = (globalThis as unknown as { document?: unknown }).document as
      | {
          querySelectorAll: (selector: string) => Iterable<unknown>;
        }
      | undefined;
    if (!dom) {
      return { missingAlt: [], emptyAlt: [] };
    }

    const cssEscape = (value: string): string =>
      value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");

    const toUniqueSelector = (
      node: {
        tagName?: string;
        id?: string;
        parentElement?: unknown;
        previousElementSibling?: unknown;
      },
    ): string => {
      const chain: string[] = [];
      let current = node as
        | {
            tagName?: string;
            id?: string;
            parentElement?: unknown;
            previousElementSibling?: unknown;
          }
        | undefined;
      let depth = 0;
      while (current && depth < 16) {
        const tag = String(current.tagName ?? "").toLowerCase();
        if (!tag) break;

        let siblingIndex = 1;
        let prev = current.previousElementSibling as
          | { tagName?: string; previousElementSibling?: unknown }
          | undefined;
        while (prev) {
          if (String(prev.tagName ?? "").toLowerCase() === tag) {
            siblingIndex += 1;
          }
          prev = prev.previousElementSibling as
            | { tagName?: string; previousElementSibling?: unknown }
            | undefined;
        }

        const id = String(current.id ?? "").trim();
        const part = id
          ? `${tag}#${cssEscape(id)}`
          : `${tag}:nth-of-type(${siblingIndex})`;
        chain.unshift(part);

        if (id) break;
        current = current.parentElement as
          | {
              tagName?: string;
              id?: string;
              parentElement?: unknown;
              previousElementSibling?: unknown;
            }
          | undefined;
        depth += 1;
      }
      return chain.join(" > ") || "img:nth-of-type(1)";
    };

    const normalize = (nodes: Iterable<unknown>) => {
      const results: Array<{ selector: string; htmlSnippet?: string }> = [];
      for (const node of Array.from(nodes)) {
        const element = node as {
          outerHTML?: string;
          getAttribute?: (name: string) => string | null;
          getClientRects?: () => { length: number };
          closest?: (selector: string) => unknown;
          tagName?: string;
          id?: string;
          className?: string;
        };
        if (!element.getClientRects || element.getClientRects().length === 0) {
          continue;
        }
        const role = element.getAttribute?.("role");
        const ariaHidden = element.getAttribute?.("aria-hidden");
        const isPresentation = role === "presentation" || role === "none";
        const isHidden =
          ariaHidden === "true" || Boolean(element.closest?.('[aria-hidden="true"]'));
        if (isPresentation || isHidden) {
          continue;
        }
        const snippet = String(element.outerHTML ?? "").slice(0, 2_000);
        const selector = toUniqueSelector(element);
        results.push({
          selector,
          ...(snippet ? { htmlSnippet: snippet } : {}),
        });
      }
      return results;
    };

    return {
      missingAlt: normalize(dom.querySelectorAll("img:not([alt])")),
      emptyAlt: normalize(dom.querySelectorAll('img[alt=""]')),
    };
  });

const runAxeScanAttempt = async (
  pageUrl: string,
  proxy: BrowserProxyConfig | null,
): Promise<PageScanResult> => {
  const attemptType = proxy ? "proxy" : "direct";
  const proxyServer = proxy?.server ?? null;
  const browser = await chromium.connectOverCDP(config.BROWSERLESS_CDP_URL);
  let fingerprintProfile: BrowserFingerprintProfile | null = null;
  if (config.SCANNER_FINGERPRINT_ENABLED) {
    try {
      fingerprintProfile = getFingerprintProfile();
    } catch (error) {
      console.warn(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "fingerprint_profile_failed_fallback",
          pageUrl,
          attemptType,
          reason: error instanceof Error ? error.message : String(error),
          phase: "generate",
        }),
      );
      fingerprintProfile = null;
    }
  }

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: fingerprintProfile?.viewport ?? { width: 1600, height: 1200 },
    userAgent:
      fingerprintProfile?.userAgent ??
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: config.SCANNER_FINGERPRINT_LOCALE,
    timezoneId: config.SCANNER_FINGERPRINT_TIMEZONE,
    ...(proxy ? { proxy } : {}),
  });
  if (fingerprintProfile) {
    try {
      await fingerprintInjector.attachFingerprintToPlaywright(
        context as unknown as Parameters<
          FingerprintInjector["attachFingerprintToPlaywright"]
        >[0],
        fingerprintProfile.fingerprint as unknown as Parameters<
          FingerprintInjector["attachFingerprintToPlaywright"]
        >[1],
      );
      console.info(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "fingerprint_profile_applied",
          pageUrl,
          attemptType,
          proxyServer,
          locale: config.SCANNER_FINGERPRINT_LOCALE,
          timezone: config.SCANNER_FINGERPRINT_TIMEZONE,
          viewport: fingerprintProfile.viewport,
        }),
      );
    } catch (error) {
      console.warn(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "fingerprint_profile_failed_fallback",
          pageUrl,
          attemptType,
          reason: error instanceof Error ? error.message : String(error),
          phase: "inject",
        }),
      );
    }
  }
  const page = await context.newPage();
  const scanResult: PageScanResult = {
    findings: [],
  };

  const navigateWithTimeoutFallback = async (
    stage: "first" | "retry",
  ): Promise<{ status: number; fallbackUsed: boolean }> => {
    try {
      const response = await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.SCANNER_PAGE_TIMEOUT_MS,
      });
      return {
        status: response?.status() ?? 0,
        fallbackUsed: false,
      };
    } catch (error) {
      if (classifyError(error) !== "timeout") {
        throw error;
      }
      console.warn(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "scan_navigation_timeout_fallback",
          pageUrl,
          attemptType,
          stage,
          timeoutMs: config.SCANNER_PAGE_TIMEOUT_MS,
          fallbackWaitUntil: "commit",
          originalError: error instanceof Error ? error.message : String(error),
        }),
      );
      const fallbackResponse = await page.goto(pageUrl, {
        waitUntil: "commit",
        timeout: Math.max(8_000, Math.min(20_000, config.SCANNER_PAGE_TIMEOUT_MS)),
      });
      await page.waitForLoadState("domcontentloaded", { timeout: 4_000 }).catch(() => undefined);
      return {
        status: fallbackResponse?.status() ?? 0,
        fallbackUsed: true,
      };
    }
  };

  try {
    console.info(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "scan_attempt_started",
        pageUrl,
        attemptType,
        proxyServer,
      }),
    );
    const firstNavigation = await navigateWithTimeoutFallback("first");
    const firstStatus = firstNavigation.status;
    const firstDiagnostics = await collectNavigationDiagnostics(page);
    console.info(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "scan_navigation_diagnostics",
        pageUrl,
        attemptType,
        stage: "first",
        status: firstStatus,
        fallbackUsed: firstNavigation.fallbackUsed,
        ...firstDiagnostics,
      }),
    );
    if (firstStatus === 401 || firstStatus === 403 || firstStatus === 429) {
      // One retry for transient bot/rate-limit gates.
      await page.waitForTimeout(1200);
      const retryNavigation = await navigateWithTimeoutFallback("retry");
      const retryStatus = retryNavigation.status;
      const retryDiagnostics = await collectNavigationDiagnostics(page);
      console.info(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "scan_navigation_diagnostics",
          pageUrl,
          attemptType,
          stage: "retry",
          status: retryStatus,
          fallbackUsed: retryNavigation.fallbackUsed,
          ...retryDiagnostics,
        }),
      );
      if (retryStatus === 401 || retryStatus === 403 || retryStatus === 429) {
        throw new Error(`bot_protection_http_${retryStatus}`);
      }
      if (retryStatus >= 400) {
        throw new Error(`http_status_${retryStatus}`);
      }
    } else if (firstStatus >= 400) {
      throw new Error(`http_status_${firstStatus}`);
    }
    if (config.SCANNER_SETTLE_MS > 0) {
      await page.waitForTimeout(config.SCANNER_SETTLE_MS);
    }
    const pageTitle = await page.title();
    const result = await new AxeBuilder({ page }).analyze();
    for (const violation of result.violations) {
      for (const node of violation.nodes) {
        const selector = node.target
          .map((targetValue: unknown) =>
            typeof targetValue === "string" ? targetValue : "",
          )
          .filter(Boolean)
          .join(" ")
          .slice(0, 512);
        const htmlSnippet = node.html?.slice(0, 2_000);
        scanResult.findings.push({
          source: "axe",
          severity: impactToSeverity(violation.impact),
          ruleId: violation.id,
          title: violation.help,
          description: node.failureSummary ?? violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          target: selector || undefined,
          selectorSnapshot: selector || undefined,
          pageUrl,
          codeSnippet: htmlSnippet,
          domSnippet: htmlSnippet,
          manualReviewRequired: false,
          confidence: 0.95,
          pageTitle: pageTitle || undefined,
          evidenceHash: createEvidenceKey(violation.id, selector, pageUrl),
        });
      }
    }
    const imageAltPolicy = await collectImageAltPolicyFindings(page);
    for (const finding of imageAltPolicy.missingAlt) {
      scanResult.findings.push({
        source: "axe",
        severity: "serious",
        ruleId: "policy.image-missing-alt",
        title: "Image missing alt attribute",
        description:
          "Image element does not include an alt attribute. Add meaningful alt text or alt=\"\" if decorative.",
        help:
          "Provide alt text for informative images. If decorative, explicitly set alt=\"\".",
        target: finding.selector,
        selectorSnapshot: finding.selector,
        pageUrl,
        codeSnippet: finding.htmlSnippet,
        domSnippet: finding.htmlSnippet,
        manualReviewRequired: true,
        confidence: 0.98,
        pageTitle: pageTitle || undefined,
        evidenceHash: createEvidenceKey("policy.image-missing-alt", finding.selector, pageUrl),
      });
    }
    for (const finding of imageAltPolicy.emptyAlt) {
      scanResult.findings.push({
        source: "axe",
        severity: "moderate",
        ruleId: "policy.image-empty-alt",
        title: "Image has empty alt text",
        description:
          "Image uses alt=\"\". Confirm it is truly decorative; otherwise provide descriptive alternative text.",
        help:
          "Use non-empty alt text for meaningful images; reserve empty alt for decorative content only.",
        target: finding.selector,
        selectorSnapshot: finding.selector,
        pageUrl,
        codeSnippet: finding.htmlSnippet,
        domSnippet: finding.htmlSnippet,
        manualReviewRequired: true,
        confidence: 0.9,
        pageTitle: pageTitle || undefined,
        evidenceHash: createEvidenceKey("policy.image-empty-alt", finding.selector, pageUrl),
      });
    }
    if (imageAltPolicy.missingAlt.length > 0 || imageAltPolicy.emptyAlt.length > 0) {
      console.info(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "scan_image_alt_policy_findings",
          pageUrl,
          missingAltCount: imageAltPolicy.missingAlt.length,
          emptyAltCount: imageAltPolicy.emptyAlt.length,
        }),
      );
    }

    for (const [index, finding] of scanResult.findings.entries()) {
      finding.highlightId = index + 1;
    }
    const regionBySelector = new Map<string, "header" | "footer" | "body">();
    for (const finding of scanResult.findings) {
      const selector = String(finding.selectorSnapshot ?? finding.target ?? "").trim();
      if (selector.length === 0) {
        finding.pageRegion = "body";
        continue;
      }
      const existingRegion = regionBySelector.get(selector);
      if (existingRegion) {
        finding.pageRegion = existingRegion;
        continue;
      }
      const region = await detectPageRegionForSelector(page, selector);
      regionBySelector.set(selector, region);
      finding.pageRegion = region;
    }
    const highlightEntries: Array<HighlightEntry> = scanResult.findings
      .map((finding) => ({
        selector: String(finding.selectorSnapshot ?? finding.target ?? "").trim(),
        highlightId: Number(finding.highlightId ?? 0),
      }))
      .filter((entry) => entry.selector.length > 0 && entry.highlightId > 0);

    try {
      const highlightedCount = await applyFindingHighlights(page, highlightEntries);
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

      const bboxByHighlightId = await collectFindingBoundingBoxes(page, highlightEntries);
      for (const finding of scanResult.findings) {
        if (!finding.highlightId) continue;
        const bbox = bboxByHighlightId.get(finding.highlightId);
        if (!bbox) continue;
        finding.bboxX = bbox.x;
        finding.bboxY = bbox.y;
        finding.bboxWidth = bbox.width;
        finding.bboxHeight = bbox.height;
        finding.screenshotViewportWidth = viewport.width;
        finding.screenshotViewportHeight = captureHeight;
      }

      const screenshotBuffer = await page.screenshot({
        type: "jpeg",
        quality: 70,
        animations: "disabled",
        caret: "hide",
      });
      scanResult.pageScreenshotStorageId = await uploadPageScreenshot(
        screenshotBuffer,
      );
      scanResult.pageScreenshotCapturedAt = Date.now();
      console.info(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "page_screenshot_captured",
          pageUrl,
          highlightedCount,
          totalPageHeight: screenshotPrep.totalHeight,
          contentBottom: screenshotPrep.contentBottom,
          appliedZoom: screenshotPrep.appliedZoom,
          captureHeight,
          findingCount: scanResult.findings.length,
        }),
      );
    } catch (error) {
      scanResult.screenshotErrorCategory = classifyError(error);
      scanResult.screenshotErrorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "page_screenshot_capture_failed",
          pageUrl,
          errorCategory: scanResult.screenshotErrorCategory,
          errorMessage: scanResult.screenshotErrorMessage,
        }),
      );
    }
    return scanResult;
  } catch (error) {
    console.warn(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "scan_attempt_failed",
        pageUrl,
        attemptType,
        proxyServer,
        errorCategory: classifyError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

const isBotProtectionError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const category = classifyError(error);
  return (
    message.includes("bot_protection_http_") ||
    category === "bot_protection" ||
    category === "timeout" ||
    category === "network"
  );
};

const runAxeScan = async (pageUrl: string): Promise<PageScanResult> => {
  if (config.SCANNER_PROXY_MODE === "always" && hasProxyConfig) {
    const proxy = pickProxy();
    console.info(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "scan_attempt_with_proxy",
        pageUrl,
        proxyEnabled: Boolean(proxy),
      }),
    );
    return await runAxeScanAttempt(pageUrl, proxy);
  }

  try {
    return await runAxeScanAttempt(pageUrl, null);
  } catch (error) {
    const shouldRetryWithProxy =
      config.SCANNER_PROXY_MODE === "fallback" &&
      hasProxyConfig &&
      isBotProtectionError(error);
    if (!shouldRetryWithProxy) {
      throw error;
    }
    const proxy = pickProxy();
    console.info(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "retry_with_proxy_after_bot_protection",
        pageUrl,
        originalError: error instanceof Error ? error.message : String(error),
        proxyEnabled: Boolean(proxy),
      }),
    );
    return await runAxeScanAttempt(pageUrl, proxy);
  }
};

const normalizeDiscoveredUrl = (rawUrl: string, origin: string): string | null => {
  try {
    const parsed = new URL(rawUrl, origin);
    if (parsed.origin !== origin) return null;
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    parsed.hash = "";
    parsed.pathname =
      parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return null;
  }
};

const DISCOVERY_STATIC_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".xml",
  ".txt",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".zip",
  ".gz",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".eps",
]);

const isLikelyHtmlDiscoveryUrl = (normalizedUrl: string): boolean => {
  try {
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith("/") || pathname === "") return true;
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex === -1) return true;
    const ext = pathname.slice(dotIndex);
    return !DISCOVERY_STATIC_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
};

const runDiscoveryAttempt = async (
  sourceUrl: string,
  maxUrls: number,
  proxy: BrowserProxyConfig | null,
): Promise<string[]> => {
  const browser = await chromium.connectOverCDP(config.BROWSERLESS_CDP_URL);
  let fingerprintProfile: BrowserFingerprintProfile | null = null;
  if (config.SCANNER_FINGERPRINT_ENABLED) {
    try {
      fingerprintProfile = getFingerprintProfile();
    } catch {
      fingerprintProfile = null;
    }
  }
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: fingerprintProfile?.viewport ?? { width: 1600, height: 1200 },
    userAgent:
      fingerprintProfile?.userAgent ??
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: config.SCANNER_FINGERPRINT_LOCALE,
    timezoneId: config.SCANNER_FINGERPRINT_TIMEZONE,
    ...(proxy ? { proxy } : {}),
  });
  if (fingerprintProfile) {
    await fingerprintInjector
      .attachFingerprintToPlaywright(
        context as unknown as Parameters<
          FingerprintInjector["attachFingerprintToPlaywright"]
        >[0],
        fingerprintProfile.fingerprint as unknown as Parameters<
          FingerprintInjector["attachFingerprintToPlaywright"]
        >[1],
      )
      .catch(() => undefined);
  }
  const page = await context.newPage();
  const discovered = new Set<string>();
  const queue: string[] = [];
  const visited = new Set<string>();
  try {
    const normalizedSeed = normalizeDiscoveredUrl(sourceUrl, new URL(sourceUrl).origin);
    if (!normalizedSeed) {
      return [];
    }
    const origin = new URL(normalizedSeed).origin;
    queue.push(normalizedSeed);
    discovered.add(normalizedSeed);
    while (queue.length > 0 && discovered.size < maxUrls) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      let response: Awaited<ReturnType<typeof page.goto>> | null = null;
      try {
        response = await page.goto(current, {
          waitUntil: "domcontentloaded",
          timeout: config.SCANNER_PAGE_TIMEOUT_MS,
        });
      } catch (error) {
        if (classifyError(error) !== "timeout") {
          // Some links are downloads or blocked navigations; skip and continue crawling.
          continue;
        }
        // Timeout fallback: still attempt to commit navigation so we can extract links.
        try {
          response = await page.goto(current, {
            waitUntil: "commit",
            timeout: Math.max(8_000, Math.min(20_000, config.SCANNER_PAGE_TIMEOUT_MS)),
          });
          await page.waitForLoadState("domcontentloaded", { timeout: 4_000 }).catch(() => undefined);
          console.info(
            JSON.stringify({
              component: "adascout-axe-worker",
              event: "discovery_navigation_timeout_fallback",
              sourceUrl,
              current,
            }),
          );
        } catch {
          continue;
        }
      }
      const status = response?.status() ?? 0;
      if (status >= 400) {
        continue;
      }
      if (config.SCANNER_SETTLE_MS > 0) {
        await page.waitForTimeout(config.SCANNER_SETTLE_MS);
      }
      const hrefs = await page.evaluate(() => {
        const doc = (globalThis as unknown as {
          document?: {
            querySelectorAll: (selector: string) => Iterable<unknown>;
          };
        }).document;
        if (!doc) return [] as string[];
        return Array.from(doc.querySelectorAll("a[href]"))
          .map((element) =>
            (element as { getAttribute?: (name: string) => string | null }).getAttribute?.(
              "href",
            ) ?? "",
          )
          .filter((value) => value.trim().length > 0);
      });
      for (const href of hrefs) {
        const normalized = normalizeDiscoveredUrl(href, origin);
        if (!normalized) continue;
        if (!isLikelyHtmlDiscoveryUrl(normalized)) continue;
        if (discovered.has(normalized)) continue;
        discovered.add(normalized);
        if (discovered.size >= maxUrls) break;
        if (!visited.has(normalized) && queue.length < maxUrls * 2) {
          queue.push(normalized);
        }
      }
    }
    return Array.from(discovered).slice(0, maxUrls);
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

const discoverWithBrowserless = async (sourceUrl: string, maxUrls: number): Promise<string[]> => {
  const boundedMax = Math.max(1, Math.min(500, maxUrls));
  if (config.SCANNER_PROXY_MODE === "always" && hasProxyConfig) {
    return await runDiscoveryAttempt(sourceUrl, boundedMax, pickProxy());
  }
  try {
    return await runDiscoveryAttempt(sourceUrl, boundedMax, null);
  } catch (error) {
    const shouldRetryWithProxy =
      config.SCANNER_PROXY_MODE === "fallback" &&
      hasProxyConfig &&
      isBotProtectionError(error);
    if (!shouldRetryWithProxy) {
      throw error;
    }
    return await runDiscoveryAttempt(sourceUrl, boundedMax, pickProxy());
  }
};

const processClaimedDiscoveryJob = async (
  claim: Exclude<WorkerTaskClaim, null> & { kind: "discovery" },
): Promise<boolean> => {
  try {
    const pageUrls = await discoverWithBrowserless(claim.sourceUrl, claim.maxUrls);
    await callAction<null>("scans:submitExternalDiscoveredPages", {
      workerToken: config.ADA_SCANNER_WORKER_TOKEN,
      jobId: claim.jobId,
      pageUrls,
    });
    console.info(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "external_discovery_completed",
        jobId: claim.jobId,
        sourceUrl: claim.sourceUrl,
        discoveredCount: pageUrls.length,
      }),
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await callAction<null>("scans:failExternalDiscoveryJob", {
      workerToken: config.ADA_SCANNER_WORKER_TOKEN,
      jobId: claim.jobId,
      errorMessage,
    }).catch(() => undefined);
    state.lastError = errorMessage;
    console.warn(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "external_discovery_failed",
        jobId: claim.jobId,
        sourceUrl: claim.sourceUrl,
        errorMessage,
      }),
    );
    return true;
  }
};

const processClaimedPage = async (
  claim: Exclude<WorkerTaskClaim, null> & { kind: "page" },
): Promise<boolean> => {
  const startedAt = Date.now();
  try {
    const scanResult = await runAxeScan(claim.pageUrl);
    if (scanResult.screenshotErrorMessage) {
      console.info(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "page_scan_completed_with_screenshot_error",
          pageUrl: claim.pageUrl,
          errorCategory: scanResult.screenshotErrorCategory ?? "unknown",
          errorMessage: scanResult.screenshotErrorMessage,
        }),
      );
    }
    await callAction<null>("scans:submitExternalPageFindings", {
      workerToken: config.ADA_SCANNER_WORKER_TOKEN,
      scanRunId: claim.scanRunId,
      pageRunId: claim.pageRunId,
      findings: scanResult.findings,
      extractLatencyMs: Date.now() - startedAt,
      pageScreenshotStorageId: scanResult.pageScreenshotStorageId,
      pageScreenshotCapturedAt: scanResult.pageScreenshotCapturedAt,
    });
    state.processedPages += 1;
    state.lastScanRunId = claim.scanRunId;
    return true;
  } catch (error) {
    state.failedPages += 1;
    state.lastError = error instanceof Error ? error.message : String(error);
    await callAction<null>("scans:failExternalPageScan", {
      workerToken: config.ADA_SCANNER_WORKER_TOKEN,
      pageRunId: claim.pageRunId,
      errorMessage: state.lastError,
      errorCategory: classifyError(error),
    }).catch(() => undefined);
    return true;
  }
};

const claimNextWorkerTask = async (): Promise<WorkerTaskClaim> => {
  return await callAction<WorkerTaskClaim>("scans:claimNextWorkerTask", {
    workerToken: config.ADA_SCANNER_WORKER_TOKEN,
    preferredScanRunId: state.lastScanRunId,
  });
};

const processOneDiscoveryJob = async (): Promise<boolean> => {
  const claim = await callAction<DiscoveryClaimResponse>(
    "scans:claimNextExternalDiscoveryJob",
    {
      workerToken: config.ADA_SCANNER_WORKER_TOKEN,
    },
  );
  if (!claim) return false;
  return await processClaimedDiscoveryJob({
    kind: "discovery",
    jobId: claim.jobId,
    assetId: claim.assetId,
    sourceUrl: claim.sourceUrl,
    maxUrls: claim.maxUrls,
  });
};

const processOnePage = async (): Promise<boolean> => {
  const claim = await callAction<ClaimResponse>("scans:claimNextPageForExternalScanner", {
    workerToken: config.ADA_SCANNER_WORKER_TOKEN,
  });
  if (!claim) return false;
  return await processClaimedPage({
    kind: "page",
    scanRunId: claim.scanRunId,
    pageRunId: claim.pageRunId,
    assetId: claim.assetId,
    pageUrl: claim.pageUrl,
    queueWaitMs: claim.queueWaitMs,
  });
};

const idleBackoffSequenceMs = [2_000, 5_000, 10_000, 30_000] as const;

const runWorkerLoopLegacy = async (workerIndex: number): Promise<void> => {
  while (true) {
    state.inFlight += 1;
    const didWork = await (async () => {
      const didDiscoveryWork = await processOneDiscoveryJob().catch((error) => {
        state.lastError = error instanceof Error ? error.message : String(error);
        return false;
      });
      if (didDiscoveryWork) return true;
      return await processOnePage().catch((error) => {
        state.lastError = error instanceof Error ? error.message : String(error);
        return false;
      });
    })();
    state.inFlight = Math.max(0, state.inFlight - 1);
    if (!didWork) {
      await sleep(config.SCANNER_IDLE_SLEEP_MS);
    }
    if (didWork) {
      await sleep(config.SCANNER_ACTIVE_PAUSE_MS);
    }
    if (workerIndex === 0) {
      const uptimeMs = Date.now() - state.startedAt;
      console.info(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "heartbeat",
          mode: "legacy_polling",
          uptimeMs,
          processedPages: state.processedPages,
          failedPages: state.failedPages,
          inFlight: state.inFlight,
          nullClaims: state.nullClaims,
        }),
      );
    }
  }
};

const runWorkerLoopWakeMode = async (workerIndex: number): Promise<void> => {
  let idleBackoffIndex = 0;
  let nextFallbackPollAt = Date.now();
  while (true) {
    const now = Date.now();
    const triggerByWake = state.wakePending;
    const triggerByFallback = now >= nextFallbackPollAt;
    if (!triggerByWake && !triggerByFallback) {
      const sleepMs = idleBackoffSequenceMs[Math.min(idleBackoffIndex, idleBackoffSequenceMs.length - 1)];
      await sleep(sleepMs);
      idleBackoffIndex = Math.min(idleBackoffIndex + 1, idleBackoffSequenceMs.length - 1);
      continue;
    }
    if (triggerByFallback) {
      state.fallbackPolls += 1;
      nextFallbackPollAt = now + config.SCANNER_FALLBACK_POLL_MS;
    }
    state.wakePending = false;
    state.drainCycles += 1;
    idleBackoffIndex = 0;

    let emptyClaims = 0;
    let didAnyWork = false;
    while (emptyClaims < config.SCANNER_DRAIN_EMPTY_THRESHOLD) {
      state.inFlight += 1;
      const task = await claimNextWorkerTask().catch((error) => {
        state.lastError = error instanceof Error ? error.message : String(error);
        return null;
      });
      state.inFlight = Math.max(0, state.inFlight - 1);
      if (!task) {
        emptyClaims += 1;
        state.nullClaims += 1;
        await sleep(config.SCANNER_DRAIN_EMPTY_SLEEP_MS);
        continue;
      }
      emptyClaims = 0;
      const didWork = await (task.kind === "discovery"
        ? processClaimedDiscoveryJob(task).catch((error) => {
            state.lastError = error instanceof Error ? error.message : String(error);
            return false;
          })
        : processClaimedPage(task).catch((error) => {
            state.lastError = error instanceof Error ? error.message : String(error);
            return false;
          }));
      if (didWork) {
        didAnyWork = true;
        await sleep(config.SCANNER_ACTIVE_PAUSE_MS);
      }
    }
    if (!didAnyWork) {
      const sleepMs = idleBackoffSequenceMs[Math.min(idleBackoffIndex, idleBackoffSequenceMs.length - 1)];
      await sleep(sleepMs);
      idleBackoffIndex = Math.min(idleBackoffIndex + 1, idleBackoffSequenceMs.length - 1);
    }
    if (workerIndex === 0) {
      const uptimeMs = Date.now() - state.startedAt;
      console.info(
        JSON.stringify({
          component: "adascout-axe-worker",
          event: "heartbeat",
          mode: "wake_drain",
          uptimeMs,
          processedPages: state.processedPages,
          failedPages: state.failedPages,
          inFlight: state.inFlight,
          wakePending: state.wakePending,
          fallbackPolls: state.fallbackPolls,
          wakeSignals: state.wakeSignals,
          drainCycles: state.drainCycles,
          nullClaims: state.nullClaims,
        }),
      );
    }
  }
};

const startHealthServer = () => {
  const server = createServer((req, res) => {
    const pathname = String(req.url ?? "").split("?")[0];
    if (pathname === "/wake" && req.method === "POST") {
      const expectedSecret = String(config.SCANNER_WAKE_SECRET ?? "").trim();
      const providedSecret = String(req.headers["x-ada-scanner-wake-secret"] ?? "").trim();
      if (expectedSecret.length > 0 && providedSecret !== expectedSecret) {
        res.statusCode = 401;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
        return;
      }
      state.wakePending = true;
      state.wakeSignals += 1;
      res.statusCode = 202;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, wakeSignals: state.wakeSignals }));
      return;
    }
    if (pathname !== "/healthz") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const payload = {
      ok: true,
      uptimeMs: Date.now() - state.startedAt,
      processedPages: state.processedPages,
      failedPages: state.failedPages,
      inFlight: state.inFlight,
      lastError: state.lastError ?? null,
      wakePending: state.wakePending,
      wakeSignals: state.wakeSignals,
      fallbackPolls: state.fallbackPolls,
      drainCycles: state.drainCycles,
      nullClaims: state.nullClaims,
      wakeModeEnabled: config.SCANNER_WAKE_MODE_ENABLED,
    };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(payload));
  });
  server.listen(config.SCANNER_HEALTH_PORT, () => {
    console.info(
      JSON.stringify({
        component: "adascout-axe-worker",
        event: "health_server_started",
        port: config.SCANNER_HEALTH_PORT,
      }),
    );
  });
};

const main = async () => {
  startHealthServer();
  console.info(
    JSON.stringify({
      component: "adascout-axe-worker",
      event: "worker_boot",
      wakeModeEnabled: config.SCANNER_WAKE_MODE_ENABLED,
      fallbackPollMs: config.SCANNER_FALLBACK_POLL_MS,
      drainEmptyThreshold: config.SCANNER_DRAIN_EMPTY_THRESHOLD,
      idleSleepMs: config.SCANNER_IDLE_SLEEP_MS,
      maxConcurrency: config.SCANNER_MAX_CONCURRENCY,
    }),
  );
  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < config.SCANNER_MAX_CONCURRENCY; i += 1) {
    workers.push(
      config.SCANNER_WAKE_MODE_ENABLED
        ? runWorkerLoopWakeMode(i)
        : runWorkerLoopLegacy(i),
    );
  }
  await Promise.all(workers);
};

void main();
