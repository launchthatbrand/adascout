import { v } from "convex/values";

import { action } from "../server";

export const bootstrapProviders = action({
  args: {},
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async () => {
    return { ok: true };
  },
});
