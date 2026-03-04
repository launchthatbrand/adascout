"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function AdminDashboardPage() {
  const viewer = useQuery(api.viewer.currentUser);
  const businesses = useQuery(api.businesses.list);
  const events = useQuery(api.events.list);

  return (
    <section className="w-full space-y-4 p-4">
      <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Welcome</p>
        <h2 className="mt-1 text-xl font-semibold">
          {viewer?.name?.trim() || viewer?.email || "Festival admin"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Manage festival businesses and events from this dashboard.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/businesses"
          className="rounded-2xl border border-white/15 bg-white/10 p-5 transition hover:bg-white/15"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Businesses</p>
          <p className="mt-1 text-3xl font-semibold">{businesses?.length ?? "..."}</p>
          <p className="mt-2 text-sm text-slate-300">Create and maintain participating businesses.</p>
        </Link>

        <Link
          href="/admin/events"
          className="rounded-2xl border border-white/15 bg-white/10 p-5 transition hover:bg-white/15"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Events</p>
          <p className="mt-1 text-3xl font-semibold">{events?.length ?? "..."}</p>
          <p className="mt-2 text-sm text-slate-300">Create and maintain map events and activities.</p>
        </Link>
      </div>
    </section>
  );
}
