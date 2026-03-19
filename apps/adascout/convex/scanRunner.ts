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

interface PdfTextItem {
  str?: string;
  transform?: number[];
}

interface PdfScanFacts {
  pageCount: number;
  documentTitle?: string;
  documentLanguage?: string;
  hasTags: boolean;
  textlessPages: number[];
  lowConfidencePages: Array<{ pageNumber: number; score: number }>;
  likelyTablePages: number[];
  suspectReadingOrderPages: number[];
  genericOrUnlabeledFormFieldNames: string[];
  imageHeavyPages: number[];
  lowContrastCandidatePages: Array<{ pageNumber: number; score: number }>;
  blurryImageTextPages: Array<{ pageNumber: number; score: number }>;
  meaningfulImageReviewPages: number[];
  pageProcessingErrors: Array<{ pageNumber: number; message: string }>;
}

type PdfCheckStatus = "pass" | "warn" | "fail";

interface PdfDocumentCheck {
  id: string;
  label: string;
  status: PdfCheckStatus;
  detail: string;
}

interface PdfPageCheck {
  id: string;
  label: string;
  status: PdfCheckStatus;
  totalPages: number;
  passCount: number;
  failCount: number;
  detail: string;
}

interface PdfChecksSnapshot {
  version: number;
  documentChecks: PdfDocumentCheck[];
  pageChecks: PdfPageCheck[];
}

const buildPdfChecksSnapshotFromFindings = (
  findings: NormalizedFinding[],
): PdfChecksSnapshot => {
  const pdfFindings = findings.filter((row) => row.source === "pdf");
  const pageNumbers = pdfFindings
    .map((row) => Number(row.pageNumber ?? 0))
    .filter((row) => Number.isFinite(row) && row > 0);
  const totalPages = Math.max(0, ...pageNumbers, 0);
  const countPageFailures = (ruleId: string): number => {
    const pages = new Set<number>();
    let entries = 0;
    for (const finding of pdfFindings) {
      if (finding.ruleId !== ruleId) continue;
      entries += 1;
      const pageNumber = Number(finding.pageNumber ?? 0);
      if (Number.isFinite(pageNumber) && pageNumber > 0) {
        pages.add(pageNumber);
      }
    }
    return pages.size > 0 ? pages.size : entries;
  };
  const hasRule = (ruleId: string) =>
    pdfFindings.some((finding) => finding.ruleId === ruleId);
  const asPageCheck = (args: {
    id: string;
    label: string;
    failCount: number;
    detail: string;
    failAsWarn?: boolean;
  }): PdfPageCheck => {
    const boundedFailCount = Math.max(0, Math.min(args.failCount, totalPages));
    return {
      id: args.id,
      label: args.label,
      status:
        boundedFailCount <= 0 ? "pass" : args.failAsWarn ? "warn" : "fail",
      totalPages,
      passCount: Math.max(0, totalPages - boundedFailCount),
      failCount: boundedFailCount,
      detail: args.detail,
    };
  };
  return {
    version: 1,
    documentChecks: [
      {
        id: "pdf.meta.title",
        label: "Document title metadata",
        status: hasRule("pdf.meta.title_missing") ? "fail" : "pass",
        detail: hasRule("pdf.meta.title_missing")
          ? "Title metadata appears missing."
          : "No title metadata issue detected.",
      },
      {
        id: "pdf.meta.language",
        label: "Document language metadata",
        status: hasRule("pdf.meta.language_missing") ? "fail" : "pass",
        detail: hasRule("pdf.meta.language_missing")
          ? "Primary language appears missing."
          : "No language metadata issue detected.",
      },
      {
        id: "pdf.tagging.struct_tree",
        label: "Structural tag tree",
        status: hasRule("pdf.tagging.missing") ? "fail" : "pass",
        detail: hasRule("pdf.tagging.missing")
          ? "Tag tree appears missing."
          : "No tag-tree issue detected.",
      },
    ],
    pageChecks: [
      asPageCheck({
        id: "pdf.text_layer.coverage",
        label: "Text layer detected per page",
        failCount: countPageFailures("pdf.text_layer.missing_page"),
        detail: "Derived from recorded text-layer findings.",
      }),
      asPageCheck({
        id: "pdf.ocr.quality_confidence",
        label: "OCR text quality confidence",
        failCount: countPageFailures("pdf.scan_quality.low_confidence_ocr"),
        failAsWarn: true,
        detail: "Derived from low-confidence OCR findings.",
      }),
      asPageCheck({
        id: "pdf.reading_order.heuristic",
        label: "Reading order heuristic",
        failCount: countPageFailures("pdf.reading_order.suspect"),
        failAsWarn: true,
        detail: "Derived from reading-order heuristic findings.",
      }),
      asPageCheck({
        id: "pdf.table.header_heuristic",
        label: "Table header semantics heuristic",
        failCount: countPageFailures("pdf.table.header_missing"),
        failAsWarn: true,
        detail: "Derived from table-header semantic findings.",
      }),
      asPageCheck({
        id: "pdf.image.low_contrast",
        label: "Image text contrast heuristic",
        failCount: countPageFailures("pdf.image.text_detected_low_contrast"),
        failAsWarn: true,
        detail: "Derived from image low-contrast findings.",
      }),
      asPageCheck({
        id: "pdf.image.blur",
        label: "Image text sharpness heuristic",
        failCount: countPageFailures("pdf.image.text_detected_blurry"),
        failAsWarn: true,
        detail: "Derived from image blur findings.",
      }),
      asPageCheck({
        id: "pdf.image.alt_review",
        label: "Meaningful image alternative review",
        failCount: countPageFailures("pdf.image.meaningful_image_needs_alt_review"),
        failAsWarn: true,
        detail: "Derived from image alt-review findings.",
      }),
    ],
  };
};

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

