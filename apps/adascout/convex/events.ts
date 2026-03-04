import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("events"),
      _creationTime: v.number(),
      title: v.string(),
      details: v.optional(v.string()),
      businessId: v.optional(v.id("businesses")),
      address: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      startAt: v.optional(v.string()),
      endAt: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("events").withIndex("by_createdAt").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    details: v.optional(v.string()),
    businessId: v.optional(v.id("businesses")),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    startAt: v.optional(v.string()),
    endAt: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const now = Date.now();
    return await ctx.db.insert("events", {
      ...args,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCoordinates = mutation({
  args: {
    eventId: v.id("events"),
    lat: v.number(),
    lng: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    await ctx.db.patch(args.eventId, {
      lat: args.lat,
      lng: args.lng,
      updatedAt: Date.now(),
    });
    return null;
  },
});
