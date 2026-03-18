import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireUserId } from "./helpers";

const MONDAY_CREDENTIALS_ENCRYPTION_KEY = "adascout-monday-key-v1";

function encrypt(text: string): string {
  const key = MONDAY_CREDENTIALS_ENCRYPTION_KEY;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
    );
  }
  return Buffer.from(result, "binary").toString("base64");
}

function decrypt(encoded: string): string {
  const key = MONDAY_CREDENTIALS_ENCRYPTION_KEY;
  const text = Buffer.from(encoded, "base64").toString("binary");
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
    );
  }
  return result;
}

async function mondayApiRequest(
  apiToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: unknown; errors?: unknown }> {
  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  return response.json();
}

export const connectMonday = mutation({
  args: {
    assetId: v.id("assets"),
    mondayApiToken: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    boardId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; boardId?: string; error?: string }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { success: false, error: "Asset not found" };
    }

    const validateQuery = `query { me { id name } }`;
    const validationResult = await mondayApiRequest(
      args.mondayApiToken,
      validateQuery,
    );

    if (validationResult.errors) {
      return { success: false, error: "Invalid API token" };
    }

    const boardName =
      asset.title || asset.normalizedUrl || "Adascout Scan Results";
    const createBoardMutation = `mutation { create_board(board_name: "${boardName}", board_kind: "public") { id } }`;
    const boardResult = await mondayApiRequest(
      args.mondayApiToken,
      createBoardMutation,
    );

    if (validationResult.errors || !boardResult.data) {
      return { success: false, error: "Failed to create board" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boardId = (boardResult.data as any).create_board.id;

    const columns = [
      { type: "text", title: "Page Name", id: "page_name" },
      { type: "status", title: "Status", id: "status" },
      { type: "status", title: "Severity", id: "severity" },
      { type: "date", title: "Date Initial Scan", id: "date_initial" },
      { type: "date", title: "Date Last Scan", id: "date_last" },
    ];

    for (const col of columns) {
      const createColMutation = `mutation { create_column(board_id: ${boardId}, column_type: "${col.type}", title: "${col.title}") { id } }`;
      await mondayApiRequest(args.mondayApiToken, createColMutation);
    }

    await ctx.db.patch(args.assetId, {
      mondayApiToken: encrypt(args.mondayApiToken),
      mondayBoardId: boardId,
      mondayConnectedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, boardId };
  },
});

export const disconnectMonday = mutation({
  args: { assetId: v.id("assets") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { success: false };
    }

    await ctx.db.patch(args.assetId, {
      mondayApiToken: undefined,
      mondayBoardId: undefined,
      mondayConnectedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const syncPages = mutation({
  args: { assetId: v.id("assets") },
  returns: v.object({
    success: v.boolean(),
    itemCount: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; itemCount: number; error?: string }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { success: false, itemCount: 0, error: "Asset not found" };
    }

    if (!asset.mondayApiToken || !asset.mondayBoardId) {
      return { success: false, itemCount: 0, error: "Monday not connected" };
    }

    const apiToken = decrypt(asset.mondayApiToken);
    const boardId = asset.mondayBoardId;

    const pages = await ctx.db
      .query("discoveredPages")
      .withIndex("by_asset_discoveredAt", (q) => q.eq("assetId", args.assetId))
      .collect();

    if (pages.length === 0) {
      return { success: true, itemCount: 0 };
    }

    const isFirstSync = !pages.some((p) => p.lastScannedAt);
    const now = new Date().toISOString().split("T")[0];

    let itemCount = 0;
    for (const page of pages) {
      const urlParts = page.normalizedUrl.split("/");
      const pageName =
        urlParts[urlParts.length - 1] ||
        urlParts[urlParts.length - 2] ||
        page.normalizedUrl;

      const dateColumn = isFirstSync ? "date_initial" : "date_last";
      const dateValue = now;

      const createItemMutation = `mutation { create_item(board_id: ${boardId}, item_name: "${pageName}", column_values: "{\\"page_name\\":\\"${page.normalizedUrl}\\",\\"${dateColumn}\\":\\"${dateValue}\\"}") { id } }`;

      try {
        await mondayApiRequest(apiToken, createItemMutation);
        itemCount++;
      } catch (e) {
        console.error("Failed to create item for page:", page.normalizedUrl, e);
      }
    }

    return { success: true, itemCount };
  },
});

export const syncFindings = mutation({
  args: {
    assetId: v.id("assets"),
    scanRunId: v.id("scanRuns"),
  },
  returns: v.object({
    success: v.boolean(),
    subitemCount: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; subitemCount: number; error?: string }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { success: false, subitemCount: 0, error: "Asset not found" };
    }

    if (!asset.mondayApiToken || !asset.mondayBoardId) {
      return { success: false, subitemCount: 0, error: "Monday not connected" };
    }

    const apiToken = decrypt(asset.mondayApiToken);
    const boardId = asset.mondayBoardId;

    const findings = await ctx.db
      .query("findings")
      .withIndex("by_scanRun_createdAt", (q) =>
        q.eq("scanRunId", args.scanRunId),
      )
      .collect();

    if (findings.length === 0) {
      return { success: true, subitemCount: 0 };
    }

    const findingsByPage: Record<string, typeof findings> = {};
    for (const finding of findings) {
      const pageUrl = finding.pageUrl || "unknown";
      if (!findingsByPage[pageUrl]) {
        findingsByPage[pageUrl] = [];
      }
      findingsByPage[pageUrl].push(finding);
    }

    const getItemsQuery = `query { boards(ids: [${boardId}]) { items_page { items { id name } } } }`;
    const itemsResult = await mondayApiRequest(apiToken, getItemsQuery);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items =
      (itemsResult.data as any)?.boards?.[0]?.items_page?.items || [];
    const itemByName: Record<string, string> = {};
    for (const item of items) {
      itemByName[item.name] = item.id;
    }

    let subitemCount = 0;
    const severityMap: Record<string, string> = {
      critical: "Critical",
      serious: "High",
      moderate: "Medium",
      minor: "Low",
      info: "Low",
    };

    const statusMap: Record<string, string> = {
      open: "Working on it",
      in_progress: "Stuck",
      resolved: "Done",
      verified_on_resolved: "Done",
      regressed: "Not Done",
    };

    for (const [pageUrl, pageFindings] of Object.entries(findingsByPage)) {
      const urlParts = pageUrl.split("/");
      const pageName =
        urlParts[urlParts.length - 1] ||
        urlParts[urlParts.length - 2] ||
        pageUrl;

      const parentItemId = itemByName[pageName];
      if (!parentItemId) {
        console.log("Parent item not found for:", pageName);
        continue;
      }

      for (const finding of pageFindings) {
        const statusValue =
          statusMap[finding.status || "open"] || "Working on it";
        const severityValue = severityMap[finding.severity || "minor"] || "Low";
        const now = new Date().toISOString().split("T")[0];

        const createSubitemMutation = `mutation { create_subitem(parent_item_id: ${parentItemId}, item_name: "${finding.title.substring(0, 50)}", column_values: "{\\"status\\":{\\"label\\":\\"${statusValue}\\"},\\"severity\\":{\\"label\\":\\"${severityValue}\\"},\\"date_initial\\":\\"${now}\\"}") { id } }`;

        try {
          await mondayApiRequest(apiToken, createSubitemMutation);
          subitemCount++;
        } catch (e) {
          console.error(
            "Failed to create subitem for finding:",
            finding.title,
            e,
          );
        }
      }
    }

    return { success: true, subitemCount };
  },
});
