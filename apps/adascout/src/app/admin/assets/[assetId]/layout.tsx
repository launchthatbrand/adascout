"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { ArrowLeft, FileText, Globe } from "lucide-react";

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
    <section className="w-full min-w-0 space-y-4 p-4">
      <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 dark:from-indigo-900/50 dark:to-violet-900/50 dark:text-indigo-400">
              {asset?.kind === "url" ? (
                <Globe className="h-6 w-6" />
              ) : (
                <FileText className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
                Asset
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-slate-900 dark:text-slate-100">
                {asset?.title ??
                  asset?.filename ??
                  asset?.sourceUrl ??
                  (assetId ? `${assetId.slice(0, 12)}...` : "unknown")}
              </h1>
              <p className="mt-1 min-w-0 truncate text-sm text-slate-500 dark:text-slate-400">
                {asset?.kind === "url"
                  ? (asset.sourceUrl ?? asset.normalizedUrl)
                  : (asset?.filename ?? "PDF")}
              </p>
            </div>
          </div>
          <Link
            href="/admin/assets"
            className="inline-flex shrink-0 items-center gap-1 text-sm text-indigo-600 underline-offset-4 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-auto">
        <div className="text-muted-foreground inline-flex h-11 w-fit min-w-max items-center justify-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {tabLinks.map((tab) => {
            const isActive = activeTab === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all sm:px-4",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </section>
  );
}
