"use client";

import { useMemo, useState } from "react";

import type { ColumnDefinition } from "@acme/ui/entity-list";
import { EntityList } from "@acme/ui/entity-list";
import { EventCard } from "./EventCard";
import type { FestivalLocation } from "~/types/festival";
import { FestivalMapClient } from "./FestivalMapClient";

interface FestivalMapProps {
  locations: FestivalLocation[];
  onAddEventAt?: (coords: { lat: number; lng: number }) => void;
  onMoveEventPin?: (args: { eventId: string; lat: number; lng: number }) => void;
}

type FestivalSidebarRow = Record<string, unknown> & {
  id: string;
  title: string;
  description: string;
  address: string;
  businessName: string;
  location: FestivalLocation;
};

export const FestivalMap = ({ locations, onAddEventAt, onMoveEventPin }: FestivalMapProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [is3DEnabled, setIs3DEnabled] = useState(true);

  const selectedLocation = useMemo(
    () => {
      if (!selectedId) return null;
      return locations.find((location) => location.id === selectedId) ?? null;
    },
    [locations, selectedId],
  );

  const selectedLocationId = selectedLocation?.id ?? null;
  const sidebarRows = useMemo<FestivalSidebarRow[]>(
    () =>
      locations.map((location) => ({
        id: location.id,
        title: location.title,
        description: location.description,
        address: location.address,
        businessName: location.businessName,
        location,
      })),
    [locations],
  );
  const sidebarColumns = useMemo<ColumnDefinition<FestivalSidebarRow>[]>(
    () => [
      { id: "title", header: "Title", accessorKey: "title" },
      { id: "description", header: "Description", accessorKey: "description" },
      { id: "address", header: "Address", accessorKey: "address" },
      { id: "businessName", header: "Business", accessorKey: "businessName" },
    ],
    [],
  );

  return (
    <section id="festival-map" className="h-full w-full" aria-labelledby="map-title">
      <div className="grid h-full w-full grid-cols-1 gap-0 lg:grid-cols-[1fr_24rem]">
        <div className="relative">
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 rounded-2xl mr-10 border border-white/25 bg-black/45 p-3 shadow-xl backdrop-blur-xl">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2">
              <h2
                id="map-title"
                className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/95 md:text-sm"
              >
                Festival map
              </h2>
              <button
                type="button"
                onClick={() => setIs3DEnabled((prev) => !prev)}
                aria-pressed={is3DEnabled}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  is3DEnabled
                    ? "border-primary/70 bg-primary/90 text-primary-foreground"
                    : "border-white/35 bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {is3DEnabled ? "3D" : "2D"}
              </button>
            </div>
          </div>

          <div className="md:hidden">
            <FestivalMapClient
              locations={locations}
              selectedId={selectedLocationId}
              onSelectLocation={(id) => setSelectedId(id)}
              enable3DBuildings={is3DEnabled}
              immersiveMobile
              onAddEventAt={onAddEventAt}
              onMoveEventPin={onMoveEventPin}
            />
          </div>
          <div className="hidden md:block h-full">
            <FestivalMapClient
              locations={locations}
              selectedId={selectedLocationId}
              onSelectLocation={(id) => setSelectedId(id)}
              enable3DBuildings={is3DEnabled}
              onAddEventAt={onAddEventAt}
              onMoveEventPin={onMoveEventPin}
            />
          </div>
        </div>

        <aside className="hidden h-full min-h-0 overflow-y-auto border-l border-black/10 bg-white/80 p-3 shadow-xl backdrop-blur-xl lg:block">
          <EntityList<FestivalSidebarRow>
            data={sidebarRows}
            columns={sidebarColumns}
            title="Stops and hotspots"
            defaultViewMode="grid"
            viewModes={["grid"]}
            gridColumns={{ sm: 1, md: 1, lg: 1, xl: 1 }}
            enableSearch
            customRender={(filteredRows) => (
              <ul className="space-y-3">
                {filteredRows.map((row) => {
                  const location = row.location;
                  const isActive = selectedLocationId === location.id;
                  return (
                    <li key={location.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(location.id)}
                        aria-pressed={isActive}
                        className="w-full text-left"
                      >
                        <EventCard location={location} active={isActive} mode="compact" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            emptyState={
              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No locations in this category yet.
              </div>
            }
          />
        </aside>
      </div>
    </section>
  );
};
