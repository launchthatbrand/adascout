"use client";

import * as React from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { env } from "~/env";

type ProvidersProps = {
  children: React.ReactNode;
};

export const Providers = ({ children }: ProvidersProps) => {
  const convexClient = React.useMemo(() => {
    if (!env.NEXT_PUBLIC_CONVEX_URL) {
      throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
    }
    return new ConvexReactClient(String(env.NEXT_PUBLIC_CONVEX_URL));
  }, []);

  return <ConvexAuthNextjsProvider client={convexClient}>{children}</ConvexAuthNextjsProvider>;
};
