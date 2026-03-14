"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import { cn } from "@acme/ui";

const tabs = [
  { href: "/admin/assets/[assetId]", label: "Overview" },
  { href: "/admin/assets/[assetId]/scans", label: "Scans" },
  { href: "/admin/assets/[assetId]/pages", label: "Pages" },
  { href: "/admin/assets/[assetId]/findings", label: "Findings" },
];

export default function AssetDetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const assetIdParam = params.assetId;
  const assetId =
    typeof assetIdParam === "string"
      ? (assetIdParam as Id<"assets">)
      : undefined;

  const asset = useQuery(api.assets.getMyAsset, assetId ? { assetId } : "skip");

  // Build tab hrefs with actual assetId
  const tabLinks = useMemo(() => {
    if (!assetId) return tabs;
    return tabs.map((tab) => ({
      ...tab,
      href: tab.href.replace("[assetId]", assetId),
    }));
  }, [assetId]);

  // Determine active tab based on pathname
  const activeTab = useMemo(() => {
    if (!assetId) return tabLinks[0]?.href;
    const basePath = `/admin/assets/${assetId}`;
    if (pathname === basePath) return basePath;
    if (pathname.startsWith(`${basePath}/scans`)) return `${basePath}/scans`;
    if (pathname.startsWith(`${basePath}/pages`)) return `${basePath}/pages`;
    if (pathname.startsWith(`${basePath}/findings`))
      return `${basePath}/findings`;
    return basePath;
  }, [pathname, assetId, tabLinks]);

  return (
    <section className="w-full space-y-4 p-4">
      <div className="border-border/60 bg-background rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              Asset
            </p>
            <h1 className="text-xl font-semibold">
              {asset?.title ??
                asset?.filename ??
                asset?.sourceUrl ??
                (assetId ? `${assetId.slice(0, 12)}...` : "unknown")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm break-all">
              {asset?.kind === "url"
                ? (asset.sourceUrl ?? asset.normalizedUrl)
                : (asset?.filename ?? "PDF")}
            </p>
          </div>
          <Link
            href="/admin/assets"
            className="text-sm underline underline-offset-4"
          >
            Back to Assets
          </Link>
        </div>
      </div>

      <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]">
        {tabLinks.map((tab) => {
          const isActive = activeTab === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "text-foreground dark:text-muted-foreground focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm",
                isActive &&
                  "bg-background dark:text-foreground dark:border-input dark:bg-input/30 shadow-sm",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </section>
  );
}
