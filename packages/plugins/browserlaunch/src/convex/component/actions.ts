import { v } from "convex/values";
import { action } from "./server";

export const createArtifactUploadUrl = action({
  args: {},
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx: any) => {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

