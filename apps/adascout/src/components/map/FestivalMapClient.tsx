"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Marker, NavigationControl, Popup, Map as RMMap } from "@vis.gl/react-maplibre";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FestivalLocation } from "~/types/festival";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapRef } from "@vis.gl/react-maplibre";
import { PinDetails } from "./PinDetails";
import { UserLocationButton } from "./UserLocationButton";

interface FestivalMapClientProps {
  locations: FestivalLocation[];
  selectedId: string | null;
  onSelectLocation: (id: string | null) => void;
  enable3DBuildings?: boolean;
  immersiveMobile?: boolean;
  onAddEventAt?: (coords: { lat: number; lng: number }) => void;
  onMoveEventPin?: (args: { eventId: string; lat: number; lng: number }) => void;
}

type GeoState = "idle" | "loading" | "ready" | "error";

const defaultCenter = {
  latitude: 30.4383,
  longitude: -84.2807,
  zoom: 16,
};

const categoryToColor: Record<FestivalLocation["category"], string> = {
  parade: "#db2777",
  music: "#2563eb",
  jubilee: "#16a34a",
  parking: "#9333ea",
  info: "#ea580c",
  food: "#d97706",
};

export const FestivalMapClient = ({
  locations,
  selectedId,
  onSelectLocation,
  enable3DBuildings = true,
  immersiveMobile = false,
  onAddEventAt,
  onMoveEventPin,
}: FestivalMapClientProps) => {
  const mapRef = useRef<MapRef | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const hasCenteredOnUserRef = useRef(false);
  const popupExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoPermissionState, setGeoPermissionState] = useState<string>("unknown");
  const [popupLocation, setPopupLocation] = useState<
    (FestivalLocation & { displayLng: number; displayLat: number }) | null
  >(null);
  const [popupPhase, setPopupPhase] = useState<"hidden" | "enter" | "idle" | "exit">(
    "hidden",
  );
  const [contextCoords, setContextCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userCoordinates, setUserCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const displayLocations = useMemo(() => {
    const grouped = new Map<string, FestivalLocation[]>();
    for (const location of locations) {
      const key = `${location.lng.toFixed(3)}:${location.lat.toFixed(3)}`;
      const list = grouped.get(key) ?? [];
      list.push(location);
      grouped.set(key, list);
    }

    const offsets = new Map<
      string,
      {
        lng: number;
        lat: number;
      }
    >();
    for (const list of grouped.values()) {
      if (list.length === 1) {
        const only = list[0];
        if (!only) continue;
        offsets.set(only.id, { lng: only.lng, lat: only.lat });
        continue;
      }
      list.forEach((location, index) => {
        const radius = 0.00045;
        const angle = (Math.PI * 2 * index) / list.length;
        offsets.set(location.id, {
          lng: location.lng + Math.cos(angle) * radius,
          lat: location.lat + Math.sin(angle) * radius,
        });
      });
    }

    return locations.map((location) => {
      const adjusted = offsets.get(location.id);
      return {
        ...location,
        displayLng: adjusted?.lng ?? location.lng,
        displayLat: adjusted?.lat ?? location.lat,
      };
    });
  }, [locations]);
  const festivalBounds = useMemo(() => {
    if (displayLocations.length === 0) {
      return [
        [-84.38, 30.36],
        [-84.18, 30.52],
      ] as [[number, number], [number, number]];
    }

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const location of displayLocations) {
      minLng = Math.min(minLng, location.displayLng);
      maxLng = Math.max(maxLng, location.displayLng);
      minLat = Math.min(minLat, location.displayLat);
      maxLat = Math.max(maxLat, location.displayLat);
    }

    // If we have a user location, include it in the interactive bounds so the
    // "my location" pin is always reachable/visible.
    if (userCoordinates) {
      minLng = Math.min(minLng, userCoordinates.longitude);
      maxLng = Math.max(maxLng, userCoordinates.longitude);
      minLat = Math.min(minLat, userCoordinates.latitude);
      maxLat = Math.max(maxLat, userCoordinates.latitude);
    }

    // Keep viewport centered around festival pins with a little breathing room.
    const lngPadding = 0.018;
    const latPadding = 0.015;
    return [
      [minLng - lngPadding, minLat - latPadding],
      [maxLng + lngPadding, maxLat + latPadding],
    ] as [[number, number], [number, number]];
  }, [displayLocations, userCoordinates]);
  const selectedLocation = useMemo(
    () => displayLocations.find((location) => location.id === selectedId) ?? null,
    [displayLocations, selectedId],
  );

  const requestUserLocation = useCallback((source: "manual" | "auto") => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("error");
      setGeoError("Geolocation is not supported on this device.");
      return;
    }

    setGeoState("loading");
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const map = mapRef.current?.getMap();
        if (map) {
          map.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: Math.max(map.getZoom(), 14.5),
          });
        }
        hasCenteredOnUserRef.current = true;
        setGeoState("ready");
      },
      (error) => {
        setGeoState("error");
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError("Location permission was denied.");
          return;
        }
        setGeoError("Unable to retrieve your location right now.");
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000,
      },
    );
  }, []);

  const apply3DBuildings = useCallback(() => {
    const map = mapRef.current?.getMap() as MapLibreMap | undefined;
    if (!map || !map.isStyleLoaded()) return;

    const extrusionLayerId = "springtime-3d-buildings";
    const sourceId = "openfreemap";

    if (!enable3DBuildings) {
      if (map.getLayer(extrusionLayerId)) map.removeLayer(extrusionLayerId);
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      return;
    }

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      });
    }

    if (!map.getLayer(extrusionLayerId)) {
      const styleLayers = map.getStyle().layers;
      let insertBeforeId: string | undefined;
      for (const layer of styleLayers) {
        if (layer.type === "symbol" && layer.layout?.["text-field"]) {
          insertBeforeId = layer.id;
          break;
        }
      }

      const layerConfig = {
        id: extrusionLayerId,
        source: sourceId,
        "source-layer": "building",
        type: "fill-extrusion" as const,
        minzoom: 14,
        filter: ["!=", ["get", "hide_3d"], true] as unknown[],
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "render_height"],
            0,
            "#d1d5db",
            200,
            "#9ca3af",
            400,
            "#94a3b8",
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            15.5,
            ["get", "render_height"],
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            15.5,
            ["get", "render_min_height"],
          ],
        },
      };

      if (insertBeforeId) {
        map.addLayer(layerConfig, insertBeforeId);
      } else {
        map.addLayer(layerConfig);
      }
    }

    map.easeTo({ pitch: 58, bearing: 16, duration: 700 });
  }, [enable3DBuildings]);

  useEffect(() => {
    apply3DBuildings();
  }, [apply3DBuildings]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        setGeoPermissionState(status.state);
        status.onchange = () => {
          setGeoPermissionState(status.state);
        };
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (
      geoPermissionState === "granted" &&
      !userCoordinates &&
      geoState !== "loading"
    ) {
      requestUserLocation("auto");
    }
  }, [geoPermissionState, userCoordinates, geoState, requestUserLocation]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (geoPermissionState !== "granted") return;
    if (geoWatchIdRef.current !== null) return;

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGeoState("ready");

        if (!hasCenteredOnUserRef.current) {
          const map = mapRef.current?.getMap();
          if (map) {
            map.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: Math.max(map.getZoom(), 14.5),
            });
            hasCenteredOnUserRef.current = true;
          }
        }
      },
      () => undefined,
      {
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 15000,
      },
    );

    return () => {
      if (geoWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
    };
  }, [geoPermissionState]);

  useEffect(() => {
    if (!selectedLocation) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({
      center: [selectedLocation.lng, selectedLocation.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 280,
    });
  }, [selectedLocation]);

  useEffect(() => {
    if (popupExitTimerRef.current) {
      clearTimeout(popupExitTimerRef.current);
      popupExitTimerRef.current = null;
    }

    if (!selectedLocation) {
      if (!popupLocation) {
        setPopupPhase("hidden");
        return;
      }
      setPopupPhase("exit");
      popupExitTimerRef.current = setTimeout(() => {
        setPopupLocation(null);
        setPopupPhase("hidden");
        popupExitTimerRef.current = null;
      }, 180);
      return;
    }

    setPopupLocation(selectedLocation);
    setPopupPhase("enter");
    const rafId = requestAnimationFrame(() => setPopupPhase("idle"));
    return () => cancelAnimationFrame(rafId);
  }, [selectedLocation, popupLocation]);

  useEffect(() => {
    return () => {
      if (popupExitTimerRef.current) clearTimeout(popupExitTimerRef.current);
    };
  }, []);

  const handleLocate = () => {
    requestUserLocation("manual");
  };

  return (
    <div
      className={`relative w-full overflow-hidden bg-card shadow-sm ${
        immersiveMobile
          ? "h-[100dvh] rounded-none border-0"
          : "h-full min-h-0 rounded-none border-0"
      }`}
    >
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        <UserLocationButton onLocate={handleLocate} loading={geoState === "loading"} />
        {geoError && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-md bg-background/90 px-2 py-1 text-xs text-destructive shadow-sm"
          >
            {geoError}
          </p>
        )}
      </div>

      <RMMap
        ref={mapRef}
        mapStyle={{
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        }}
        initialViewState={{
          latitude: userCoordinates?.latitude ?? defaultCenter.latitude,
          longitude: userCoordinates?.longitude ?? defaultCenter.longitude,
          zoom: userCoordinates ? 14.5 : defaultCenter.zoom,
          pitch: enable3DBuildings ? 58 : 0,
          bearing: enable3DBuildings ? 16 : 0,
        }}
        minZoom={12}
        maxZoom={16.8}
        maxBounds={userCoordinates ? undefined : festivalBounds}
        onLoad={() => apply3DBuildings()}
        onClick={(event) => {
          const target = event.originalEvent.target as HTMLElement | null;
          if (target?.closest(".springtime-marker")) return;
          setContextCoords(null);
          onSelectLocation(null);
        }}
        onContextMenu={
          onAddEventAt
            ? (event) => {
                event.preventDefault();
                setContextCoords({
                  lat: event.lngLat.lat,
                  lng: event.lngLat.lng,
                });
              }
            : undefined
        }
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />
        {displayLocations.map((location) => {
          const isSelected = location.id === selectedId;
          const markerColor = categoryToColor[location.category];
          return (
            <Marker
              key={location.id}
              longitude={location.displayLng}
              latitude={location.displayLat}
              anchor="bottom"
              draggable={Boolean(onMoveEventPin)}
              onDragEnd={(event) => {
                if (!onMoveEventPin) return;
                const raw = event as unknown as {
                  target?: { getLngLat?: () => { lat: number; lng: number } };
                  lngLat?: { lat: number; lng: number };
                };
                const lngLat = raw.lngLat ?? raw.target?.getLngLat?.();
                if (!lngLat) return;
                onMoveEventPin({
                  eventId: location.id,
                  lat: lngLat.lat,
                  lng: lngLat.lng,
                });
              }}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectLocation(location.id);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                aria-label={location.title}
                className="springtime-marker group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="relative inline-block h-5 w-5 rounded-full border-2 border-white shadow-lg transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: markerColor,
                    transform: isSelected ? "scale(1.18)" : undefined,
                  }}
                >
                  <span className="absolute inset-[6px] rounded-full bg-white/70" />
                </span>
              </button>
            </Marker>
          );
        })}
        {popupLocation && (
          <Popup
            key={popupLocation.id}
            anchor="top"
            longitude={popupLocation.displayLng}
            latitude={popupLocation.displayLat}
            closeButton={false}
            closeOnMove={false}
            closeOnClick={false}
            onClose={() => onSelectLocation(null)}
            offset={22}
          >
            <div
              className={`origin-bottom transition-all duration-200 ease-out ${
                popupPhase === "enter"
                  ? "translate-y-1 scale-95 opacity-0"
                  : popupPhase === "exit"
                    ? "translate-y-1 scale-95 opacity-0"
                    : "translate-y-0 scale-100 opacity-100"
              }`}
            >
              <PinDetails
                location={popupLocation}
                onClose={() => onSelectLocation(null)}
              />
            </div>
          </Popup>
        )}

        {contextCoords && onAddEventAt && (
          <Popup
            anchor="bottom"
            longitude={contextCoords.lng}
            latitude={contextCoords.lat}
            closeButton={false}
            closeOnClick={false}
            closeOnMove={false}
            onClose={() => setContextCoords(null)}
            offset={16}
          >
            <div className="rounded-xl border border-white/25 bg-black/80 p-2.5 text-white shadow-lg backdrop-blur-md">
              <p className="text-[11px] text-white/80">
                {contextCoords.lat.toFixed(5)}, {contextCoords.lng.toFixed(5)}
              </p>
              <button
                type="button"
                onClick={() => {
                  onAddEventAt(contextCoords);
                  setContextCoords(null);
                }}
                className="mt-2 w-full rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white/90"
              >
                Add Event Here
              </button>
            </div>
          </Popup>
        )}

        {userCoordinates && (
          <Marker
            longitude={userCoordinates.longitude}
            latitude={userCoordinates.latitude}
            anchor="center"
          >
            <div className="relative h-6 w-6 rounded-full bg-sky-600 ring-2 ring-white shadow-xl">
              <div className="absolute inset-[7px] rounded-full bg-white/90" />
              <div className="absolute -inset-2 rounded-full border border-sky-300/70" />
              <div className="absolute -inset-2 animate-ping rounded-full bg-sky-500/25" />
            </div>
          </Marker>
        )}
      </RMMap>
    </div>
  );
};