const computeCompliance = (summary: ReturnType<typeof computeSummary>) => {
  const weightedPenalty =
    summary.critical * 20 +
    summary.serious * 12 +
    summary.moderate * 6 +
    summary.minor * 2 +
    summary.info +
    summary.manualReviewRequired * 2;
  const score = Math.max(0, Math.min(100, Math.round(100 - weightedPenalty)));
  const band: "pass" | "warn" | "fail" =
    score >= 90 ? "pass" : score >= 70 ? "warn" : "fail";
  return { score, band, weightedPenalty };
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
}) => {
  const normalizeForHash = (value: string | undefined): string =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const normalizePageUrlForHash = (value: string | undefined): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      parsed.hash = "";
      parsed.pathname =
        parsed.pathname === "/"
          ? "/"
          : parsed.pathname.replace(/\/+$/, "") || "/";
      return parsed.toString().toLowerCase();
    } catch {
      return normalizeForHash(raw);
    }
  };
  return [
    normalizeForHash(args.source),
    normalizeForHash(args.ruleId),
    normalizeForHash(args.target),
    normalizePageUrlForHash(args.pageUrl),
  ].join("|");
};

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

const extractUrlsFromLooseText = (text: string): string[] => {
  const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  return matches
    .map((value) => value.replace(/[),.;]+$/g, ""))
    .filter((value) => value.length > 0);
};

const toProxyMirrorUrl = (rawUrl: string): string =>
  `https://r.jina.ai/http://${rawUrl.replace(/^https?:\/\//i, "")}`;

const stripTrailingIsoTimestampSegment = (normalizedUrl: string): string => {
  try {
    const parsed = new URL(normalizedUrl);
    const segments = parsed.pathname.split("/").filter((segment) => segment);
    if (segments.length === 0) return normalizedUrl;
    const last = segments.at(-1)?.toLowerCase() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/.test(last)) {
      return normalizedUrl;
    }
    const nextPath = `/${segments.slice(0, -1).join("/")}`;
    parsed.pathname = nextPath === "/" ? "/" : nextPath;
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return normalizedUrl;
  }
};

const normalizeCandidateUrl = (candidate: string): string | null => {
  const normalized = normalizeUrlForCrawl(candidate);
  if (!normalized) return null;
  const cleaned = stripTrailingIsoTimestampSegment(normalized);
  return normalizeUrlForCrawl(cleaned);
};

const isLikelySitemapDocumentUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    return pathname.endsWith(".xml") || pathname.includes("sitemap");
  } catch {
    return false;
  }
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
  options?: {
    useTimeouts?: boolean;
    sitemapOnly?: boolean;
  },
): Promise<Array<string>> => {
  const normalizedSeed = normalizeUrlForCrawl(seedUrl);
  if (!normalizedSeed) return [];
  const useTimeouts = options?.useTimeouts ?? true;
  const sitemapOnly = options?.sitemapOnly ?? false;
  const discoveryHeaders: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
  };
  const seed = new URL(normalizedSeed);
  const origin = seed.origin;
  const discovered = new Set<string>([normalizedSeed]);
  const fetchForDiscovery = async (
    label: string,
    url: string,
    timeoutMs: number,
  ): Promise<Response> => {
    if (!useTimeouts) {
      return await fetch(url, {
        headers: discoveryHeaders,
        redirect: "follow",
      });
    }
    return await withTimeout(label, timeoutMs, async () =>
      withRetry(
        label,
        async () =>
          await fetch(url, {
            headers: discoveryHeaders,
            redirect: "follow",
          }),
        1,
      ),
    );
  };

  // Sitemap-first discovery.
  const sitemapCandidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/page-sitemap.xml`,
    `${origin}/post-sitemap.xml`,
    `${origin}/wp-sitemap-posts-page-1.xml`,
    `${origin}/wp-sitemap-posts-post-1.xml`,
  ];
  try {
    const robotsResponse = await fetchForDiscovery(
      "robots.txt fetch",
      `${origin}/robots.txt`,
      10_000,
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

  const sitemapQueue = Array.from(new Set(sitemapCandidates));
  const visitedSitemaps = new Set<string>();
  while (sitemapQueue.length > 0 && discovered.size < maxUrls) {
    const sitemapUrl = sitemapQueue.shift();
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);
    try {
      const response = await fetchForDiscovery(
        "sitemap fetch",
        sitemapUrl,
        12_000,
      );
      if (!response.ok) continue;
      const xml = await response.text();
      for (const loc of extractXmlLocs(xml)) {
        const normalized = normalizeCandidateUrl(loc);
        if (!normalized) continue;
        const parsed = new URL(normalized);
        if (parsed.origin !== origin) continue;
        if (isLikelySitemapDocumentUrl(normalized)) {
          if (!visitedSitemaps.has(normalized)) {
            sitemapQueue.push(normalized);
          }
          continue;
        }
        discovered.add(normalized);
        if (discovered.size >= maxUrls) break;
      }
    } catch {
      // Ignore sitemap failures
    }
  }

  // Crawl fallback when sitemap has too few links.
  if (sitemapOnly) {
    return Array.from(discovered).filter(isLikelyHtmlPageUrl).slice(0, maxUrls);
  }
  const queue: string[] = [normalizedSeed];
  const visited = new Set<string>();
  while (queue.length > 0 && discovered.size < maxUrls) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    try {
      const response = await fetchForDiscovery(
        "crawl page fetch",
        current,
        10_000,
      );
      if (!response.ok) continue;
      const html = await response.text();
      const links = extractInternalLinks(html, origin);
      for (const link of links) {
        const normalizedLink = normalizeCandidateUrl(link);
        if (!normalizedLink) continue;
        if (!discovered.has(normalizedLink)) {
          discovered.add(normalizedLink);
          if (discovered.size >= maxUrls) break;
        }
        if (!visited.has(normalizedLink) && queue.length < maxUrls * 2) {
          queue.push(normalizedLink);
        }
      }
    } catch {
      // Ignore individual crawl page failure
    }
  }

  // Some hosts soft-block server-side crawlers in Convex runtime. As a final
  // non-browser fallback, fetch sitemap content through a text mirror endpoint.
  if (discovered.size <= 1 && discovered.size < maxUrls) {
    const proxySitemapQueue = [
      normalizedSeed,
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/robots.txt`,
    ];
    const visitedProxySitemaps = new Set<string>();
    while (proxySitemapQueue.length > 0 && discovered.size < maxUrls) {
      const sitemapOrRobotsUrl = proxySitemapQueue.shift();
      if (
        !sitemapOrRobotsUrl ||
        visitedProxySitemaps.has(sitemapOrRobotsUrl)
      ) {
        continue;
      }
      visitedProxySitemaps.add(sitemapOrRobotsUrl);
      try {
        const proxyUrl = toProxyMirrorUrl(sitemapOrRobotsUrl);
        const response = await fetchForDiscovery(
          "proxy sitemap fetch",
          proxyUrl,
          15_000,
        );
        if (!response.ok) continue;
        const text = await response.text();
        const candidates = [
          ...extractXmlLocs(text),
          ...extractUrlsFromLooseText(text),
        ];
        for (const candidate of candidates) {
          const normalized = normalizeCandidateUrl(candidate);
          if (!normalized) continue;
          const parsed = new URL(normalized);
          if (parsed.origin !== origin) continue;
          if (isLikelySitemapDocumentUrl(normalized)) {
            if (!visitedProxySitemaps.has(normalized)) {
              proxySitemapQueue.push(normalized);
            }
            continue;
          }
          if (!isLikelyHtmlPageUrl(normalized)) continue;
          discovered.add(normalized);
          if (discovered.size >= maxUrls) break;
        }
      } catch {
        // Proxy sitemap fallback is best-effort.
      }
    }
  }

  return Array.from(discovered).filter(isLikelyHtmlPageUrl).slice(0, maxUrls);
};

