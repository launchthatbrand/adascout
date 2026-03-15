import { v } from "convex/values";

import { internalAction, internalMutation } from "./_generated/server";
import { requireUserId } from "./helpers";

const WP_CREDENTIALS_ENCRYPTION_KEY = "adascout-wp-key-v1";

function encrypt(text: string): string {
  const key = WP_CREDENTIALS_ENCRYPTION_KEY;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
    );
  }
  return Buffer.from(result, "binary").toString("base64");
}

function decrypt(encoded: string): string {
  const key = WP_CREDENTIALS_ENCRYPTION_KEY;
  const text = Buffer.from(encoded, "base64").toString("binary");
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
    );
  }
  return result;
}

export const connectWordPress = internalMutation({
  args: {
    assetId: v.id("assets"),
    wpUsername: v.string(),
    wpAppPassword: v.string(),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (
    ctx: MutationCtx,
    args: { assetId: string; wpUsername: string; wpAppPassword: string },
  ): Promise<{ success: boolean; error?: string }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId as any);
    if (!asset || asset.createdBy !== userId) {
      return { success: false, error: "Asset not found" };
    }

    if (!asset.normalizedUrl) {
      return { success: false, error: "Asset has no URL" };
    }

    const wpUrl = asset.normalizedUrl.replace(/\/$/, "");
    const apiUrl = `${wpUrl}/wp-json/adascout/validate`;

    const credentials = Buffer.from(
      `${args.wpUsername}:${args.wpAppPassword}`,
    ).toString("base64");

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: args.wpUsername }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Connection failed: ${response.statusText}`,
        };
      }

      const data = await response.json();
      if (!data.success) {
        return { success: false, error: "Invalid credentials" };
      }

      await ctx.db.patch(args.assetId as any, {
        wpUsername: args.wpUsername,
        wpAppPassword: encrypt(args.wpAppPassword),
        wpConnectedAt: Date.now(),
        updatedAt: Date.now(),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
});

export const disconnectWordPress = internalMutation({
  args: { assetId: v.id("assets") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx: MutationCtx, args: { assetId: string }) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId as any);
    if (!asset || asset.createdBy !== userId) {
      return { success: false };
    }

    await ctx.db.patch(args.assetId as any, {
      wpUsername: undefined,
      wpAppPassword: undefined,
      wpConnectedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const applyRemediationFix = internalAction({
  args: {
    assetId: v.id("assets"),
    findingId: v.id("findings"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx: MutationCtx,
    args: { assetId: string; findingId: string },
  ): Promise<{ success: boolean; error?: string }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId as any);
    if (!asset || asset.createdBy !== userId) {
      return { success: false, error: "Asset not found" };
    }

    if (!asset.wpUsername || !asset.wpAppPassword) {
      return { success: false, error: "WordPress not connected" };
    }

    const finding = await ctx.db.get(args.findingId as any);
    if (!finding) {
      return { success: false, error: "Finding not found" };
    }

    const wpUrl = asset.normalizedUrl?.replace(/\/$/, "");
    const apiUrl = `${wpUrl}/wp-json/adascout/fix`;

    const credentials = Buffer.from(
      `${asset.wpUsername}:${decrypt(asset.wpAppPassword)}`,
    ).toString("base64");

    const fixType = getFixType(finding.ruleId);
    if (!fixType) {
      return {
        success: false,
        error: `No automated fix available for ${finding.ruleId}`,
      };
    }

    const suggestedFix = generateFixSuggestion(finding.ruleId, finding.target);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: extractPostId(finding.pageUrl, wpUrl),
          element_id: extractElementId(finding.target),
          fix_type: fixType,
          fix_value: suggestedFix,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Fix failed: ${response.statusText}`,
        };
      }

      const data = await response.json();
      if (!data.success) {
        return { success: false, error: data.error || "Fix failed" };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Fix failed",
      };
    }
  },
});

function getFixType(ruleId: string): string | null {
  const fixMap: Record<string, string> = {
    "image-alt": "alt_text",
    "input-image-alt": "alt_text",
    "area-alt": "alt_text",
    "object-alt": "alt_text",
    "svg-img-alt": "alt_text",
  };
  return fixMap[ruleId] || null;
}

function generateFixSuggestion(ruleId: string, target: string): string {
  if (ruleId.includes("alt")) {
    return "Describe the image purpose concisely";
  }
  return target;
}

function extractElementId(target: string): string {
  if (!target) return target;
  if (target.startsWith("#")) {
    return target.slice(1);
  }
  if (target.includes(".")) {
    return target.split(".")[0].replace(/[^a-zA-Z0-9]/g, "");
  }
  return target.replace(/[^a-zA-Z0-9]/g, "");
}

function extractPostId(pageUrl: string, siteUrl: string): number | null {
  if (!pageUrl || !siteUrl) return null;
  const path = pageUrl.replace(siteUrl, "").replace(/^\//, "");
  const match = path.match(/(?:page|post|p)\/(\d+)/);
  if (match) return parseInt(match[1], 10);
  const slugMatch = path.match(/([^/]+)/);
  return slugMatch ? 1 : null;
}
