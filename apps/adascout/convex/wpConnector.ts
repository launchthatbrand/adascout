import { v } from "convex/values";

import { internalAction, mutation } from "./_generated/server";
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

export const connectWordPress = mutation({
  args: {
    assetId: v.id("assets"),
    wpUsername: v.string(),
    wpAppPassword: v.string(),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { success: false, error: "Asset not found" };
    }

    if (!asset.normalizedUrl) {
      return { success: false, error: "Asset has no URL" };
    }

    const wpUrl = asset.normalizedUrl.replace(/\/$/, "");
    const apiUrl = `${wpUrl}/wp-json/wp/v2/users/me`;

    const credentials = Buffer.from(
      `${args.wpUsername}:${args.wpAppPassword}`,
    ).toString("base64");

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Connection failed: ${response.statusText}`,
        };
      }

      await ctx.db.patch(args.assetId, {
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

export const disconnectWordPress = mutation({
  args: { assetId: v.id("assets") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { success: false };
    }

    await ctx.db.patch(args.assetId, {
      wpUsername: undefined,
      wpAppPassword: undefined,
      wpConnectedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const applyRemediationFix = mutation({
  args: {
    assetId: v.id("assets"),
    findingId: v.id("findings"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { success: false, error: "Asset not found" };
    }

    if (!asset.wpUsername || !asset.wpAppPassword) {
      return { success: false, error: "WordPress not connected" };
    }

    const finding = await ctx.db.get(args.findingId);
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

    const suggestedFix = generateFixSuggestion(
      finding.ruleId,
      finding.target ?? "",
    );

    try {
      if (!wpUrl) {
        return { success: false, error: "WordPress URL not found" };
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: extractPostId(finding.pageUrl ?? "", wpUrl),
          element_id: getElementIdFromTarget(finding.target ?? "").elementId,
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
  const fixMap: Record<string, string | null> = {
    "image-alt": "alt_text",
    "input-image-alt": "alt_text",
    "area-alt": "alt_text",
    "object-alt": "alt_text",
    "svg-img-alt": "alt_text",
    "link-name": "link_text",
    "anchor-name": "link_text",
    "heading-order": "heading_size",
  };
  return fixMap[ruleId] ?? null;
}

function generateFixSuggestion(
  ruleId: string,
  target: string,
  finding?: { title?: string; description?: string },
): string {
  if (ruleId.includes("alt")) {
    if (finding?.title) {
      return (
        finding.title
          .replace(/^(Image of|Photo of|Picture of|Icon of|alt:?\s*)/i, "")
          .trim() || "Accessible image description"
      );
    }
    if (finding?.description) {
      return finding.description.substring(0, 150);
    }
    return "Describe the image purpose concisely";
  }

  if (ruleId.includes("link-name") || ruleId.includes("anchor-name")) {
    if (finding?.title) {
      return finding.title;
    }
    return "Descriptive link text";
  }

  if (ruleId === "heading-order") {
    return "h2";
  }

  return target;
}

function getElementIdFromTarget(
  target: string,
  pageUrl?: string,
): { elementId?: string; postId?: number } {
  if (!target) return {};

  if (target.startsWith("#")) {
    const elementId = target.slice(1);
    return { elementId };
  }

  if (target.includes(".")) {
    const elementId = target.split(".")[0].replace(/[^a-zA-Z0-9_-]/g, "");
    return { elementId };
  }

  if (target.startsWith("img[")) {
    const altMatch = target.match(/\[alt=(["'])(.*?)\1/);
    if (altMatch) {
      return {
        elementId: `img-${altMatch[2].substring(0, 20).replace(/\s+/g, "-")}`,
      };
    }
  }

  return { elementId: target.replace(/[^a-zA-Z0-9_-]/g, "") };
}

function extractPostId(pageUrl: string, siteUrl: string): number | null {
  if (!pageUrl || !siteUrl) return null;
  const path = pageUrl.replace(siteUrl, "").replace(/^\//, "");
  const match = path.match(/(?:page|post|p)\/(\d+)/);
  if (match) return parseInt(match[1], 10);
  const slugMatch = path.match(/([^/]+)/);
  return slugMatch ? 1 : null;
}

export const getWpConnectionStatus = mutation({
  args: { assetId: v.id("assets") },
  returns: v.object({
    connected: v.boolean(),
    siteUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return { connected: false };
    }

    const isConnected = !!(asset.wpConnectedAt && asset.wpUsername);
    return {
      connected: isConnected,
      siteUrl: asset.normalizedUrl,
    };
  },
});

export const getElementorPages = mutation({
  args: { assetId: v.id("assets") },
  returns: v.array(
    v.object({
      id: v.number(),
      title: v.string(),
      status: v.string(),
      url: v.string(),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{ id: number; title: string; status: string; url: string }>
  > => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return [];
    }

    if (!asset.wpUsername || !asset.wpAppPassword || !asset.normalizedUrl) {
      return [];
    }

    const wpUrl = asset.normalizedUrl.replace(/\/$/, "");
    const apiUrl = `${wpUrl}/wp-json/adascout/v1/pages`;

    const credentials = Buffer.from(
      `${asset.wpUsername}:${decrypt(asset.wpAppPassword)}`,
    ).toString("base64");

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch {
      return [];
    }
  },
});

export const fixAllPageIssues = mutation({
  args: {
    assetId: v.id("assets"),
    pageUrl: v.string(),
    findingIds: v.array(v.id("findings")),
  },
  returns: v.object({
    success: v.boolean(),
    fixedCount: v.number(),
    failedCount: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    fixedCount: number;
    failedCount: number;
    errors: string[];
  }> => {
    const userId = await requireUserId(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.createdBy !== userId) {
      return {
        success: false,
        fixedCount: 0,
        failedCount: 0,
        errors: ["Asset not found"],
      };
    }

    if (!asset.wpUsername || !asset.wpAppPassword || !asset.normalizedUrl) {
      return {
        success: false,
        fixedCount: 0,
        failedCount: 0,
        errors: ["WordPress not connected"],
      };
    }

    const findings = await Promise.all(
      args.findingIds.map((id) => ctx.db.get(id)),
    );

    const validFindings = findings.filter((f) => f !== null);
    const issues = validFindings
      .map((finding) => {
        const { elementId } = getElementIdFromTarget(
          finding!.target ?? "",
          args.pageUrl,
        );
        const fixType = getFixType(finding!.ruleId);
        const fixValue = generateFixSuggestion(
          finding!.ruleId,
          finding!.target ?? "",
          {
            title: finding!.title,
            description: finding!.description ?? undefined,
          },
        );

        return {
          element_id: elementId,
          fix_type: fixType,
          fix_value: fixValue,
          finding_id: finding!._id,
        };
      })
      .filter((i) => i.element_id && i.fix_type);

    if (issues.length === 0) {
      return { success: true, fixedCount: 0, failedCount: 0, errors: [] };
    }

    const wpUrl = asset.normalizedUrl.replace(/\/$/, "");
    const postId = extractPostId(args.pageUrl, wpUrl);

    if (!postId) {
      return {
        success: false,
        fixedCount: 0,
        failedCount: issues.length,
        errors: ["Could not extract post ID from URL"],
      };
    }

    const apiUrl = `${wpUrl}/wp-json/adascout/v1/fix-page`;
    const credentials = Buffer.from(
      `${asset.wpUsername}:${decrypt(asset.wpAppPassword)}`,
    ).toString("base64");

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: postId,
          issues: issues,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          fixedCount: 0,
          failedCount: issues.length,
          errors: [`API error: ${response.statusText}`],
        };
      }

      const data = await response.json();
      return {
        success: data.success,
        fixedCount: data.fixed_count ?? 0,
        failedCount: issues.length - (data.fixed_count ?? 0),
        errors: data.errors ?? [],
      };
    } catch (error) {
      return {
        success: false,
        fixedCount: 0,
        failedCount: issues.length,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  },
});
