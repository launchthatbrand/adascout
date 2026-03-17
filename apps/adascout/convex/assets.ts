import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { normalizeHttpUrl, nowMs, requireUserId } from "./helpers";
import {
  assetKindValidator,
  assetStatusValidator,
  urlAssetScopeValidator,
} from "./scanTypes";

export const generateAssetUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createUrlAsset = mutation({
  args: {
    sourceUrl: v.string(),
    title: v.optional(v.string()),
    autoDiscover: v.optional(v.boolean()),
    scanScope: v.optional(urlAssetScopeValidator),
  },
  returns: v.object({
    assetId: v.id("assets"),
    discoveredPages: v.array(v.any()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ assetId: Id<"assets">; discoveredPages: unknown[] }> => {
    const userId = await requireUserId(ctx);
    const normalizedUrl = normalizeHttpUrl(args.sourceUrl);
    const urlScope = args.scanScope ?? "website";
    const existing = await ctx.db
      .query("assets")
      .withIndex("by_createdBy_normalizedUrl", (q) =>
        q.eq("createdBy", userId).eq("normalizedUrl", normalizedUrl),
      )
      .first();
    let assetId: Id<"assets">;
    if (existing) {
      assetId = existing._id;
      if (existing.kind === "url") {
        await ctx.db.patch(existing._id, {
          title: args.title?.trim() ?? existing.title,
          sourceUrl: args.sourceUrl.trim(),
          normalizedUrl,
          urlScope,
          updatedAt: nowMs(),
        });
      }
    } else {
      const now = nowMs();
      assetId = await ctx.db.insert("assets", {
        kind: "url",
        urlScope,
        status: "ready",
        title: args.title?.trim() ?? undefined,
        sourceUrl: args.sourceUrl.trim(),
        normalizedUrl,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    const discovered =
      args.autoDiscover !== false
        ? await ctx.runMutation(api.scans.discoverPages, { assetId })
        : [];
    return { assetId, discoveredPages: discovered };
  },
});

export const createPdfAsset = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.optional(v.string()),
    contentType: v.optional(v.string()),
    sizeBytes: v.number(),
    title: v.optional(v.string()),
  },
  returns: v.id("assets"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const contentType = args.contentType?.trim().toLowerCase() ?? "";
    if (contentType && !contentType.includes("pdf")) {
      throw new Error("Only PDF uploads are supported.");
    }
    const maxPdfBytes = 25 * 1024 * 1024;
    if (args.sizeBytes <= 0 || args.sizeBytes > maxPdfBytes) {
      throw new Error(
        `PDF size must be between 1 byte and ${maxPdfBytes} bytes.`,
      );
    }
    const now = nowMs();
    return await ctx.db.insert("assets", {
      kind: "file_pdf",
      status: "ready",
      title: args.title?.trim() ?? args.filename?.trim() ?? undefined,
      storageId: args.storageId,
      filename: args.filename?.trim() ?? undefined,
      contentType: args.contentType?.trim() ?? undefined,
      sizeBytes: args.sizeBytes,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listMyAssets = query({
  args: {
    limit: v.optional(v.number()),
    kind: v.optional(assetKindValidator),
    status: v.optional(assetStatusValidator),
  },
  returns: v.array(
    v.object({
      _id: v.id("assets"),
      _creationTime: v.number(),
      kind: assetKindValidator,
      urlScope: v.optional(urlAssetScopeValidator),
      status: assetStatusValidator,
      title: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      normalizedUrl: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      filename: v.optional(v.string()),
      contentType: v.optional(v.string()),
      sizeBytes: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      fileUrl: v.union(v.string(), v.null()),
      mondayConnectedAt: v.optional(v.number()),
      mondayBoardId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(200, Number(args.limit ?? 50)));
    const rows = await ctx.db
      .query("assets")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .order("desc")
      .take(limit);

    const filtered = rows.filter((row) => {
      if (args.kind && row.kind !== args.kind) return false;
      if (args.status && row.status !== args.status) return false;
      return true;
    });

    const result = [];
    for (const row of filtered) {
      const fileUrl = row.storageId
        ? await ctx.storage.getUrl(row.storageId)
        : null;
      result.push({
        _id: row._id,
        _creationTime: row._creationTime,
        kind: row.kind,
        urlScope: row.urlScope,
        status: row.status,
        title: row.title,
        sourceUrl: row.sourceUrl,
        normalizedUrl: row.normalizedUrl,
        storageId: row.storageId,
        filename: row.filename,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        fileUrl,
        mondayConnectedAt: row.mondayConnectedAt,
        mondayBoardId: row.mondayBoardId,
      });
    }
    return result;
  },
});

export const getMyAsset = query({
  args: { assetId: v.id("assets") },
  returns: v.union(
    v.object({
      _id: v.id("assets"),
      kind: assetKindValidator,
      urlScope: v.optional(urlAssetScopeValidator),
      status: assetStatusValidator,
      title: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      normalizedUrl: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      filename: v.optional(v.string()),
      contentType: v.optional(v.string()),
      sizeBytes: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      fileUrl: v.union(v.string(), v.null()),
      mondayConnectedAt: v.optional(v.number()),
      mondayBoardId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.assetId);
    if (!row || row.createdBy !== userId) {
      return null;
    }
    const fileUrl = row.storageId
      ? await ctx.storage.getUrl(row.storageId)
      : null;
    return {
      _id: row._id,
      kind: row.kind,
      urlScope: row.urlScope,
      status: row.status,
      title: row.title,
      sourceUrl: row.sourceUrl,
      normalizedUrl: row.normalizedUrl,
      storageId: row.storageId,
      filename: row.filename,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      fileUrl,
      mondayConnectedAt: row.mondayConnectedAt,
      mondayBoardId: row.mondayBoardId,
    };
  },
});

export const deleteMyAsset = mutation({
  args: { assetId: v.id("assets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      throw new ConvexError("Asset not found.");
    }

    const scanRuns = await ctx.db
      .query("scanRuns")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", args.assetId))
      .collect();
    for (const scanRun of scanRuns) {
      await ctx.runMutation(internal.scans.deleteScanRunCascadeInternal, {
        scanRunId: scanRun._id,
      });
    }

    if (asset.storageId) {
      await ctx.storage.delete(asset.storageId);
    }

    await ctx.db.delete(args.assetId);
    return null;
  },
});
