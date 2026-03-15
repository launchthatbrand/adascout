"use node";

/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable no-restricted-properties */
/* eslint-disable turbo/no-undeclared-env-vars */
import type { ComponentApi } from "@browserbasehq/convex-stagehand";
import type { GenericActionCtx } from "convex/server";
import { Stagehand } from "@browserbasehq/convex-stagehand";
import { v } from "convex/values";
import { z } from "zod";

import type { Id } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

interface NormalizedFinding {
  source: "axe" | "ibm" | "pdf" | "stagehand";
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  ruleId: string;
  title: string;
  description?: string;
  help?: string;
  helpUrl?: string;
  target?: string;
  pageUrl?: string;
  pageNumber?: number;
  codeSnippet?: string;
  manualReviewRequired?: boolean;
  confidence?: number;
  status?:
    | "open"
    | "in_progress"
    | "resolved"
    | "verified_on_rescan"
    | "regressed";
  resolvedAt?: number;
  verifiedAt?: number;
  assignee?: Id<"users">;
  dueAt?: number;
  resolutionNotes?: string;
  lastStateChangeAt?: number;
  evidenceHash?: string;
  domSnippet?: string;
  selectorSnapshot?: string;
  pageTitle?: string;
  capturedAt?: number;
  screenshotStorageId?: Id<"_storage">;
}

interface ScanRunProcessingSnapshot {
  scanRun: {
    _id: Id<"scanRuns">;
    assetId: Id<"assets">;
    profile: "wcag_2_2_aa";
    createdBy: Id<"users">;
  };
  asset: {
    kind: "url" | "file_pdf";
    normalizedUrl?: string;
  };
}

interface ScanRunPageProcessingSnapshot {
  scanRun: {
    _id: Id<"scanRuns">;
    assetId: Id<"assets">;
  };
  pageRun: {
    _id: Id<"scanRunPages">;
    pageUrl: string;
    createdAt: number;
  };
}

interface StagehandRuntimeConfig {
  stagehand: Stagehand;
  stagehandModelName: string;
}

const SEVERITY_WEIGHT: Record<NormalizedFinding["severity"], number> = {
  critical: 5,
  serious: 4,
  moderate: 3,
  minor: 2,
  info: 1,
};

const nowMs = () => Date.now();

const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

