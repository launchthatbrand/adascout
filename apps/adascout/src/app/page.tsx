"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { FestivalMap } from "~/components/map/FestivalMap";
import { toFestivalLocations } from "~/lib/festival-locations";
import { api } from "@/convex/_generated/api";

export default function HomePage() {
  const events = useQuery(api.events.list);
  const businesses = useQuery(api.businesses.list);
  const locations = useMemo(() => toFestivalLocations(events, businesses), [events, businesses]);

  return (
    <main className="h-[100dvh] w-full overflow-hidden">
      <FestivalMap locations={locations} />
    </main>
  );
}
