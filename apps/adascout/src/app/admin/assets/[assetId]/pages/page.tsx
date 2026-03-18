"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import type { ColumnDefinition } from "@acme/ui/entity-list";
import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import { EntityList } from "@acme/ui/entity-list";

type PageRow = Record<string, unknown> & {
  id: string;
  stableId: boolean;
  url: string;
  status: string;
  attempt: number;
  findingCount?: number;
  updatedAt: number;
  errorMessage?: string;
  retryCount?: number;
  terminalErrorCategory?: string;
  scanRunId?: string;
};

export default function AssetPagesPage() {
  const params = useParams();
  const assetIdParam = params.assetId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;

  const allPages = useQuery(
    api.scans.listMyScanRunPagesByAsset,
    assetId ? { assetId, limit: 2000 } : "skip",
  );
  const detectedPages = useQuery(
    api.scans.listDiscoveredPages,
    assetId ? { assetId, limit: 2000 } : "skip",
  );
  const createScanRun = useMutation(api.scans.createScanRun);
  const normalizeDiscoveredPagesForAsset = useMutation(
    api.scans.normalizeDiscoveredPagesForAsset,
  );
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [scanActionMessage, setScanActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    void normalizeDiscoveredPagesForAsset({ assetId }).catch(() => undefined);
  }, [assetId, normalizeDiscoveredPagesForAsset]);

  const pageRows = useMemo<PageRow[]>(() => {
    const normalizePageUrl = (value: string): string => {
      try {
        const parsed = new URL(value);
        parsed.hash = "";
        parsed.pathname =
          parsed.pathname === "/"
            ? "/"
            : parsed.pathname.replace(/\/+$/, "") || "/";
        return parsed.toString().toLowerCase();
      } catch {
        return value.trim().toLowerCase();
      }
    };

    const mergedByUrl = new Map<string, PageRow>();

    for (const row of detectedPages ?? []) {
      const key = normalizePageUrl(row.pageUrl);
      mergedByUrl.set(key, {
        id: String(row._id),
        stableId: true,
        url: row.pageUrl,
        status: row.lastScanStatus ?? "discovered",
        attempt: 0,
        findingCount: row.lastFindingCount,
        updatedAt: row.lastScannedAt ?? row.discoveredAt,
        errorMessage: undefined,
        retryCount: 0,
        terminalErrorCategory: undefined,
        scanRunId: undefined,
      });
    }

    for (const row of allPages ?? []) {
      const key = normalizePageUrl(row.pageUrl);
      const existing = mergedByUrl.get(key);
      mergedByUrl.set(key, {
        id: existing?.id ?? String(row._id),
        stableId: existing?.stableId ?? false,
        url: row.pageUrl,
        status: row.status,
        attempt: row.attempt,
        findingCount: row.findingCount,
        updatedAt: row.updatedAt,
        errorMessage: row.errorMessage,
        retryCount: row.retryCount,
        terminalErrorCategory: row.terminalErrorCategory,
        scanRunId: String(row.scanRunId),
      });
    }

    return Array.from(mergedByUrl.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }, [allPages, detectedPages]);

  const pageColumns = useMemo<ColumnDefinition<PageRow>[]>(
    () => [
      {
        id: "url",
        header: "Page URL",
        accessorKey: "url",
        cell: (row: PageRow) => (
          row.stableId ? (
            <Link
              href={`/admin/assets/${assetId}/pages/${row.id}`}
              className="text-left break-all underline underline-offset-4"
            >
              {row.url}
            </Link>
          ) : (
            <span className="text-left break-all">{row.url}</span>
          )
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        sortable: true,
        cell: (row: PageRow) => {
          const variant =
            row.status === "failed"
              ? "destructive"
              : row.status === "completed"
                ? "default"
                : row.status === "running"
                  ? "secondary"
                  : "outline";
          return <Badge variant={variant}>{row.status}</Badge>;
        },
      },
      { id: "attempt", header: "Attempt", accessorKey: "attempt" },
      {
        id: "findings",
        header: "Findings",
        accessorKey: "findingCount",
        cell: (row: PageRow) =>
          typeof row.findingCount === "number" ? row.findingCount : "—",
      },
      {
        id: "retryCount",
        header: "Retries",
        accessorKey: "retryCount",
        cell: (row: PageRow) => row.retryCount ?? 0,
      },
      {
        id: "scanRunId",
        header: "Scan ID",
        accessorKey: "scanRunId",
        cell: (row: PageRow) => (
          <span className="text-muted-foreground text-xs">
            {row.scanRunId ? `${row.scanRunId.slice(0, 12)}...` : "—"}
          </span>
        ),
      },
      {
        id: "updated",
        header: "Updated",
        accessorKey: "updatedAt",
        sortable: true,
        cell: (row: PageRow) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.updatedAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: PageRow) => (
          <div className="flex items-center gap-2">
            {row.stableId ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/admin/assets/${assetId}/pages/${row.id}`}>
                  View
                </Link>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={!assetId || isStartingScan}
              onClick={async () => {
                if (!assetId) return;
                try {
                  setIsStartingScan(true);
                  setScanActionMessage(null);
                  const scanRunId = await createScanRun({
                    assetId,
                    pageUrls: [row.url],
                  });
                  setScanActionMessage(
                    `Started single-page scan for ${row.url}. Scan: ${String(scanRunId).slice(0, 12)}...`,
                  );
                } catch (error) {
                  setScanActionMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to start single-page scan.",
                  );
                } finally {
                  setIsStartingScan(false);
                }
              }}
            >
              Scan Page
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={row.url} target="_blank" rel="noopener noreferrer">
                Visit
              </a>
            </Button>
          </div>
        ),
      },
      {
        id: "error",
        header: "Error",
        accessorKey: "errorMessage",
        cell: (row: PageRow) =>
          row.errorMessage ? (
            <span className="text-destructive text-xs">
              {row.terminalErrorCategory
                ? `[${row.terminalErrorCategory}] `
                : ""}
              {row.errorMessage}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
    ],
    [assetId, createScanRun, isStartingScan],
  );

  const allPageUrls = useMemo(
    () =>
      Array.from(
        new Set(
          pageRows
            .map((row) => String(row.url ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      ),
    [pageRows],
  );

  return (
    <div className="border-border/60 bg-background rounded-xl border p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!assetId || isStartingScan || allPageUrls.length === 0}
          onClick={async () => {
            if (!assetId || allPageUrls.length === 0) return;
            try {
              setIsStartingScan(true);
              setScanActionMessage(null);
              const scanRunId = await createScanRun({
                assetId,
                pageUrls: allPageUrls,
              });
              setScanActionMessage(
                `Started full page scan for ${allPageUrls.length} page(s). Scan: ${String(scanRunId).slice(0, 12)}...`,
              );
            } catch (error) {
              setScanActionMessage(
                error instanceof Error
                  ? error.message
                  : "Failed to start full page scan.",
              );
            } finally {
              setIsStartingScan(false);
            }
          }}
        >
          {isStartingScan
            ? "Starting..."
            : `Scan All Pages (${allPageUrls.length})`}
        </Button>
        <p className="text-muted-foreground text-xs">
          Use this to scan all pages across the asset (not limited to the first
          table page).
        </p>
      </div>
      <EntityList<PageRow>
        data={pageRows}
        columns={pageColumns}
        title="All Pages"
        description={
          (allPages?.length ?? 0) > 0
            ? "All pages scanned for this asset across all scans."
            : "Detected pages for this asset. Run a scan to populate per-page scan results."
        }
        defaultViewMode="list"
        viewModes={[]}
        enableRowSelection
        bulkActions={({ selectedItems, clearSelection }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!assetId || isStartingScan || selectedItems.length === 0}
              onClick={async () => {
                if (!assetId || selectedItems.length === 0) return;
                const uniqueUrls = Array.from(
                  new Set(
                    selectedItems
                      .map((item) => String(item.url ?? "").trim())
                      .filter((value) => value.length > 0),
                  ),
                );
                if (uniqueUrls.length === 0) return;
                try {
                  setIsStartingScan(true);
                  setScanActionMessage(null);
                  const scanRunId = await createScanRun({
                    assetId,
                    pageUrls: uniqueUrls,
                  });
                  setScanActionMessage(
                    `Started scan for ${uniqueUrls.length} page(s). Scan: ${String(scanRunId).slice(0, 12)}...`,
                  );
                  clearSelection();
                } catch (error) {
                  setScanActionMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to start bulk page scan.",
                  );
                } finally {
                  setIsStartingScan(false);
                }
              }}
            >
              {isStartingScan ? "Starting..." : `Scan Selected (${selectedItems.length})`}
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Clear Selection
            </Button>
          </div>
        )}
        enableSearch
        isLoading={allPages === undefined || detectedPages === undefined}
        getRowId={(row) => row.id}
      />
      {scanActionMessage ? (
        <p className="text-muted-foreground mt-3 text-xs">{scanActionMessage}</p>
      ) : null}
    </div>
  );
}