export const withTimeout = async <T>(
  label: string,
  ms: number,
  fn: () => Promise<T>,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const withRetry = async <T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 2,
): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(400 * attempt);
      }
    }
  }
  throw new Error(
    `${label} failed after ${attempts} attempt(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
};

const logScanPhase = (payload: Record<string, unknown>) => {
  console.info(
    JSON.stringify({
      component: "adascout-scan",
      ...payload,
    }),
  );
};

const computeSummary = (findings: NormalizedFinding[]) => {
  const summary = {
    total: findings.length,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    info: 0,
    manualReviewRequired: 0,
  };
  for (const finding of findings) {
    summary[finding.severity] += 1;
    if (finding.manualReviewRequired) {
      summary.manualReviewRequired += 1;
    }
  }
  return summary;
};

const severityFromAxeImpact = (
  impact: unknown,
): NormalizedFinding["severity"] => {
  switch (impact) {
    case "critical":
      return "critical";
    case "serious":
      return "serious";
    case "moderate":
      return "moderate";
    case "minor":
      return "minor";
    default:
      return "info";
  }
};

const normalizeStagehandSeverity = (
  value: unknown,
): NormalizedFinding["severity"] => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "serious" || normalized === "high") return "serious";
  if (normalized === "moderate" || normalized === "medium") return "moderate";
  if (normalized === "minor" || normalized === "low") return "minor";
  return "info";
};

const STAGEHAND_FALLBACK_HINT =
  "Set BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, and GEMINI_API_KEY (or GEMENI_API_KEY) in Convex env vars.";
const DEFAULT_LEASE_KEY = "browserbase";
const DEFAULT_MAX_CONCURRENT_SESSIONS = 1;
const DEFAULT_PAGES_PER_SESSION = 10;
const DEFAULT_LEASE_TTL_MS = 120_000;

const parsePositiveIntEnv = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const computeEvidenceHash = (args: {
  source: "axe" | "ibm" | "pdf" | "stagehand";
  ruleId: string;
  target?: string;
  pageUrl?: string;
  codeSnippet?: string;
}) =>
  [
    args.source,
    args.ruleId,
    args.target ?? "",
    args.pageUrl ?? "",
    args.codeSnippet ?? "",
  ]
    .join("|")
    .toLowerCase();

const categorizeScanError = (error: unknown): string => {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  if (message.includes("timed out")) return "timeout";
  if (message.includes("429")) return "rate_limit";
  if (message.includes("401") || message.includes("unauthorized"))
    return "auth";
  if (message.includes("invalid provider")) return "provider";
  if (message.includes("fetch")) return "network";
  if (message.includes("schema")) return "schema";
  return "unknown";
};

const isStagehandSessionLimitError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("stagehand api error (429)") ||
    normalized.includes("max concurrent sessions limit")
  );
};

const getSessionRuntimeConfig = (): {
  planTier: "free" | "paid";
  maxConcurrentSessions: number;
  pagesPerSession: number;
  leaseTtlMs: number;
  leaseAcquireTimeoutMs: number;
} => {
  const planTier =
    (process.env.SCANNER_PLAN_TIER ?? "free").toLowerCase() === "paid"
      ? "paid"
      : "free";
  const configuredConcurrent = parsePositiveIntEnv(
    process.env.SCANNER_MAX_CONCURRENT_SESSIONS,
    DEFAULT_MAX_CONCURRENT_SESSIONS,
  );
  return {
    planTier,
    maxConcurrentSessions:
      planTier === "free" ? 1 : Math.max(1, configuredConcurrent),
    pagesPerSession: parsePositiveIntEnv(
      process.env.SCANNER_PAGES_PER_SESSION,
      DEFAULT_PAGES_PER_SESSION,
    ),
    leaseTtlMs: parsePositiveIntEnv(
      process.env.SCANNER_LEASE_TTL_MS,
      DEFAULT_LEASE_TTL_MS,
    ),
    leaseAcquireTimeoutMs: parsePositiveIntEnv(
      process.env.SCANNER_LEASE_ACQUIRE_TIMEOUT_MS,
      45_000,
    ),
  };
};

const startSharedSessionWithRetry = async (
  ctx: GenericActionCtx<any>,
  stagehand: Stagehand,
  pageUrl: string,
): Promise<string> => {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const session = await stagehand.startSession(ctx, {
        url: pageUrl,
        options: { waitUntil: "domcontentloaded", timeout: 45_000 },
      });
      return session.sessionId;
    } catch (error) {
      if (!isStagehandSessionLimitError(error) || attempt === maxAttempts) {
        throw error;
      }
      const backoffMs = Math.min(10_000, 1_500 * attempt);
      logScanPhase({
        event: "session_start_retry",
        pageUrl,
        attempt,
        backoffMs,
        reason: "browserbase_concurrency_limit",
      });
      await sleep(backoffMs);
    }
  }
  throw new Error("Unable to start shared Stagehand session after retries.");
};

const getStagehandConfigForRuntime = (): StagehandRuntimeConfig | null => {
  const stagehandComponent = (components as unknown as { stagehand?: unknown })
    .stagehand;
  const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
  const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;
  const geminiApiKey =
    process.env.GEMINI_API_KEY ??
    process.env.GEMENI_API_KEY ??
    process.env.GOOGLE_API_KEY;
  const stagehandModelName =
    process.env.STAGEHAND_MODEL_NAME ?? "google/gemini-2.5-flash";
  if (
    !stagehandComponent ||
    !browserbaseApiKey ||
    !browserbaseProjectId ||
    !geminiApiKey
  ) {
    return null;
  }
  return {
    stagehand: new Stagehand(stagehandComponent as ComponentApi, {
      browserbaseApiKey,
      browserbaseProjectId,
      modelApiKey: geminiApiKey,
      modelName: stagehandModelName,
    }),
    stagehandModelName,
  };
};

const normalizeStagehandExtractedFindings = (
  extracted: unknown,
  url: string,
): NormalizedFinding[] => {
  const rawItems = Array.isArray((extracted as { findings?: unknown }).findings)
    ? ((extracted as { findings?: unknown[] }).findings ?? [])
    : Array.isArray(extracted)
      ? extracted
      : [];

  const findings: Array<NormalizedFinding> = rawItems.map((item, index) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const title =
      (typeof record.title === "string" && record.title.trim().length > 0
        ? record.title
        : undefined) ??
      (typeof record.finding === "string" && record.finding.trim().length > 0
        ? record.finding
        : undefined) ??
      "Accessibility finding";
    const description =
      typeof record.description === "string"
        ? record.description
        : typeof record.finding === "string"
          ? record.finding
          : undefined;
    const ruleId =
      (typeof record.ruleId === "string" && record.ruleId.trim().length > 0
        ? record.ruleId
        : undefined) ?? `stagehand.issue.${index + 1}`;
    const target =
      (typeof record.selector === "string" && record.selector.trim().length > 0
        ? record.selector
        : undefined) ??
      (typeof record.target === "string" && record.target.trim().length > 0
        ? record.target
        : undefined);

    return {
      source: "stagehand" as const,
      severity: normalizeStagehandSeverity(record.severity),
      ruleId,
      title,
      description,
      target,
      helpUrl: typeof record.helpUrl === "string" ? record.helpUrl : undefined,
      pageUrl: url,
      manualReviewRequired: true,
      confidence: 0.75,
      status: "open",
      lastStateChangeAt: nowMs(),
      capturedAt: nowMs(),
      selectorSnapshot: target,
      domSnippet:
        typeof record.description === "string" ? record.description : undefined,
      pageTitle:
        typeof record.pageTitle === "string" ? record.pageTitle : undefined,
      evidenceHash: computeEvidenceHash({
        source: "stagehand",
        ruleId,
        target,
        pageUrl: url,
        codeSnippet:
          typeof record.description === "string"
            ? record.description
            : undefined,
      }),
    };
  });

  return findings.sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
  );
};

const buildStagehandErrorFinding = (
  message: string,
  url: string,
  stagehandModelName: string,
): NormalizedFinding => {
  const invalidProvider = message.toLowerCase().includes("invalid provider");
  const unauthorized =
    message.includes("(401)") ||
    message.toLowerCase().includes("401 unauthorized");
  return {
    source: "stagehand",
    severity: "info",
    ruleId: invalidProvider
      ? "scanner.stagehand.invalid_provider"
      : unauthorized
        ? "scanner.stagehand.unauthorized"
        : "scanner.stagehand.unavailable",
    title: invalidProvider
      ? "Stagehand provider configuration is invalid"
      : unauthorized
        ? "Stagehand authentication failed"
        : "Stagehand scan could not execute",
    description: invalidProvider
      ? `Stagehand rejected model provider for modelName '${stagehandModelName}'.`
      : unauthorized
        ? `Stagehand returned 401 Unauthorized. Verify BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, and GEMINI_API_KEY (or GEMENI_API_KEY) are valid and belong to the same Browserbase/Stagehand setup. modelName='${stagehandModelName}'.`
        : message,
    pageUrl: url,
    manualReviewRequired: true,
    confidence: 0.2,
  };
};

const stagehandFindingSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.string(),
      ruleId: z.string().optional(),
      title: z.string().optional(),
      finding: z.string().optional(),
      description: z.string().optional(),
      selector: z.string().optional(),
      target: z.string().optional(),
      helpUrl: z.string().optional(),
    }),
  ),
});

const _normalizeAxeFindings = (
  input: unknown,
  pageUrl: string,
): NormalizedFinding[] => {
  const payload = input as { violations?: Array<Record<string, unknown>> };
  const violations = Array.isArray(payload?.violations)
    ? payload.violations
    : [];
  const findings: NormalizedFinding[] = [];
  for (const violation of violations) {
    const nodes = Array.isArray(violation.nodes) ? violation.nodes : [];
    if (nodes.length === 0) {
      findings.push({
        source: "axe",
        severity: severityFromAxeImpact(violation.impact),
        ruleId: String(violation.id ?? "axe.rule"),
        title: String(violation.help ?? violation.id ?? "Accessibility issue"),
        description:
          typeof violation.description === "string"
            ? violation.description
            : undefined,
        help: typeof violation.help === "string" ? violation.help : undefined,
        helpUrl:
          typeof violation.helpUrl === "string" ? violation.helpUrl : undefined,
        pageUrl,
        status: "open",
        lastStateChangeAt: nowMs(),
        capturedAt: nowMs(),
        evidenceHash: computeEvidenceHash({
          source: "axe",
          ruleId: String(violation.id ?? "axe.rule"),
          pageUrl,
        }),
      });
      continue;
    }
    for (const node of nodes) {
      findings.push({
        source: "axe",
        severity: severityFromAxeImpact(violation.impact),
        ruleId: String(violation.id ?? "axe.rule"),
        title: String(violation.help ?? violation.id ?? "Accessibility issue"),
        description:
          typeof violation.description === "string"
            ? violation.description
            : undefined,
        help: typeof violation.help === "string" ? violation.help : undefined,
        helpUrl:
          typeof violation.helpUrl === "string" ? violation.helpUrl : undefined,
        target: Array.isArray((node as { target?: unknown[] }).target)
          ? String((node as { target?: unknown[] }).target?.[0] ?? "")
          : undefined,
        codeSnippet:
          typeof (node as { html?: unknown }).html === "string"
            ? String((node as { html?: unknown }).html)
            : undefined,
        pageUrl,
        confidence: 0.95,
        status: "open",
        lastStateChangeAt: nowMs(),
        capturedAt: nowMs(),
        selectorSnapshot: Array.isArray((node as { target?: unknown[] }).target)
          ? String((node as { target?: unknown[] }).target?.[0] ?? "")
          : undefined,
        domSnippet:
          typeof (node as { html?: unknown }).html === "string"
            ? String((node as { html?: unknown }).html)
            : undefined,
        evidenceHash: computeEvidenceHash({
          source: "axe",
          ruleId: String(violation.id ?? "axe.rule"),
          target: Array.isArray((node as { target?: unknown[] }).target)
            ? String((node as { target?: unknown[] }).target?.[0] ?? "")
            : undefined,
          pageUrl,
          codeSnippet:
            typeof (node as { html?: unknown }).html === "string"
              ? String((node as { html?: unknown }).html)
              : undefined,
        }),
      });
    }
  }
  return findings;
};

const _normalizeIbmFindings = (
  input: unknown,
  pageUrl: string,
): NormalizedFinding[] => {
  const output: NormalizedFinding[] = [];
  const maybeReport = (input as { report?: unknown })?.report ?? input;
  const results = (maybeReport as { results?: unknown[] })?.results;
  if (!Array.isArray(results)) {
    return output;
  }
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const rawPath = (result as { path?: unknown[] }).path;
    const nodes: unknown[] = Array.isArray(rawPath) ? rawPath : [];
    const firstTarget = nodes[0];
    const level = String(
      (result as { level?: unknown }).level ?? "",
    ).toLowerCase();
    const severity: NormalizedFinding["severity"] = level.includes("violation")
      ? "serious"
      : level.includes("recommendation")
        ? "minor"
        : "info";
    output.push({
      source: "ibm",
      severity,
      ruleId: String((result as { ruleId?: unknown }).ruleId ?? "ibm.rule"),
      title: String(
        (result as { message?: unknown }).message ??
          (result as { ruleId?: unknown }).ruleId ??
          "Accessibility finding",
      ),
      description:
        typeof (result as { reasonId?: unknown }).reasonId === "string"
          ? String((result as { reasonId?: unknown }).reasonId)
          : undefined,
      target: typeof firstTarget === "string" ? String(firstTarget) : undefined,
      pageUrl,
      confidence: 0.85,
      status: "open",
      lastStateChangeAt: nowMs(),
      capturedAt: nowMs(),
      selectorSnapshot:
        typeof firstTarget === "string" ? String(firstTarget) : undefined,
      evidenceHash: computeEvidenceHash({
        source: "ibm",
        ruleId: String((result as { ruleId?: unknown }).ruleId ?? "ibm.rule"),
        target:
          typeof firstTarget === "string" ? String(firstTarget) : undefined,
        pageUrl,
      }),
    });
  }
  return output;
};

const scanWebsite = async (
  ctx: GenericActionCtx<any>,
  url: string,
): Promise<NormalizedFinding[]> => {
  const startedAt = nowMs();
  logScanPhase({ event: "analysis_start", pageUrl: url, engine: "stagehand" });
  const runtime = getStagehandConfigForRuntime();
  if (!runtime) {
    return [
      {
        source: "stagehand",
        severity: "info",
        ruleId: "scanner.stagehand.unconfigured",
        title: "Stagehand scanner is not configured",
        description: STAGEHAND_FALLBACK_HINT,
        pageUrl: url,
        manualReviewRequired: true,
        confidence: 0.2,
      },
    ];
  }
  const { stagehand, stagehandModelName } = runtime;

  try {
    logScanPhase({ event: "analysis_stagehand_extract_start", pageUrl: url });
    const extracted = await withTimeout(
      "Stagehand accessibility extract",
      90_000,
      async () =>
        stagehand.extract(ctx, {
          url,
          instruction:
            "Audit this page for WCAG 2.2 AA issues. Return concise findings with severity and selector.",
          schema: stagehandFindingSchema,
          options: { waitUntil: "domcontentloaded", timeout: 45_000 },
        }),
    );
    const sorted = normalizeStagehandExtractedFindings(extracted, url);
    logScanPhase({
      event: "analysis_stagehand_extract_complete",
      pageUrl: url,
      findingCount: sorted.length,
      durationMs: nowMs() - startedAt,
    });
    return sorted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logScanPhase({
      event: "analysis_stagehand_extract_failed",
      pageUrl: url,
      errorMessage: message,
    });
    const finding = buildStagehandErrorFinding(
      message,
      url,
      stagehandModelName,
    );
    return [finding];
  }
};

const scanWebsiteUsingExistingSession = async (
  ctx: GenericActionCtx<any>,
  stagehand: Stagehand,
  stagehandModelName: string,
  sessionId: string,
  url: string,
): Promise<NormalizedFinding[]> => {
  const startedAt = nowMs();
  logScanPhase({
    event: "analysis_stagehand_extract_start",
    pageUrl: url,
    sessionMode: "shared",
  });
  try {
    const extracted = await withTimeout(
      "Stagehand session extract",
      90_000,
      async () =>
        stagehand.extract(ctx, {
          sessionId,
          url,
          instruction:
            "Audit this page for WCAG 2.2 AA issues. Return concise findings with severity and selector.",
          schema: stagehandFindingSchema,
          options: { waitUntil: "domcontentloaded", timeout: 45_000 },
        }),
    );
    const sorted = normalizeStagehandExtractedFindings(extracted, url);
    logScanPhase({
      event: "analysis_stagehand_extract_complete",
      pageUrl: url,
      findingCount: sorted.length,
      durationMs: nowMs() - startedAt,
      sessionMode: "shared",
    });
    return sorted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logScanPhase({
      event: "analysis_stagehand_extract_failed",
      pageUrl: url,
      errorMessage: message,
      sessionMode: "shared",
    });
    return [buildStagehandErrorFinding(message, url, stagehandModelName)];
  }
};

export const normalizeUrlForCrawl = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    if (url.pathname.endsWith("/") && url.pathname !== "/") {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return null;
  }
};

const STATIC_ASSET_EXTENSIONS = new Set([
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
]);

export const isLikelyHtmlPageUrl = (normalizedUrl: string): boolean => {
  try {
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname.toLowerCase();
    const query = parsed.searchParams;
    if (
      pathname.endsWith("/feed") ||
      pathname.endsWith("/comments/feed") ||
      pathname.startsWith("/feed/") ||
      pathname.startsWith("/wp-json") ||
      pathname.endsWith("/xmlrpc.php")
    ) {
      return false;
    }
    if (query.has("ical") || query.has("rsd") || query.has("feed")) {
      return false;
    }
    if (pathname.endsWith("/") || pathname === "") return true;
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex === -1) return true;
    const ext = pathname.slice(dotIndex);
    return !STATIC_ASSET_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
};

export const extractXmlLocs = (xml: string): string[] => {
  const matches = Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi));
  return matches
    .map((match) => match[1] ?? "")
    .filter((value) => value.length > 0);
};

export const extractInternalLinks = (
  html: string,
  origin: string,
): string[] => {
  const hrefMatches = Array.from(
    html.matchAll(/href\s*=\s*["']([^"']+)["']/gi),
  );
  const urls: string[] = [];
  for (const match of hrefMatches) {
    const href = match[1] ?? "";
    if (
      !href ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("#")
    ) {
      continue;
    }
    try {
      const resolved = new URL(href, origin);
      if (resolved.origin !== origin) continue;
      const normalized = normalizeUrlForCrawl(resolved.toString());
      if (normalized) urls.push(normalized);
    } catch {
      // Ignore malformed links
    }
  }
  return urls;
};

export const discoverWebsiteUrls = async (
  seedUrl: string,
  maxUrls: number,
): Promise<Array<string>> => {
  const normalizedSeed = normalizeUrlForCrawl(seedUrl);
  if (!normalizedSeed) return [];
  const seed = new URL(normalizedSeed);
  const origin = seed.origin;
  const discovered = new Set<string>([normalizedSeed]);

  // Sitemap-first discovery.
  const sitemapCandidates = [`${origin}/sitemap.xml`];
  try {
    const robotsResponse = await withTimeout(
      "robots.txt fetch",
      10_000,
      async () =>
        withRetry(
          "robots.txt fetch",
          async () => fetch(`${origin}/robots.txt`),
          1,
        ),
    );
    if (robotsResponse.ok) {
      const robots = await robotsResponse.text();
      const lines = robots
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.toLowerCase().startsWith("sitemap:"));
      for (const line of lines) {
        const sitemapUrl = line.slice("sitemap:".length).trim();
        if (sitemapUrl) sitemapCandidates.push(sitemapUrl);
      }
    }
  } catch {
    // robots.txt is best-effort
  }

  for (const sitemapUrl of sitemapCandidates) {
    if (discovered.size >= maxUrls) break;
    try {
      const response = await withTimeout("sitemap fetch", 12_000, async () =>
        withRetry("sitemap fetch", async () => fetch(sitemapUrl), 1),
      );
      if (!response.ok) continue;
      const xml = await response.text();
      for (const loc of extractXmlLocs(xml)) {
        const normalized = normalizeUrlForCrawl(loc);
        if (!normalized) continue;
        const parsed = new URL(normalized);
        if (parsed.origin !== origin) continue;
        discovered.add(normalized);
        if (discovered.size >= maxUrls) break;
      }
    } catch {
      // Ignore sitemap failures
    }
  }

  // Crawl fallback when sitemap has too few links.
  const queue: string[] = [normalizedSeed];
  const visited = new Set<string>();
  while (queue.length > 0 && discovered.size < maxUrls) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    try {
      const response = await withTimeout("crawl page fetch", 10_000, async () =>
        withRetry("crawl page fetch", async () => fetch(current), 1),
      );
      if (!response.ok) continue;
      const html = await response.text();
      const links = extractInternalLinks(html, origin);
      for (const link of links) {
        if (!discovered.has(link)) {
          discovered.add(link);
          if (discovered.size >= maxUrls) break;
        }
        if (!visited.has(link) && queue.length < maxUrls * 2) {
          queue.push(link);
        }
      }
    } catch {
      // Ignore individual crawl page failure
    }
  }

  return Array.from(discovered).filter(isLikelyHtmlPageUrl).slice(0, maxUrls);
};

const scanPdfFromFileUrl = async (
  fileUrl: string,
): Promise<NormalizedFinding[]> => {
  const response = await withTimeout("PDF fetch", 30_000, async () =>
    withRetry("PDF fetch", async () => fetch(fileUrl)),
  );
  if (!response.ok) {
    throw new Error(`Failed to load PDF bytes (${response.status}).`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pdfjs = (await import("pdfjs-dist")) as {
    getDocument: (args: { data: Uint8Array }) => any;
  };
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const document = await loadingTask.promise;

  const findings: NormalizedFinding[] = [];
  for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex += 1) {
    const page = await document.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const textItems = Array.isArray(textContent.items) ? textContent.items : [];
    if (textItems.length === 0) {
      findings.push({
        source: "pdf",
        severity: "serious",
        ruleId: "pdf.text_layer.missing",
        title: `Page ${pageIndex} appears image-only`,
        description: "No text layer detected for this PDF page.",
        pageNumber: pageIndex,
        manualReviewRequired: true,
        confidence: 0.9,
        status: "open",
        lastStateChangeAt: nowMs(),
        capturedAt: nowMs(),
        evidenceHash: computeEvidenceHash({
          source: "pdf",
          ruleId: "pdf.text_layer.missing",
          target: `page:${String(pageIndex)}`,
        }),
      });
    }
  }
  if (document.numPages > 0 && findings.length === 0) {
    findings.push({
      source: "pdf",
      severity: "info",
      ruleId: "pdf.scan.completed",
      title: "PDF parsed successfully",
      description:
        "No immediate text-layer red flags were detected automatically.",
      manualReviewRequired: true,
      confidence: 0.4,
      status: "open",
      lastStateChangeAt: nowMs(),
      capturedAt: nowMs(),
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.scan.completed",
      }),
    });
  }
  return findings;
};

export const processScanRun = internalAction({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const isCanceledBeforeStart = await ctx.runQuery(
      internal.scans.isScanRunCanceled,
      {
        scanRunId: args.scanRunId,
      },
    );
    if (isCanceledBeforeStart) {
      return null;
    }
    const processing = await ctx.runQuery(
      internal.scans.getScanRunForProcessing,
      {
        scanRunId: args.scanRunId,
      },
    );
    if (!processing) {
      return null;
    }
    const { scanRun, asset } = processing;
    const now = nowMs();
    await ctx.runMutation(internal.scans.markScanRunning, {
      scanRunId: scanRun._id,
      startedAt: now,
    });

    try {
      const findings: NormalizedFinding[] = [];
      if (asset.kind === "url" && asset.normalizedUrl) {
        findings.push(...(await scanWebsite(ctx, asset.normalizedUrl)));
      } else if (asset.kind === "file_pdf" && asset.storageId) {
        const fileUrl = await ctx.runQuery(internal.scans.getAssetStorageUrl, {
          assetId: asset._id,
        });
        if (!fileUrl) {
          throw new Error("Unable to access stored PDF.");
        }
        findings.push(...(await scanPdfFromFileUrl(fileUrl)));
      } else {
        findings.push({
          source: "pdf",
          severity: "info",
          ruleId: "asset.invalid",
          title: "Asset is not scannable",
          description: "The selected asset is missing required scan metadata.",
          manualReviewRequired: true,
          confidence: 0.1,
        });
      }

      const canceledBeforePersist = await ctx.runQuery(
        internal.scans.isScanRunCanceled,
        {
          scanRunId: scanRun._id,
        },
      );
      if (canceledBeforePersist) {
        return null;
      }

      await ctx.runMutation(internal.scans.replaceFindingsForRun, {
        scanRunId: scanRun._id,
        assetId: asset._id,
        findings,
      });

      const completedAt = nowMs();
      await ctx.runMutation(internal.scans.completeScanRun, {
        scanRunId: scanRun._id,
        completedAt,
        findingCount: findings.length,
      });

      const summary = computeSummary(findings);
      const markdown = [
        `# ADA Scout Report`,
        ``,
        `- Asset: ${asset.title ?? asset.sourceUrl ?? asset.filename ?? String(asset._id)}`,
        `- Profile: ${scanRun.profile}`,
        `- Generated: ${new Date(completedAt).toISOString()}`,
        ``,
        `## Summary`,
        `- Total: ${summary.total}`,
        `- Critical: ${summary.critical}`,
        `- Serious: ${summary.serious}`,
        `- Moderate: ${summary.moderate}`,
        `- Minor: ${summary.minor}`,
        `- Info: ${summary.info}`,
        `- Manual review required: ${summary.manualReviewRequired}`,
      ].join("\n");

      await ctx.runMutation(internal.reports.upsertReportForScanRun, {
        assetId: asset._id,
        scanRunId: scanRun._id,
        generatedBy: scanRun.createdBy,
        profile: scanRun.profile,
        generatedAt: completedAt,
        summary,
        markdown,
        json: JSON.stringify(
          {
            summary,
            findings,
          },
          null,
          2,
        ),
      });
    } catch (error) {
      await ctx.runMutation(internal.scans.failScanRun, {
        scanRunId: scanRun._id,
        failedAt: nowMs(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  },
});

export const discoverAndQueueSitePages = internalAction({
  args: {
    scanRunId: v.id("scanRuns"),
    maxUrls: v.optional(v.number()),
    pageUrls: v.optional(v.array(v.string())),
  },
  returns: v.object({
    totalDiscovered: v.number(),
  }),
  handler: async (ctx, args): Promise<{ totalDiscovered: number }> => {
    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "discover_start",
        scanRunId: args.scanRunId,
        maxUrls: args.maxUrls ?? 100,
        pageUrlsFilter: args.pageUrls?.length ?? 0,
      }),
    );
    const processing = (await ctx.runQuery(
      internal.scans.getScanRunForProcessing,
      {
        scanRunId: args.scanRunId,
      },
    )) as ScanRunProcessingSnapshot | null;
    if (!processing) {
      throw new Error("Scan run not found.");
    }
    const { scanRun, asset } = processing;
    if (asset.kind !== "url" || !asset.normalizedUrl) {
      throw new Error("Asset is not a website URL.");
    }

    let pageUrls: string[];
    if (args.pageUrls && args.pageUrls.length > 0) {
      pageUrls = args.pageUrls;
    } else {
      const maxUrls = Math.max(1, Math.min(500, Number(args.maxUrls ?? 100)));
      pageUrls = await discoverWebsiteUrls(asset.normalizedUrl, maxUrls);
    }
    if (pageUrls.length === 0) {
      throw new Error("No crawlable URLs discovered.");
    }

    const result = (await ctx.runMutation(internal.scans.upsertScanRunPages, {
      scanRunId: scanRun._id,
      assetId: scanRun.assetId,
      createdBy: scanRun.createdBy,
      pageUrls,
    })) as { totalPages: number };
    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "discover_complete",
        scanRunId: args.scanRunId,
        discoveredUrls: pageUrls.length,
        totalPages: result.totalPages,
      }),
    );
    return {
      totalDiscovered: result.totalPages,
    };
  },
});