const stagehandDiscoverySchema = z.object({
  links: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),
  hrefs: z.array(z.string()).optional(),
});

const collectCandidateUrls = (value: unknown): string[] => {
  const out = new Set<string>();
  if (!value) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) out.add(trimmed);
    return Array.from(out);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      for (const nested of collectCandidateUrls(item)) out.add(nested);
    }
    return Array.from(out);
  }
  if (typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      for (const candidate of collectCandidateUrls(nested)) out.add(candidate);
    }
  }
  return Array.from(out);
};

export const discoverWebsiteUrlsViaStagehand = async (
  ctx: GenericActionCtx<any>,
  seedUrl: string,
  maxUrls: number,
): Promise<string[]> => {
  const normalizedSeed = normalizeUrlForCrawl(seedUrl);
  if (!normalizedSeed) return [];
  const runtime = getStagehandConfigForRuntime();
  if (!runtime) return [normalizedSeed];
  const origin = new URL(normalizedSeed).origin;
  const discovered = new Set<string>([normalizedSeed]);
  const discoveryTargets = [
    normalizedSeed,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  for (const targetUrl of discoveryTargets) {
    if (discovered.size >= maxUrls) break;
    try {
      const extracted = (await withTimeout(
        "Stagehand discovery extract",
        90_000,
        async () =>
          await runtime.stagehand.extract(ctx, {
            url: targetUrl,
            instruction:
              "Extract all URL links present in the page content and DOM. Return absolute URLs only, preserving same-site URLs.",
            schema: stagehandDiscoverySchema,
            options: { waitUntil: "domcontentloaded", timeout: 45_000 },
          }),
      )) as unknown;
      const candidates = collectCandidateUrls(extracted);
      for (const rawLink of candidates) {
        const normalized = normalizeUrlForCrawl(rawLink);
        if (!normalized) continue;
        const parsed = new URL(normalized);
        if (parsed.origin !== origin) continue;
        if (isLikelySitemapDocumentUrl(normalized)) continue;
        if (!isLikelyHtmlPageUrl(normalized)) continue;
        discovered.add(normalized);
        if (discovered.size >= maxUrls) break;
      }
    } catch (error) {
      logScanPhase({
        event: "stagehand_discovery_failed",
        seedUrl: normalizedSeed,
        targetUrl,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Array.from(discovered).slice(0, maxUrls);
};

const scanPdfFromFileUrl = async (
  fileUrl: string,
): Promise<NormalizedFinding[]> => {
  const scanStartedAt = nowMs();
  logScanPhase({
    event: "pdf_scan_start",
    fileUrl,
  });
  const response = await withTimeout("PDF fetch", 30_000, async () =>
    withRetry("PDF fetch", async () => fetch(fileUrl)),
  );
  if (!response.ok) {
    logScanPhase({
      event: "pdf_scan_fetch_failed",
      fileUrl,
      status: response.status,
      durationMs: nowMs() - scanStartedAt,
    });
    throw new Error(`Failed to load PDF bytes (${response.status}).`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  logScanPhase({
    event: "pdf_scan_fetch_complete",
    fileUrl,
    byteLength: bytes.byteLength,
    durationMs: nowMs() - scanStartedAt,
  });
  const pdfjsModule = (await import("pdfjs-dist")) as {
    getDocument?: (args: { data: Uint8Array }) => any;
    default?: { getDocument?: (args: { data: Uint8Array }) => any };
  };
  const getDocumentFn =
    pdfjsModule.getDocument ?? pdfjsModule.default?.getDocument;
  if (typeof getDocumentFn !== "function") {
    logScanPhase({
      event: "pdf_scan_runtime_module_shape_error",
      fileUrl,
      hasNamedGetDocument: typeof pdfjsModule.getDocument === "function",
      hasDefaultGetDocument:
        typeof pdfjsModule.default?.getDocument === "function",
      moduleKeys: Object.keys(pdfjsModule).slice(0, 20),
      durationMs: nowMs() - scanStartedAt,
    });
    throw new Error(
      "pdfjs-dist runtime module does not expose getDocument().",
    );
  }
  const loadingTask = getDocumentFn({ data: bytes });
  const document = await loadingTask.promise;
  logScanPhase({
    event: "pdf_scan_document_loaded",
    fileUrl,
    pageCount: document.numPages,
    durationMs: nowMs() - scanStartedAt,
  });

  const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    return fallback;
  };
  const rulesEnabled =
    (process.env.ADA_PDF_RULES_V1_ENABLED ?? "true").trim().toLowerCase() !==
    "false";
  const imageRulesEnabled = parseBooleanEnv(
    process.env.ADA_PDF_IMAGE_RULES_ENABLED,
    false,
  );
  const imageDpi = Math.max(
    72,
    Math.min(600, parsePositiveInt(process.env.ADA_PDF_IMAGE_DPI, 150)),
  );
  const imageBlurThreshold = Math.max(
    1,
    Math.min(
      100,
      parsePositiveInt(process.env.ADA_PDF_IMAGE_BLUR_THRESHOLD, 45),
    ),
  );
  const imageContrastThreshold = Math.max(
    1,
    Math.min(
      100,
      parsePositiveInt(process.env.ADA_PDF_IMAGE_CONTRAST_THRESHOLD, 60),
    ),
  );
  const lowConfidenceThreshold = Math.max(
    1,
    Math.min(
      100,
      parsePositiveInt(process.env.ADA_PDF_OCR_LOW_CONFIDENCE_THRESHOLD, 55),
    ),
  );
  logScanPhase({
    event: "pdf_scan_rules_config",
    fileUrl,
    rulesEnabled,
    imageRulesEnabled,
    imageDpi,
    imageBlurThreshold,
    imageContrastThreshold,
    lowConfidenceThreshold,
    durationMs: nowMs() - scanStartedAt,
  });

  const scoreTextQuality = (rawTextItems: PdfTextItem[]): number => {
    const text = rawTextItems
      .map((item) => String(item?.str ?? ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return 0;
    const letters = (text.match(/[A-Za-z]/g) ?? []).length;
    const digits = (text.match(/[0-9]/g) ?? []).length;
    const weird = (text.match(/[^A-Za-z0-9\s.,;:!?'"()\-\u2019]/g) ?? []).length;
    const words = text.split(/\s+/).filter((part) => part.length > 0);
    const shortWords = words.filter((part) => part.length <= 2).length;
    const avgWordLength = words.length
      ? words.reduce((sum, part) => sum + part.length, 0) / words.length
      : 0;
    const charCount = text.length;
    const alphaDigitRatio = charCount > 0 ? (letters + digits) / charCount : 0;
    const weirdRatio = charCount > 0 ? weird / charCount : 1;
    const shortWordRatio = words.length > 0 ? shortWords / words.length : 1;

    let score = 100;
    score -= Math.round((1 - alphaDigitRatio) * 45);
    score -= Math.round(weirdRatio * 60);
    if (avgWordLength > 0 && avgWordLength < 3) score -= 12;
    if (shortWordRatio > 0.5) score -= 10;
    if (words.length < 8) score -= 8;
    return Math.max(0, Math.min(100, score));
  };

  const hasLikelyTablePattern = (rawTextItems: PdfTextItem[]): boolean => {
    const positioned = rawTextItems
      .map((item) => {
        const y = Array.isArray(item.transform) ? Number(item.transform[5]) : NaN;
        const x = Array.isArray(item.transform) ? Number(item.transform[4]) : NaN;
        return {
          text: String(item.str ?? "").trim(),
          x,
          y,
        };
      })
      .filter((row) => row.text.length > 0 && Number.isFinite(row.x) && Number.isFinite(row.y));
    if (positioned.length < 30) return false;
    const rows = new Map<number, number>();
    for (const item of positioned) {
      const bucket = Math.round(item.y / 12);
      rows.set(bucket, (rows.get(bucket) ?? 0) + 1);
    }
    const denseRows = Array.from(rows.values()).filter((count) => count >= 4).length;
    return denseRows >= 5;
  };

  const hasSuspectReadingOrderPattern = (rawTextItems: PdfTextItem[]): boolean => {
    const ys = rawTextItems
      .map((item) => (Array.isArray(item.transform) ? Number(item.transform[5]) : NaN))
      .filter((value) => Number.isFinite(value));
    if (ys.length < 15) return false;
    let largeUpwardJumps = 0;
    for (let index = 1; index < ys.length; index += 1) {
      const current = ys[index];
      const previous = ys[index - 1];
      if (current === undefined || previous === undefined) continue;
      const delta = current - previous;
      if (delta > 45) largeUpwardJumps += 1;
    }
    return largeUpwardJumps >= 5;
  };

  const collectPdfFacts = async (): Promise<PdfScanFacts> => {
    const metadataResult = await document
      .getMetadata()
      .catch(() => ({ info: {} as Record<string, unknown> }));
    const info = (metadataResult as { info?: Record<string, unknown> }).info ?? {};
    const documentTitle =
      typeof info.Title === "string" ? info.Title.trim() : undefined;
    const documentLanguage =
      (typeof info.Lang === "string" ? info.Lang : undefined) ??
      (typeof info.Language === "string" ? info.Language : undefined);
    const normalizedLanguage = documentLanguage?.trim();
    logScanPhase({
      event: "pdf_scan_metadata_parsed",
      fileUrl,
      hasTitle: Boolean(documentTitle),
      hasLanguage: Boolean(normalizedLanguage),
      durationMs: nowMs() - scanStartedAt,
    });

    const textlessPages: number[] = [];
    const lowConfidencePages: Array<{ pageNumber: number; score: number }> = [];
    const likelyTablePages: number[] = [];
    const suspectReadingOrderPages: number[] = [];
    const imageHeavyPages: number[] = [];
    const lowContrastCandidatePages: Array<{ pageNumber: number; score: number }> =
      [];
    const blurryImageTextPages: Array<{ pageNumber: number; score: number }> = [];
    const meaningfulImageReviewPages: number[] = [];
    const pageProcessingErrors: Array<{ pageNumber: number; message: string }> = [];
    let hasTags = false;
    for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex += 1) {
      try {
        const page = await document.getPage(pageIndex);
        const textContent = await page.getTextContent();
        const textItems = (Array.isArray(textContent.items)
          ? textContent.items
          : []) as PdfTextItem[];
        if (textItems.length === 0) {
          textlessPages.push(pageIndex);
        } else {
          const textQualityScore = scoreTextQuality(textItems);
          if (textQualityScore < lowConfidenceThreshold) {
            lowConfidencePages.push({ pageNumber: pageIndex, score: textQualityScore });
          }
          if (hasLikelyTablePattern(textItems)) {
            likelyTablePages.push(pageIndex);
          }
          if (hasSuspectReadingOrderPattern(textItems)) {
            suspectReadingOrderPages.push(pageIndex);
          }
        }

        if (imageRulesEnabled) {
          // NOTE: This is a deterministic heuristic pass over PDF operator streams.
          // It approximates image-heavy pages and text-rendering quality risk.
          const operatorList = await (
            page as unknown as {
              getOperatorList?: () => Promise<{
                fnArray?: Array<number | string>;
                argsArray?: unknown[];
              }>;
            }
          ).getOperatorList?.();
          const fnArray = Array.isArray(operatorList?.fnArray)
            ? operatorList.fnArray
            : [];
          const imageOpMatches = fnArray.filter((value) =>
            String(value)
              .toLowerCase()
              .includes("image"),
          ).length;
          const textOpMatches = fnArray.filter((value) => {
            const normalized = String(value).toLowerCase();
            return (
              normalized.includes("text") ||
              normalized.includes("show") ||
              normalized.includes("glyph")
            );
          }).length;
          const hasRasterImageOps = imageOpMatches > 0;
          const hasTextItems = textItems.length > 0;
          const textQualityScore = hasTextItems ? scoreTextQuality(textItems) : 0;
          const isImageHeavy = hasRasterImageOps && imageOpMatches >= textOpMatches;
          if (isImageHeavy) {
            imageHeavyPages.push(pageIndex);
          }
          if (hasRasterImageOps && !hasTextItems) {
            meaningfulImageReviewPages.push(pageIndex);
          } else if (
            hasRasterImageOps &&
            hasTextItems &&
            textQualityScore < imageContrastThreshold
          ) {
            // Proxy heuristic for text-over-image readability risk.
            lowContrastCandidatePages.push({
              pageNumber: pageIndex,
              score: textQualityScore,
            });
          }
          if (
            hasRasterImageOps &&
            hasTextItems &&
            textQualityScore < imageBlurThreshold
          ) {
            blurryImageTextPages.push({
              pageNumber: pageIndex,
              score: textQualityScore,
            });
          }

          logScanPhase({
            event: "pdf_scan_page_image_heuristics",
            fileUrl,
            pageNumber: pageIndex,
            imageOpMatches,
            textOpMatches,
            hasRasterImageOps,
            hasTextItems,
            isImageHeavy,
            textQualityScore,
            durationMs: nowMs() - scanStartedAt,
          });
        }
        if (
          typeof (page as unknown as { getStructTree?: unknown }).getStructTree ===
          "function"
        ) {
          const structTree = await (
            page as unknown as {
              getStructTree: () => Promise<unknown>;
            }
          )
            .getStructTree()
            .catch(() => null as unknown as null);
          if (structTree) {
            hasTags = true;
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message.slice(0, 500)
            : String(error).slice(0, 500);
        pageProcessingErrors.push({
          pageNumber: pageIndex,
          message,
        });
        logScanPhase({
          event: "pdf_scan_page_processing_error",
          fileUrl,
          pageNumber: pageIndex,
          errorMessage: message,
          durationMs: nowMs() - scanStartedAt,
        });
      }
    }

    const fieldObjects = await (document as unknown as {
      getFieldObjects?: () => Promise<Record<string, unknown[]>>;
    })
      .getFieldObjects?.()
      .catch(() => undefined);
    const genericOrUnlabeledFormFieldNames: string[] = [];
    if (fieldObjects && typeof fieldObjects === "object") {
      for (const [fieldName, rows] of Object.entries(fieldObjects)) {
        const normalizedName = fieldName.trim();
        const firstRow = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
        const altText =
          typeof firstRow?.alternativeText === "string"
            ? firstRow.alternativeText.trim()
            : "";
        const likelyGeneric = /^(text|field|textbox|input|check|radio)\d*$/i.test(
          normalizedName.replace(/\s+/g, ""),
        );
        if (!altText || likelyGeneric) {
          genericOrUnlabeledFormFieldNames.push(normalizedName || "unnamed_field");
        }
      }
    }

    logScanPhase({
      event: "pdf_scan_facts_complete",
      fileUrl,
      pageCount: document.numPages,
      textlessPageCount: textlessPages.length,
      lowConfidencePageCount: lowConfidencePages.length,
      likelyTablePageCount: likelyTablePages.length,
      suspectReadingOrderPageCount: suspectReadingOrderPages.length,
      imageHeavyPageCount: imageHeavyPages.length,
      lowContrastCandidatePageCount: lowContrastCandidatePages.length,
      blurryImageTextPageCount: blurryImageTextPages.length,
      meaningfulImageReviewPageCount: meaningfulImageReviewPages.length,
      genericFormFieldCount: genericOrUnlabeledFormFieldNames.length,
      pageProcessingErrorCount: pageProcessingErrors.length,
      hasTags,
      durationMs: nowMs() - scanStartedAt,
    });

    return {
      pageCount: document.numPages,
      documentTitle:
        documentTitle && documentTitle.length > 0 ? documentTitle : undefined,
      documentLanguage:
        normalizedLanguage && normalizedLanguage.length > 0
          ? normalizedLanguage
          : undefined,
      hasTags,
      textlessPages,
      lowConfidencePages,
      likelyTablePages,
      suspectReadingOrderPages,
      genericOrUnlabeledFormFieldNames,
      imageHeavyPages,
      lowContrastCandidatePages,
      blurryImageTextPages,
      meaningfulImageReviewPages,
      pageProcessingErrors,
    };
  };

  const findings: NormalizedFinding[] = [];
  const facts = await collectPdfFacts();
  const capturedAt = nowMs();
  const asPageCheck = (args: {
    id: string;
    label: string;
    failCount: number;
    totalPages: number;
    detail: string;
    failAsWarn?: boolean;
  }): PdfPageCheck => {
    const boundedTotalPages = Math.max(0, args.totalPages);
    const boundedFailCount = Math.max(0, Math.min(args.failCount, boundedTotalPages));
    const passCount = Math.max(0, boundedTotalPages - boundedFailCount);
    const status: PdfCheckStatus =
      boundedFailCount <= 0 ? "pass" : args.failAsWarn ? "warn" : "fail";
    return {
      id: args.id,
      label: args.label,
      status,
      totalPages: boundedTotalPages,
      passCount,
      failCount: boundedFailCount,
      detail: args.detail,
    };
  };
  const checksSnapshot: PdfChecksSnapshot = {
    version: 1,
    documentChecks: [
      {
        id: "pdf.meta.title",
        label: "Document title metadata",
        status: facts.documentTitle ? "pass" : "fail",
        detail: facts.documentTitle
          ? "Title metadata found."
          : "Title metadata is missing.",
      },
      {
        id: "pdf.meta.language",
        label: "Document language metadata",
        status: facts.documentLanguage ? "pass" : "fail",
        detail: facts.documentLanguage
          ? `Language set to ${facts.documentLanguage}.`
          : "Primary document language is missing.",
      },
      {
        id: "pdf.tagging.struct_tree",
        label: "Structural tag tree",
        status: facts.hasTags ? "pass" : "fail",
        detail: facts.hasTags
          ? "Structure tags detected."
          : "No structure tags detected.",
      },
      {
        id: "pdf.page.processing_integrity",
        label: "Page processing integrity",
        status: facts.pageProcessingErrors.length > 0 ? "warn" : "pass",
        detail:
          facts.pageProcessingErrors.length > 0
            ? `${facts.pageProcessingErrors.length} page(s) had partial parser errors.`
            : "All pages were processed without parser exceptions.",
      },
    ],
    pageChecks: [
      asPageCheck({
        id: "pdf.text_layer.coverage",
        label: "Text layer detected per page",
        failCount: facts.textlessPages.length,
        totalPages: facts.pageCount,
        detail:
          facts.textlessPages.length > 0
            ? `${facts.textlessPages.length} page(s) appear image-only.`
            : "Text layer present on all pages.",
      }),
      asPageCheck({
        id: "pdf.ocr.quality_confidence",
        label: "OCR text quality confidence",
        failCount: facts.lowConfidencePages.length,
        totalPages: facts.pageCount,
        failAsWarn: true,
        detail:
          facts.lowConfidencePages.length > 0
            ? `${facts.lowConfidencePages.length} page(s) may need OCR quality review.`
            : "No low-confidence OCR pages detected.",
      }),
      asPageCheck({
        id: "pdf.reading_order.heuristic",
        label: "Reading order heuristic",
        failCount: facts.suspectReadingOrderPages.length,
        totalPages: facts.pageCount,
        failAsWarn: true,
        detail:
          facts.suspectReadingOrderPages.length > 0
            ? `${facts.suspectReadingOrderPages.length} page(s) have possible reading-order ambiguity.`
            : "No reading-order anomalies detected by heuristics.",
      }),
      asPageCheck({
        id: "pdf.table.header_heuristic",
        label: "Table header semantics heuristic",
        failCount: facts.likelyTablePages.length,
        totalPages: facts.pageCount,
        failAsWarn: true,
        detail:
          facts.likelyTablePages.length > 0
            ? `${facts.likelyTablePages.length} page(s) may need table header review.`
            : "No table-header semantic risks detected by heuristics.",
      }),
    ],
  };
  if (imageRulesEnabled) {
    checksSnapshot.pageChecks.push(
      asPageCheck({
        id: "pdf.image.low_contrast",
        label: "Image text contrast heuristic",
        failCount: facts.lowContrastCandidatePages.length,
        totalPages: facts.pageCount,
        failAsWarn: true,
        detail:
          facts.lowContrastCandidatePages.length > 0
            ? `${facts.lowContrastCandidatePages.length} page(s) may have low-contrast text in image regions.`
            : "No low-contrast image-text risks detected.",
      }),
      asPageCheck({
        id: "pdf.image.blur",
        label: "Image text sharpness heuristic",
        failCount: facts.blurryImageTextPages.length,
        totalPages: facts.pageCount,
        failAsWarn: true,
        detail:
          facts.blurryImageTextPages.length > 0
            ? `${facts.blurryImageTextPages.length} page(s) may have blurry image text.`
            : "No blurry image-text risks detected.",
      }),
      asPageCheck({
        id: "pdf.image.alt_review",
        label: "Meaningful image alternative review",
        failCount: facts.meaningfulImageReviewPages.length,
        totalPages: facts.pageCount,
        failAsWarn: true,
        detail:
          facts.meaningfulImageReviewPages.length > 0
            ? `${facts.meaningfulImageReviewPages.length} page(s) may require equivalent text/alt review.`
            : "No meaningful image alt-review risks detected.",
      }),
    );
  }

  if (!rulesEnabled) {
    for (const pageIndex of facts.textlessPages) {
      findings.push({
        source: "pdf",
        severity: "serious",
        ruleId: "pdf.text_layer.missing_page",
        title: `Page ${pageIndex} appears image-only`,
        description: "No text layer detected for this PDF page.",
        pageNumber: pageIndex,
        manualReviewRequired: true,
        confidence: 0.9,
        status: "open",
        lastStateChangeAt: capturedAt,
        capturedAt,
        evidenceHash: computeEvidenceHash({
          source: "pdf",
          ruleId: "pdf.text_layer.missing_page",
          target: `page:${String(pageIndex)}`,
        }),
      });
    }
    if (facts.pageCount > 0 && findings.length === 0) {
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
        lastStateChangeAt: capturedAt,
        capturedAt,
        evidenceHash: computeEvidenceHash({
          source: "pdf",
          ruleId: "pdf.scan.completed",
        }),
      });
    }
    return findings;
  }

  if (!facts.documentTitle) {
    findings.push({
      source: "pdf",
      severity: "serious",
      ruleId: "pdf.meta.title_missing",
      title: "PDF document title is missing",
      description:
        "Set the PDF Title metadata so assistive technology announces a meaningful document name.",
      manualReviewRequired: false,
      confidence: 0.95,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.meta.title_missing",
      }),
    });
  }

  if (!facts.documentLanguage) {
    findings.push({
      source: "pdf",
      severity: "serious",
      ruleId: "pdf.meta.language_missing",
      title: "PDF document language is missing",
      description:
        "Set the primary language (for example en-US) in document metadata for proper screen-reader pronunciation.",
      manualReviewRequired: false,
      confidence: 0.95,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.meta.language_missing",
      }),
    });
  }

  if (!facts.hasTags) {
    findings.push({
      source: "pdf",
      severity: "critical",
      ruleId: "pdf.tagging.missing",
      title: "PDF does not appear to include a structural tag tree",
      description:
        "Tagged PDFs are required for reliable navigation and semantics in assistive technologies.",
      manualReviewRequired: false,
      confidence: 0.95,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.tagging.missing",
      }),
    });
  }

  for (const pageNumber of facts.textlessPages) {
    findings.push({
      source: "pdf",
      severity: "serious",
      ruleId: "pdf.text_layer.missing_page",
      title: `Page ${pageNumber} appears image-only`,
      description:
        "No text layer detected for this page. OCR and semantic tagging are likely required.",
      pageNumber,
      manualReviewRequired: true,
      confidence: 0.9,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.text_layer.missing_page",
        target: `page:${String(pageNumber)}`,
      }),
    });
  }

  for (const page of facts.lowConfidencePages) {
    findings.push({
      source: "pdf",
      severity: "moderate",
      ruleId: "pdf.scan_quality.low_confidence_ocr",
      title: `Page ${page.pageNumber} has low OCR text quality confidence`,
      description:
        "Detected text quality appears degraded and may contain OCR errors. Manual verification is recommended.",
      pageNumber: page.pageNumber,
      manualReviewRequired: true,
      confidence: Math.max(0.3, Math.min(0.85, page.score / 100)),
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.scan_quality.low_confidence_ocr",
        target: `page:${String(page.pageNumber)}`,
      }),
    });
  }

  if (imageRulesEnabled) {
    for (const page of facts.lowContrastCandidatePages) {
      findings.push({
        source: "pdf",
        severity: "moderate",
        ruleId: "pdf.image.text_detected_low_contrast",
        title: `Page ${page.pageNumber} may contain low-contrast text in image regions`,
        description:
          "Image/text composition appears to have low readability contrast. Verify with manual contrast checks.",
        pageNumber: page.pageNumber,
        manualReviewRequired: true,
        confidence: Math.max(0.4, Math.min(0.8, page.score / 100)),
        status: "open",
        lastStateChangeAt: capturedAt,
        capturedAt,
        evidenceHash: computeEvidenceHash({
          source: "pdf",
          ruleId: "pdf.image.text_detected_low_contrast",
          target: `page:${String(page.pageNumber)}`,
        }),
      });
    }

    for (const page of facts.blurryImageTextPages) {
      findings.push({
        source: "pdf",
        severity: "moderate",
        ruleId: "pdf.image.text_detected_blurry",
        title: `Page ${page.pageNumber} may contain blurry text in image regions`,
        description:
          "Detected image/text quality suggests blur or poor scan sharpness. Consider rescanning or image enhancement.",
        pageNumber: page.pageNumber,
        manualReviewRequired: true,
        confidence: Math.max(0.45, Math.min(0.85, page.score / 100)),
        status: "open",
        lastStateChangeAt: capturedAt,
        capturedAt,
        evidenceHash: computeEvidenceHash({
          source: "pdf",
          ruleId: "pdf.image.text_detected_blurry",
          target: `page:${String(page.pageNumber)}`,
        }),
      });
    }

    for (const pageNumber of facts.meaningfulImageReviewPages) {
      findings.push({
        source: "pdf",
        severity: "moderate",
        ruleId: "pdf.image.meaningful_image_needs_alt_review",
        title: `Page ${pageNumber} includes meaningful image content requiring review`,
        description:
          "Page appears image-driven with limited machine-readable text. Confirm equivalent text alternatives and accessibility intent.",
        pageNumber,
        manualReviewRequired: true,
        confidence: 0.65,
        status: "open",
        lastStateChangeAt: capturedAt,
        capturedAt,
        evidenceHash: computeEvidenceHash({
          source: "pdf",
          ruleId: "pdf.image.meaningful_image_needs_alt_review",
          target: `page:${String(pageNumber)}`,
        }),
      });
    }
  }

  for (const pageNumber of facts.likelyTablePages) {
    findings.push({
      source: "pdf",
      severity: "moderate",
      ruleId: "pdf.table.header_missing",
      title: `Page ${pageNumber} may contain a table with unclear header semantics`,
      description:
        "Possible table-like layout detected. Verify header row/column tagging and scope associations manually.",
      pageNumber,
      manualReviewRequired: true,
      confidence: 0.55,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.table.header_missing",
        target: `page:${String(pageNumber)}`,
      }),
    });
  }

  for (const pageNumber of facts.suspectReadingOrderPages) {
    findings.push({
      source: "pdf",
      severity: "moderate",
      ruleId: "pdf.reading_order.suspect",
      title: `Page ${pageNumber} has potentially ambiguous reading order`,
      description:
        "Text extraction order shows jumps consistent with multi-column or fragmented reading order. Manual review is recommended.",
      pageNumber,
      manualReviewRequired: true,
      confidence: 0.55,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.reading_order.suspect",
        target: `page:${String(pageNumber)}`,
      }),
    });
  }

  if (facts.genericOrUnlabeledFormFieldNames.length > 0) {
    const sample = facts.genericOrUnlabeledFormFieldNames.slice(0, 8);
    findings.push({
      source: "pdf",
      severity: "serious",
      ruleId: "pdf.form.field_label_missing",
      title: "One or more PDF form fields appear unlabeled or generically named",
      description: `Potentially inaccessible form fields detected: ${sample.join(", ")}${facts.genericOrUnlabeledFormFieldNames.length > sample.length ? "..." : ""}`,
      manualReviewRequired: true,
      confidence: 0.7,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.form.field_label_missing",
      }),
    });
  }

  for (const pageError of facts.pageProcessingErrors) {
    findings.push({
      source: "pdf",
      severity: "info",
      ruleId: "pdf.page.processing_error",
      title: `Page ${pageError.pageNumber} could not be fully analyzed`,
      description: `Partial parser failure for this page: ${pageError.message}`,
      pageNumber: pageError.pageNumber,
      manualReviewRequired: true,
      confidence: 0.3,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.page.processing_error",
        target: `page:${String(pageError.pageNumber)}`,
      }),
    });
  }

  if (facts.pageCount > 0 && findings.length === 0) {
    findings.push({
      source: "pdf",
      severity: "info",
      ruleId: "pdf.scan.completed",
      title: "PDF parsed successfully",
      description:
        "No automated red flags were detected in this pass. Manual validation is still recommended.",
      manualReviewRequired: true,
      confidence: 0.4,
      status: "open",
      lastStateChangeAt: capturedAt,
      capturedAt,
      evidenceHash: computeEvidenceHash({
        source: "pdf",
        ruleId: "pdf.scan.completed",
      }),
    });
  }
  logScanPhase({
    event: "pdf_scan_complete",
    fileUrl,
    findingCount: findings.length,
    durationMs: nowMs() - scanStartedAt,
  });
  return findings;
};

