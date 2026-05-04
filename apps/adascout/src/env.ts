import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod/v4";

export const env = createEnv({
  extends: [vercel()],
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  server: {},
  client: {
    NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(1).optional().default("localhost"),
    NEXT_PUBLIC_AUTH_DEBUG_OVERLAY: z.string().optional(),
    NEXT_PUBLIC_CONVEX_URL: z.url().optional(),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_AUTH_DEBUG_OVERLAY: process.env.NEXT_PUBLIC_AUTH_DEBUG_OVERLAY,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});