export const scanQueuedPage = internalAction({
  args: {
    scanRunId: v.id("scanRuns"),
    pageRunId: v.id("scanRunPages"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const isCanceled = await ctx.runQuery(internal.scans.isScanRunCanceled, {
      scanRunId: args.scanRunId,
    });
    if (isCanceled) return null;
    const processing = (await ctx.runQuery(
      internal.scans.getScanRunPageForProcessing,
      args,
    )) as ScanRunPageProcessingSnapshot | null;
    if (!processing) return null;
    const { scanRun, pageRun } = processing;
    const queueWaitMs = Math.max(0, nowMs() - pageRun.createdAt);
    const claimed = await ctx.runMutation(
      internal.scans.claimScanRunPageForExecution,
      {
        scanRunId: scanRun._id,
        pageRunId: pageRun._id,
        queueWaitMs,
      },
    );
    if (!claimed) {
      console.info(
        JSON.stringify({
          component: "adascout-scan",
          event: "page_scan_skip_already_claimed",
          scanRunId: scanRun._id,
          pageRunId: pageRun._id,
          pageUrl: pageRun.pageUrl,
        }),
      );
      return null;
    }
    const startedAt = nowMs();
    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "page_scan_start",
        scanRunId: scanRun._id,
        pageRunId: pageRun._id,
        pageUrl: pageRun.pageUrl,
      }),
    );
    try {
      const findings = await scanWebsite(ctx, pageRun.pageUrl);
      await ctx.runMutation(internal.scans.replaceFindingsForPage, {
        scanRunId: scanRun._id,
        scanRunPageId: pageRun._id,
        assetId: scanRun.assetId,
        findings,
      });
      await ctx.runMutation(internal.scans.completeScanRunPage, {
        pageRunId: pageRun._id,
        findingCount: findings.length,
        extractLatencyMs: nowMs() - startedAt,
      });
      console.info(
        JSON.stringify({
          component: "adascout-scan",
          event: "page_scan_complete",
          scanRunId: scanRun._id,
          pageRunId: pageRun._id,
          pageUrl: pageRun.pageUrl,
          findingCount: findings.length,
          durationMs: nowMs() - startedAt,
        }),
      );
    } catch (error) {
      await ctx.runMutation(internal.scans.failScanRunPage, {
        pageRunId: pageRun._id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCategory: categorizeScanError(error),
      });
      console.error(
        JSON.stringify({
          component: "adascout-scan",
          event: "page_scan_failed",
          scanRunId: scanRun._id,
          pageRunId: pageRun._id,
          pageUrl: pageRun.pageUrl,
          durationMs: nowMs() - startedAt,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    return null;
  },
});

export const processQueuedPagesWithSessionLease = internalAction({
  args: {
    scanRunId: v.id("scanRuns"),
    workerId: v.optional(v.string()),
    pageLimit: v.optional(v.number()),
    leaseKey: v.optional(v.string()),
  },
  returns: v.object({
    processedPages: v.number(),
    leaseAcquired: v.boolean(),
    claimedPages: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    processedPages: number;
    leaseAcquired: boolean;
    claimedPages: number;
  }> => {
    const isCanceled = await ctx.runQuery(internal.scans.isScanRunCanceled, {
      scanRunId: args.scanRunId,
    });
    if (isCanceled) {
      return { processedPages: 0, leaseAcquired: false, claimedPages: 0 };
    }
    const runtime = getSessionRuntimeConfig();
    const leaseKey = args.leaseKey ?? DEFAULT_LEASE_KEY;
    const workerId =
      args.workerId ??
      `${String(args.scanRunId)}:${nowMs()}:${Math.random().toString(36).slice(2, 10)}`;
    const leaseNow = nowMs();
    const leaseAcquireStartedAt = nowMs();
    await ctx.runMutation(internal.scans.cleanupExpiredSessionLeases, {
      leaseKey,
      now: leaseNow,
    });
    const leaseAcquired = await ctx.runMutation(
      internal.scans.acquireSessionLease,
      {
        leaseKey,
        holderId: workerId,
        scanRunId: args.scanRunId,
        maxConcurrent: runtime.maxConcurrentSessions,
        ttlMs: runtime.leaseTtlMs,
        now: leaseNow,
        planTier: runtime.planTier,
      },
    );
    logScanPhase({
      event: "lease_acquire_result",
      scanRunId: args.scanRunId,
      workerId,
      leaseAcquired,
      leaseAcquireMs: nowMs() - leaseAcquireStartedAt,
      maxConcurrentSessions: runtime.maxConcurrentSessions,
      planTier: runtime.planTier,
    });
    if (!leaseAcquired) {
      if (nowMs() - leaseAcquireStartedAt > runtime.leaseAcquireTimeoutMs) {
        logScanPhase({
          event: "lease_acquire_timeout",
          scanRunId: args.scanRunId,
          workerId,
          timeoutMs: runtime.leaseAcquireTimeoutMs,
        });
      }
      return { processedPages: 0, leaseAcquired: false, claimedPages: 0 };
    }

    let processedPages = 0;
    let claimedPages = 0;
    let sessionId: string | null = null;

    try {
      const limit = Math.max(
        1,
        Math.min(50, Number(args.pageLimit ?? runtime.pagesPerSession)),
      );
      const claimed = await ctx.runMutation(
        internal.scans.claimQueuedScanRunPages,
        {
          scanRunId: args.scanRunId,
          limit,
        },
      );
      claimedPages = claimed.length;
      if (claimed.length === 0) {
        return { processedPages: 0, leaseAcquired: true, claimedPages: 0 };
      }

      const runtimeConfig = getStagehandConfigForRuntime();
      if (!runtimeConfig) {
        for (const pageRunId of claimed) {
          await ctx.runAction(internal.scanRunner.scanQueuedPage, {
            scanRunId: args.scanRunId,
            pageRunId,
          });
          processedPages += 1;
        }
        return { processedPages, leaseAcquired: true, claimedPages };
      }
      const { stagehand, stagehandModelName } = runtimeConfig;

      for (const pageRunId of claimed) {
        const canceledMidRun = await ctx.runQuery(
          internal.scans.isScanRunCanceled,
          {
            scanRunId: args.scanRunId,
          },
        );
        if (canceledMidRun) {
          break;
        }
        const processing = (await ctx.runQuery(
          internal.scans.getScanRunPageForProcessing,
          {
            scanRunId: args.scanRunId,
            pageRunId,
          },
        )) as ScanRunPageProcessingSnapshot | null;
        if (!processing) continue;
        const { scanRun, pageRun } = processing;
        const queueWaitMs = Math.max(0, nowMs() - pageRun.createdAt);

        const claimedForExecution = await ctx.runMutation(
          internal.scans.claimScanRunPageForExecution,
          {
            scanRunId: scanRun._id,
            pageRunId: pageRun._id,
            queueWaitMs,
          },
        );
        if (!claimedForExecution) continue;

        const pageStartedAt = nowMs();
        logScanPhase({
          event: "page_scan_start",
          scanRunId: scanRun._id,
          pageRunId: pageRun._id,
          pageUrl: pageRun.pageUrl,
          sessionMode: "shared",
        });

        try {
          if (!sessionId) {
            sessionId = await startSharedSessionWithRetry(
              ctx,
              stagehand,
              pageRun.pageUrl,
            );
          }

          const findings = await scanWebsiteUsingExistingSession(
            ctx,
            stagehand,
            stagehandModelName,
            sessionId,
            pageRun.pageUrl,
          );
          await ctx.runMutation(internal.scans.replaceFindingsForPage, {
            scanRunId: scanRun._id,
            scanRunPageId: pageRun._id,
            assetId: scanRun.assetId,
            findings,
          });
          await ctx.runMutation(internal.scans.completeScanRunPage, {
            pageRunId: pageRun._id,
            findingCount: findings.length,
            extractLatencyMs: nowMs() - pageStartedAt,
          });
          logScanPhase({
            event: "page_scan_complete",
            scanRunId: scanRun._id,
            pageRunId: pageRun._id,
            pageUrl: pageRun.pageUrl,
            findingCount: findings.length,
            durationMs: nowMs() - pageStartedAt,
            sessionMode: "shared",
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (isStagehandSessionLimitError(error)) {
            await ctx.runMutation(internal.scans.preparePageRerun, {
              scanRunId: scanRun._id,
              pageRunIds: [pageRun._id],
            });
            logScanPhase({
              event: "page_scan_requeued",
              scanRunId: scanRun._id,
              pageRunId: pageRun._id,
              pageUrl: pageRun.pageUrl,
              errorMessage,
              sessionMode: "shared",
            });
          } else {
            await ctx.runMutation(internal.scans.failScanRunPage, {
              pageRunId: pageRun._id,
              errorMessage,
              errorCategory: categorizeScanError(error),
            });
          }
          logScanPhase({
            event: "page_scan_failed",
            scanRunId: scanRun._id,
            pageRunId: pageRun._id,
            pageUrl: pageRun.pageUrl,
            durationMs: nowMs() - pageStartedAt,
            errorMessage,
            sessionMode: "shared",
          });
        }

        processedPages += 1;
        await ctx.runMutation(internal.scans.heartbeatSessionLease, {
          leaseKey,
          holderId: workerId,
          ttlMs: runtime.leaseTtlMs,
          now: nowMs(),
        });
      }

      return { processedPages, leaseAcquired: true, claimedPages };
    } finally {
      const runtimeConfig = getStagehandConfigForRuntime();
      if (sessionId && runtimeConfig) {
        await runtimeConfig.stagehand
          .endSession(ctx, { sessionId })
          .catch(() => undefined);
      }
      await ctx.runMutation(internal.scans.releaseSessionLease, {
        leaseKey,
        holderId: workerId,
      });
    }
  },
});

export const finalizeWebsiteScanRunReport = internalAction({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "finalize_start",
        scanRunId: args.scanRunId,
      }),
    );
    const final = await ctx.runMutation(internal.scans.finalizeWebsiteScanRun, {
      scanRunId: args.scanRunId,
    });
    if (!final) return null;
    await ctx.runMutation(internal.reports.upsertReportForScanRun, {
      assetId: final.assetId,
      scanRunId: final.scanRunId,
      generatedBy: final.createdBy,
      profile: final.profile,
      generatedAt: final.generatedAt,
      summary: final.summary,
      markdown: final.markdown,
      json: final.json,
    });
    console.info(
      JSON.stringify({
        component: "adascout-scan",
        event: "finalize_complete",
        scanRunId: args.scanRunId,
        summary: final.summary,
      }),
    );
    return null;
  },
});

export const e2eWebsiteScanSmoke = internalAction({
  args: {
    url: v.string(),
    maxPages: v.optional(v.number()),
    samplePages: v.optional(v.number()),
  },
  returns: v.object({
    seedUrl: v.string(),
    discoveredPages: v.number(),
    sampledPages: v.number(),
    reachablePagesInSamples: v.number(),
    failedPagesInSamples: v.number(),
    pages: v.array(
      v.object({
        url: v.string(),
        statusCode: v.optional(v.number()),
        contentType: v.optional(v.string()),
        failed: v.boolean(),
      }),
    ),
  }),
  handler: async (_ctx, args) => {
    const maxPages = Math.max(1, Math.min(500, Number(args.maxPages ?? 100)));
    const samplePages = Math.max(1, Math.min(5, Number(args.samplePages ?? 1)));
    const discovered = await discoverWebsiteUrls(args.url, maxPages);
    const sampled = discovered.slice(0, samplePages);
    const pages: {
      url: string;
      statusCode?: number;
      contentType?: string;
      failed: boolean;
    }[] = [];

    for (const pageUrl of sampled) {
      try {
        const response = await withTimeout(
          "E2E page reachability",
          10_000,
          async () =>
            withRetry("E2E page fetch", async () => fetch(pageUrl), 1),
        );
        pages.push({
          url: pageUrl,
          statusCode: response.status,
          contentType: response.headers.get("content-type") ?? undefined,
          failed: false,
        });
      } catch {
        pages.push({
          url: pageUrl,
          failed: true,
        });
      }
    }

    const reachablePagesInSamples = pages.filter((page) => !page.failed).length;
    const failedPagesInSamples = pages.filter((page) => page.failed).length;

    return {
      seedUrl: args.url,
      discoveredPages: discovered.length,
      sampledPages: sampled.length,
      reachablePagesInSamples,
      failedPagesInSamples,
      pages,
    };
  },
});
