"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { RefreshCw, X } from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

type FindingRow = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  severityRank: number;
  source: "axe" | "ibm" | "pdf" | "stagehand";
  ruleId: string;
  pageUrl?: string;
  target?: string;
  description?: string;
  helpUrl?: string;
  assignee?: string;
  dueAt?: number;
  highlightId?: number;
  bboxX?: number;
  bboxY?: number;
  bboxWidth?: number;
  bboxHeight?: number;
  screenshotViewportWidth?: number;
  screenshotViewportHeight?: number;
  hasHotspot: boolean;
};

interface ScreenshotMetrics {
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
}

interface HotspotRow {
  findingId: string;
  highlightId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export default function PageDetailPage() {
  const toOptionalNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  const severityRank = (severity: FindingRow["severity"]) => {
    if (severity === "critical") return 5;
    if (severity === "serious") return 4;
    if (severity === "moderate") return 3;
    if (severity === "minor") return 2;
    return 1;
  };

  const params = useParams();
  const assetIdParam = params.assetId;
  const pageIdParam = params.pageId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;
  const pageId =
    typeof pageIdParam === "string"
      ? (pageIdParam as Id<"scanRunPages">)
      : undefined;

  const page = useQuery(
    api.scans.getMyScanRunPage,
    pageId ? { pageId } : "skip",
  );
  const pageScreenshotUrl = useQuery(
    api.scans.getMyScanRunPageScreenshotUrl,
    pageId ? { pageId } : "skip",
  );
  const createScanRun = useMutation(api.scans.createScanRun);
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState("");
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [screenshotMetrics, setScreenshotMetrics] =
    useState<ScreenshotMetrics | null>(null);
  const screenshotContainerRef = useRef<HTMLDivElement | null>(null);
  const screenshotImageRef = useRef<HTMLImageElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const findings = useQuery(
    api.findings.listMyFindingsByScanRun,
    page?.scanRunId && pageId
      ? {
          scanRunId: page.scanRunId,
          scanRunPageId: pageId,
          limit: 500,
        }
      : "skip",
  );

  const findingRows = useMemo<FindingRow[]>(
    () =>
      (findings ?? []).map((finding) => {
        const rawFinding = finding as Record<string, unknown>;
        const highlightId = toOptionalNumber(rawFinding.highlightId);
        const bboxX = toOptionalNumber(rawFinding.bboxX);
        const bboxY = toOptionalNumber(rawFinding.bboxY);
        const bboxWidth = toOptionalNumber(rawFinding.bboxWidth);
        const bboxHeight = toOptionalNumber(rawFinding.bboxHeight);
        const screenshotViewportWidth = toOptionalNumber(
          rawFinding.screenshotViewportWidth,
        );
        const screenshotViewportHeight = toOptionalNumber(
          rawFinding.screenshotViewportHeight,
        );
        return {
          id: String(finding._id),
          title: finding.title,
          status: finding.status ?? "open",
          severity: finding.severity,
          severityRank: severityRank(finding.severity),
          source: finding.source,
          ruleId: finding.ruleId,
          pageUrl: finding.pageUrl,
          target: finding.target,
          description: finding.description,
          helpUrl: finding.helpUrl,
          assignee: finding.assignee ? String(finding.assignee) : undefined,
          dueAt: finding.dueAt,
          highlightId,
          bboxX,
          bboxY,
          bboxWidth,
          bboxHeight,
          screenshotViewportWidth,
          screenshotViewportHeight,
          hasHotspot:
            typeof highlightId === "number" &&
            typeof bboxX === "number" &&
            typeof bboxY === "number" &&
            typeof bboxWidth === "number" &&
            typeof bboxHeight === "number",
        };
      }),
    [findings],
  );

  const hotspotRows = useMemo<HotspotRow[]>(
    () =>
      findingRows
        .filter(
          (
            row,
          ): row is FindingRow & {
            highlightId: number;
            bboxX: number;
            bboxY: number;
            bboxWidth: number;
            bboxHeight: number;
          } =>
            row.hasHotspot &&
            typeof row.highlightId === "number" &&
            typeof row.bboxX === "number" &&
            typeof row.bboxY === "number" &&
            typeof row.bboxWidth === "number" &&
            typeof row.bboxHeight === "number",
        )
        .map((row) => ({
          findingId: row.id,
          highlightId: row.highlightId,
          x: row.bboxX,
          y: row.bboxY,
          width: row.bboxWidth,
          height: row.bboxHeight,
          area: Math.max(1, row.bboxWidth * row.bboxHeight),
          viewportWidth: row.screenshotViewportWidth,
          viewportHeight: row.screenshotViewportHeight,
        }))
        .sort((a, b) => b.area - a.area),
    [findingRows],
  );

  const refreshScreenshotMetrics = useCallback(() => {
    const image = screenshotImageRef.current;
    if (!image) return;
    const renderedWidth = image.clientWidth;
    const renderedHeight = image.clientHeight;
    if (!renderedWidth || !renderedHeight) return;
    setScreenshotMetrics({
      naturalWidth: image.naturalWidth || renderedWidth,
      naturalHeight: image.naturalHeight || renderedHeight,
      renderedWidth,
      renderedHeight,
    });
  }, []);

  useEffect(() => {
    if (!pageScreenshotUrl) {
      setScreenshotMetrics(null);
      return;
    }
    refreshScreenshotMetrics();
    const handleResize = () => refreshScreenshotMetrics();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pageScreenshotUrl, refreshScreenshotMetrics]);

  const focusFindingHotspot = useCallback((findingId: string) => {
    const container = screenshotContainerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(
      `[data-hotspot-finding-id="${findingId}"]`,
    );
    if (!target) return;
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, []);

  const sidebarFindings = useMemo(
    () =>
      [...findingRows].sort((a, b) => {
        const aOrder = a.highlightId ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.highlightId ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        if (b.severityRank !== a.severityRank) return b.severityRank - a.severityRank;
        return a.title.localeCompare(b.title);
      }),
    [findingRows],
  );

  const selectedFinding = useMemo(
    () => findingRows.find((row) => row.id === selectedFindingId) ?? null,
    [findingRows, selectedFindingId],
  );
  const findingsWithoutHotspot = useMemo(
    () => findingRows.filter((row) => !row.hasHotspot).length,
    [findingRows],
  );

  useEffect(() => {
    if (selectedFindingId) return;
    if (sidebarFindings.length === 0) return;
    setSelectedFindingId(sidebarFindings[0]?.id ?? null);
  }, [selectedFindingId, sidebarFindings]);

  useEffect(() => {
    if (!selectedFindingId) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current?.contains(target)) return;
      if (
        target instanceof HTMLElement &&
        (target.closest("[data-hotspot-finding-id]") ||
          target.closest('[data-finding-sidebar-item="true"]'))
      ) {
        return;
      }
      setSelectedFindingId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedFindingId(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedFindingId]);

  if (page === undefined) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Loading page...</p>
      </div>
    );
  }