export const processScanRun = internalAction({
  args: { scanRunId: v.id("scanRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const runStartedAt = nowMs();
    logScanPhase({
      event: "scan_run_process_start",
      scanRunId: args.scanRunId,
    });
    const isCanceledBeforeStart = await ctx.runQuery(
      internal.scans.isScanRunCanceled,
      {
        scanRunId: args.scanRunId,
      },
    );
    if (isCanceledBeforeStart) {
      logScanPhase({
        event: "scan_run_process_canceled_before_start",
        scanRunId: args.scanRunId,
      });
      return null;
    }
    const processing = await ctx.runQuery(
      internal.scans.getScanRunForProcessing,
      {
        scanRunId: args.scanRunId,
      },
    );
    if (!processing) {
      logScanPhase({
        event: "scan_run_process_missing_processing_snapshot",
        scanRunId: args.scanRunId,
      });
      return null;
    }
    const { scanRun, asset } = processing;
    logScanPhase({
      event: "scan_run_process_snapshot_loaded",
      scanRunId: scanRun._id,
      assetId: asset._id,
      assetKind: asset.kind,
      durationMs: nowMs() - runStartedAt,
    });
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
        logScanPhase({
          event: "scan_run_pdf_storage_url_request_start",
          scanRunId: scanRun._id,
          assetId: asset._id,
          storageId: asset.storageId,
          durationMs: nowMs() - runStartedAt,
        });
        const fileUrl = await ctx.runQuery(internal.scans.getAssetStorageUrl, {
          assetId: asset._id,
        });
        if (!fileUrl) {
          logScanPhase({
            event: "scan_run_pdf_storage_url_missing",
            scanRunId: scanRun._id,
            assetId: asset._id,
            durationMs: nowMs() - runStartedAt,
          });
          throw new Error("Unable to access stored PDF.");
        }
        logScanPhase({
          event: "scan_run_pdf_storage_url_ready",
          scanRunId: scanRun._id,
          assetId: asset._id,
          durationMs: nowMs() - runStartedAt,
        });
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
      const compliance = computeCompliance(summary);
      const checks =
        asset.kind === "file_pdf"
          ? buildPdfChecksSnapshotFromFindings(findings)
          : undefined;
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
        ``,
        `## Compliance`,
        `- Score: ${compliance.score}/100 (${compliance.band})`,
        `- Weighted penalty: ${compliance.weightedPenalty}`,
        ``,
        `## Disclaimer`,
        `- This is an automated best-effort pre-audit and not a legal certification.`,
        `- Manual accessibility verification is recommended for complex or low-quality PDFs.`,
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
            compliance,
            checks,
            findings,
          },
          null,
          2,
        ),
      });
      logScanPhase({
        event: "scan_run_process_complete",
        scanRunId: scanRun._id,
        assetId: asset._id,
        findingCount: findings.length,
        durationMs: nowMs() - runStartedAt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack =
        error instanceof Error && typeof error.stack === "string"
          ? error.stack.slice(0, 4000)
          : undefined;
      logScanPhase({
        event: "scan_run_process_failed",
        scanRunId: scanRun._id,
        assetId: asset._id,
        assetKind: asset.kind,
        durationMs: nowMs() - runStartedAt,
        errorMessage,
        errorStack,
      });
      await ctx.runMutation(internal.scans.failScanRun, {
        scanRunId: scanRun._id,
        failedAt: nowMs(),
        errorMessage,
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
      if (pageUrls.length <= 1) {
        const discoveryJobId = (await ctx.runMutation(
          internal.scans.enqueueExternalDiscoveryJob,
          {
            assetId: scanRun.assetId,
            sourceUrl: asset.normalizedUrl,
            maxUrls,
          },
        )) as Id<"externalDiscoveryJobs">;
        const pollDeadlineMs = nowMs() + 45_000;
        while (nowMs() < pollDeadlineMs) {
          const job = (await ctx.runQuery(internal.scans.getExternalDiscoveryJob, {
            jobId: discoveryJobId,
          })) as
            | {
                status: "queued" | "running" | "completed" | "failed";
                discoveredUrls?: string[];
              }
            | null;
          if (!job) break;
          if (job.status === "completed") {
            if (
              Array.isArray(job.discoveredUrls) &&
              job.discoveredUrls.length > pageUrls.length
            ) {
              pageUrls = job.discoveredUrls;
              logScanPhase({
                event: "discover_external_worker_fallback_used",
                scanRunId: args.scanRunId,
                discoveredUrls: pageUrls.length,
              });
            }
            break;
          }
          if (job.status === "failed") break;
          await sleep(1_000);
        }
      }
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
  handler: async (ctx, args) => {
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

export const e2ePdfScanSmoke = internalAction({
  args: {
    fileUrl: v.string(),
  },
  returns: v.object({
    fileUrl: v.string(),
    findingCount: v.number(),
    summary: v.object({
      total: v.number(),
      critical: v.number(),
      serious: v.number(),
      moderate: v.number(),
      minor: v.number(),
      info: v.number(),
      manualReviewRequired: v.number(),
    }),
    compliance: v.object({
      score: v.number(),
      band: v.union(v.literal("pass"), v.literal("warn"), v.literal("fail")),
      weightedPenalty: v.number(),
    }),
    rules: v.array(
      v.object({
        ruleId: v.string(),
        count: v.number(),
      }),
    ),
  }),
  handler: async (_ctx, args) => {
    const findings = await scanPdfFromFileUrl(args.fileUrl);
    const summary = computeSummary(findings);
    const compliance = computeCompliance(summary);
    const byRule = new Map<string, number>();
    for (const finding of findings) {
      byRule.set(finding.ruleId, (byRule.get(finding.ruleId) ?? 0) + 1);
    }
    return {
      fileUrl: args.fileUrl,
      findingCount: findings.length,
      summary,
      compliance,
      rules: Array.from(byRule.entries())
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

export const sleepForWorkflow = internalAction({
  args: {
    ms: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const delayMs = Math.max(50, Math.min(5_000, Number(args.ms ?? 750)));
    await sleep(delayMs);
    return null;
  },
});
