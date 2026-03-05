import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const requireUserId = async (ctx: QueryCtx | MutationCtx): Promise<Id<"users">> => {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthorized");
  }
  return userId;
};

export const normalizeHttpUrl = (raw: string): string => {
  const value = raw.trim();
  if (!value) {
    throw new ConvexError("URL is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConvexError("Invalid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ConvexError("Only http/https URLs are supported.");
  }
  parsed.hash = "";
  const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = pathname || "/";
  return parsed.toString();
};

export const nowMs = () => Date.now();