  if (page === null) {
    return (
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <p className="text-sm">Page not found.</p>
        {assetId && (
          <Link
            href={`/admin/assets/${assetId}/pages`}
            className="mt-2 inline-block text-sm underline underline-offset-4"
          >
            Back to Pages
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/assets/${assetId}/pages`}
            className="text-sm underline underline-offset-4"
          >
            Back to Pages
          </Link>
        </div>
      </div>

      <div className="border-border/60 bg-background rounded-xl border p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                Page
              </p>
              <h1 className="text-2xl font-semibold break-all">
                {page.pageUrl}
              </h1>
            </div>
            <Badge
              variant={
                page.status === "failed"
                  ? "destructive"
                  : page.status === "completed"
                    ? "default"
                    : page.status === "running"
                      ? "secondary"
                      : "outline"
              }
            >
              {page.status}
            </Badge>
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Page URL</p>
              <a
                href={page.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium break-all underline underline-offset-4"
              >
                {page.pageUrl}
              </a>
            </div>
            <div>
              <p className="text-muted-foreground">Scan ID</p>
              <p className="font-medium">
                {String(page.scanRunId).slice(0, 12)}...
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Attempt</p>
              <p className="font-medium">{page.attempt}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Findings</p>
              <p className="font-medium">
                {typeof page.findingCount === "number" ? page.findingCount : 0}
              </p>
            </div>
            {page.retryCount !== undefined && page.retryCount > 0 && (
              <div>
                <p className="text-muted-foreground">Retries</p>
                <p className="font-medium">{page.retryCount}</p>
              </div>
            )}
            {page.startedAt && (
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium">
                  {new Date(page.startedAt).toLocaleString()}
                </p>
              </div>
            )}
            {page.completedAt && (
              <div>
                <p className="text-muted-foreground">Completed</p>
                <p className="font-medium">
                  {new Date(page.completedAt).toLocaleString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p className="font-medium">
                {new Date(page.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {page.pageScreenshotStorageId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Page Screenshot</p>
                  <p className="text-sm font-medium">
                    {page.pageScreenshotCapturedAt
                      ? `Captured ${new Date(page.pageScreenshotCapturedAt).toLocaleString()}`
                      : "Captured during this page scan"}
                  </p>
                </div>
                {pageScreenshotUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={pageScreenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Full Screenshot
                    </a>
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="border-border/60 bg-muted/10 max-h-[70vh] overflow-auto rounded-lg border p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">{hotspotRows.length} hotspot(s)</Badge>
                    <Badge variant="outline">{sidebarFindings.length} issue(s)</Badge>
                    {findingsWithoutHotspot > 0 ? (
                      <Badge variant="outline">
                        {findingsWithoutHotspot} without hotspot
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {sidebarFindings.map((finding) => {
                      const isActive =
                        activeFindingId === finding.id ||
                        selectedFindingId === finding.id;
                      return (
                        <button
                          key={finding.id}
                          type="button"
                          data-finding-sidebar-item="true"
                          className={`w-full rounded-md border p-2 text-left transition ${
                            isActive
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-500/10"
                              : "border-border/60 bg-background hover:bg-muted/30"
                          }`}
                          onMouseEnter={() => setActiveFindingId(finding.id)}
                          onMouseLeave={() =>
                            setActiveFindingId((current) =>
                              current === finding.id ? null : current,
                            )
                          }
                          onClick={() => {
                            setSelectedFindingId(finding.id);
                            focusFindingHotspot(finding.id);
                          }}
                        >
                          <div className="mb-1 flex items-center gap-1">
                            <Badge
                              variant={
                                finding.severity === "critical" ||
                                finding.severity === "serious"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {finding.severity}
                            </Badge>
                            {finding.highlightId ? (
                              <Badge variant="secondary">#{finding.highlightId}</Badge>
                            ) : (
                              <Badge variant="outline">No hotspot</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{finding.title}</p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {finding.ruleId}
                          </p>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                            {finding.target ?? "No target selector"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </aside>
                {pageScreenshotUrl ? (
                  <div
                    ref={screenshotContainerRef}
                    className="border-border/60 bg-muted/20 max-h-[70vh] overflow-auto rounded-lg border p-2"
                  >
                    <div className="relative inline-block min-w-full">
                      <img
                        ref={screenshotImageRef}
                        src={pageScreenshotUrl}
                        alt={`Screenshot for ${page.pageUrl}`}
                        className="block h-auto w-full align-top"
                        onLoad={refreshScreenshotMetrics}
                      />
                      {screenshotMetrics
                        ? hotspotRows.map((hotspot) => {
                            const sourceWidth = Math.max(
                              1,
                              hotspot.viewportWidth ?? screenshotMetrics.naturalWidth,
                            );
                            const sourceHeight = Math.max(
                              1,
                              hotspot.viewportHeight ?? screenshotMetrics.naturalHeight,
                            );
                            const xScale = screenshotMetrics.renderedWidth / sourceWidth;
                            const yScale = screenshotMetrics.renderedHeight / sourceHeight;
                            const left = hotspot.x * xScale;
                            const top = hotspot.y * yScale;
                            const width = Math.max(12, hotspot.width * xScale);
                            const height = Math.max(12, hotspot.height * yScale);
                            const isActive =
                              activeFindingId === hotspot.findingId ||
                              selectedFindingId === hotspot.findingId;
                            return (
                              <button
                                key={hotspot.findingId}
                                type="button"
                                data-hotspot-finding-id={hotspot.findingId}
                                aria-label={`Hotspot ${hotspot.highlightId}`}
                                title={`#${hotspot.highlightId}`}
                                onMouseEnter={() => setActiveFindingId(hotspot.findingId)}
                                onMouseLeave={() =>
                                  setActiveFindingId((current) =>
                                    current === hotspot.findingId ? null : current,
                                  )
                                }
                                onClick={() =>
                                  setSelectedFindingId((current) =>
                                    current === hotspot.findingId
                                      ? null
                                      : hotspot.findingId,
                                  )
                                }
                                className={`absolute rounded-sm border-2 transition ${
                                  isActive
                                    ? "border-amber-400 bg-amber-400/20 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]"
                                    : "border-red-500/90 bg-red-500/10"
                                }`}
                                style={{
                                  left,
                                  top,
                                  width,
                                  height,
                                  zIndex: isActive
                                    ? 40
                                    : Math.max(
                                        10,
                                        30 - Math.floor(Math.log10(hotspot.area)),
                                      ),
                                }}
                              >
                                <span className="absolute -top-5 left-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {hotspot.highlightId}
                                </span>
                              </button>
                            );
                          })
                        : null}
                      {screenshotMetrics &&
                      selectedFinding?.hasHotspot &&
                      typeof selectedFinding.bboxX === "number" &&
                      typeof selectedFinding.bboxY === "number" ? (
                        <div
                          ref={popoverRef}
                          className="bg-background/95 border-border absolute z-60 max-w-xs rounded-md border p-2 text-xs shadow-lg"
                          style={{
                            left: Math.min(
                              screenshotMetrics.renderedWidth - 260,
                              selectedFinding.bboxX *
                                (screenshotMetrics.renderedWidth /
                                  Math.max(
                                    1,
                                    selectedFinding.screenshotViewportWidth ??
                                      screenshotMetrics.naturalWidth,
                                  )),
                            ),
                            top: Math.max(
                              8,
                              selectedFinding.bboxY *
                                (screenshotMetrics.renderedHeight /
                                  Math.max(
                                    1,
                                    selectedFinding.screenshotViewportHeight ??
                                      screenshotMetrics.naturalHeight,
                                  )) -
                                74,
                            ),
                          }}
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <p className="font-semibold">
                              #{selectedFinding.highlightId} {selectedFinding.title}
                            </p>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Close finding popover"
                              onClick={() => setSelectedFindingId(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-muted-foreground">
                            {selectedFinding.severity} · {selectedFinding.ruleId}
                          </p>
                          <p className="mt-1 line-clamp-2">
                            {selectedFinding.target ?? "No target selector"}
                          </p>
                          {assetId ? (
                            <Link
                              href={`/admin/assets/${assetId}/findings/${selectedFinding.id}`}
                              className="mt-2 inline-block underline underline-offset-4"
                            >
                              Open finding detail
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Loading screenshot...
                  </p>
                )}
              </div>
            </div>
          )}

          {page.errorMessage && (
            <div>
              <p className="text-muted-foreground text-sm">Error</p>
              <p className="text-destructive mt-1">
                {page.terminalErrorCategory
                  ? `[${page.terminalErrorCategory}] `
                  : ""}
                {page.errorMessage}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" asChild>
              <a href={page.pageUrl} target="_blank" rel="noopener noreferrer">
                Visit Page
              </a>
            </Button>
            <Button
              variant="outline"
              disabled={isRescanning || !page.pageUrl}
              onClick={async () => {
                if (!assetId || !page.pageUrl) return;
                try {
                  setIsRescanning(true);
                  setRescanMessage("");
                  await createScanRun({
                    assetId,
                    pageUrls: [page.pageUrl],
                  });
                  setRescanMessage(
                    "Scan queued. You can stay on this page and refresh when ready.",
                  );
                } catch (error) {
                  setRescanMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to queue scan",
                  );
                } finally {
                  setIsRescanning(false);
                }
              }}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRescanning ? "animate-spin" : ""}`}
              />
              {isRescanning ? "Queuing..." : "Rescan Page"}
            </Button>
            {rescanMessage && (
              <span className="text-muted-foreground self-center text-sm">
                {rescanMessage}
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
