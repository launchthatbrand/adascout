"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import type { ColumnDefinition } from "@acme/ui/entity-list";
import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { EntityList } from "@acme/ui/entity-list";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";

type AssetRow = Record<string, unknown> & {
  id: string;
  kind: "url" | "file_pdf";
  title: string;
  source: string;
  status: string;
  sizeBytes?: number;
  createdAt: number;
  latestScanRunId?: string;
  latestScanStatus?: string;
  discoveredPagesCount?: number;
};

export default function AssetsPage() {
  const assets = useQuery(api.assets.listMyAssets, { limit: 200 });
  const scanRuns = useQuery(api.scans.listMyScanRuns, { limit: 300 });
  const createUrlAsset = useMutation(api.assets.createUrlAsset);
  const createPdfAsset = useMutation(api.assets.createPdfAsset);
  const deleteAsset = useMutation(api.assets.deleteMyAsset);
  const generateUploadUrl = useMutation(api.assets.generateAssetUploadUrl);
  const createScanRun = useMutation(api.scans.createScanRun);

  const assetIds = useMemo(() => (assets ?? []).map((a) => a._id), [assets]);
  const discoveredPagesQueries = useMemo(() => {
    return (assetIds ?? []).map((assetId) => ({
      assetId,
      data: useQuery(api.scans.listDiscoveredPages, { assetId }),
    }));
  }, [assetIds]);

  const discoveredPagesByAssetId = useMemo(() => {
    const map = new Map<string, number>();
    for (const query of discoveredPagesQueries) {
      if (query.data) {
        map.set(String(query.assetId), query.data.length);
      }
    }
    return map;
  }, [discoveredPagesQueries]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const latestByAsset = useMemo(() => {
    const map = new Map<
      string,
      { id: string; status: string; createdAt: number }
    >();
    for (const run of scanRuns ?? []) {
      const key = String(run.assetId);
      const existing = map.get(key);
      if (!existing || run.createdAt > existing.createdAt) {
        map.set(key, {
          id: String(run._id),
          status: run.status,
          createdAt: run.createdAt,
        });
      }
    }
    return map;
  }, [scanRuns]);

  const rows = useMemo<AssetRow[]>(
    () =>
      (assets ?? []).map((asset) => {
        const latest = latestByAsset.get(String(asset._id));
        const discoveredPagesCount = discoveredPagesByAssetId.get(
          String(asset._id),
        );
        return {
          id: String(asset._id),
          kind: asset.kind,
          title:
            asset.title ??
            asset.filename ??
            asset.sourceUrl ??
            String(asset._id),
          source:
            asset.kind === "url"
              ? (asset.normalizedUrl ?? asset.sourceUrl ?? "—")
              : (asset.filename ?? "Uploaded PDF"),
          status: asset.status,
          sizeBytes: asset.sizeBytes,
          createdAt: asset.createdAt,
          latestScanRunId: latest?.id,
          latestScanStatus: latest?.status,
          discoveredPagesCount,
        };
      }),
    [assets, latestByAsset, discoveredPagesByAssetId],
  );

  const columns = useMemo<ColumnDefinition<AssetRow>[]>(
    () => [
      {
        id: "title",
        header: "Asset",
        accessorKey: "title",
        cell: (row: AssetRow) => (
          <div className="space-y-1">
            <Link
              href={`/admin/assets/${row.id}`}
              className="font-medium underline underline-offset-4"
            >
              {row.title}
            </Link>
            <div className="text-muted-foreground text-xs">
              {row.kind === "url" ? "Website URL" : "PDF file"}
            </div>
          </div>
        ),
      },
      {
        id: "source",
        header: "Source",
        accessorKey: "source",
        cell: (row: AssetRow) => (
          <div className="text-sm break-all">{row.source}</div>
        ),
      },
      {
        id: "pages",
        header: "Pages",
        accessorKey: "discoveredPagesCount",
        cell: (row: AssetRow) =>
          row.kind === "url" ? (
            <span className="text-sm">
              {row.discoveredPagesCount !== undefined
                ? `${row.discoveredPagesCount}`
                : "—"}
            </span>
          ) : null,
      },
      {
        id: "scan",
        header: "Latest Scan",
        accessorKey: "latestScanStatus",
        cell: (row: AssetRow) =>
          row.latestScanRunId ? (
            <Link
              className="text-sm underline underline-offset-4"
              href={`/admin/scans/${row.latestScanRunId}`}
            >
              {row.latestScanStatus ?? "unknown"}
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">No scans yet</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        accessorKey: "id",
        cell: (row: AssetRow) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await createScanRun({ assetId: row.id as Id<"assets"> });
                  setStatusMessage("Scan queued.");
                } catch (error) {
                  setStatusMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to queue scan.",
                  );
                }
              }}
            >
              Scan
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deletingAssetId === row.id}
              onClick={async () => {
                const confirmed = window.confirm(
                  "Delete this asset and all related scan runs, pages, findings, and reports?",
                );
                if (!confirmed) return;
                try {
                  setDeletingAssetId(row.id);
                  await deleteAsset({ assetId: row.id as Id<"assets"> });
                  setStatusMessage("Asset deleted.");
                } catch (error) {
                  setStatusMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to delete asset.",
                  );
                } finally {
                  setDeletingAssetId(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [createScanRun, deleteAsset, deletingAssetId],
  );

  const handleCreateUrl = async () => {
    if (!urlValue.trim()) return;
    try {
      setIsSubmitting(true);
      const result = await createUrlAsset({
        sourceUrl: urlValue,
        title: urlTitle || undefined,
      });
      setStatusMessage(
        `URL asset added. ${result.discoveredPages.length} pages discovered.`,
      );
      setUrlDialogOpen(false);
      setUrlValue("");
      setUrlTitle("");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to add URL.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadPdf = async (file: File) => {
    try {
      setIsSubmitting(true);
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status}).`);
      }
      const payload = (await response.json()) as { storageId?: string };
      if (!payload.storageId) {
        throw new Error("Upload response did not include storageId.");
      }
      await createPdfAsset({
        storageId: payload.storageId as Id<"_storage">,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        title: file.name,
      });
      setStatusMessage("PDF asset uploaded.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to upload PDF.",
      );
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="min-h-0 flex-1 p-4">
      <EntityList<AssetRow>
        data={rows}
        columns={columns}
        title="Assets"
        description="Add website URLs and PDF files for WCAG 2.2 AA scanning."
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        isLoading={assets === undefined || scanRuns === undefined}
        getRowId={(row) => row.id}
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUploadPdf(file);
              }}
            />
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload PDF
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => setUrlDialogOpen(true)}
            >
              Add Website URL
            </Button>
          </div>
        }
      />

      {statusMessage ? (
        <p className="text-muted-foreground mt-3 text-xs" role="status">
          {statusMessage}
        </p>
      ) : null}

      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add website URL</DialogTitle>
            <DialogDescription>
              ADA Scout will run WCAG 2.2 AA automated checks and generate
              remediation guidance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="asset-title">Title (optional)</Label>
              <Input
                id="asset-title"
                value={urlTitle}
                onChange={(event) => setUrlTitle(event.target.value)}
                placeholder="Marketing site homepage"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-url">URL</Label>
              <Input
                id="asset-url"
                value={urlValue}
                onChange={(event) => setUrlValue(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateUrl()}
              disabled={isSubmitting || !urlValue.trim()}
            >
              {isSubmitting ? "Saving..." : "Add URL"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
