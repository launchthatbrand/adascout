import type { Id } from "@/convex/_generated/dataModel";
import type { FestivalLocation } from "~/types/festival";

type EventDoc = {
  _id: Id<"events">;
  title: string;
  details?: string;
  businessId?: Id<"businesses">;
  address?: string;
  lat?: number;
  lng?: number;
  startAt?: string;
  endAt?: string;
};

type BusinessDoc = {
  _id: Id<"businesses">;
  name: string;
  email?: string;
  contactInfo?: string;
  address?: string;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const toFestivalLocations = (
  events: EventDoc[] | undefined,
  businesses: BusinessDoc[] | undefined,
): FestivalLocation[] => {
  if (!events) return [];

  const businessById = new Map<string, BusinessDoc>();
  for (const business of businesses ?? []) {
    businessById.set(String(business._id), business);
  }

  return events
    .filter((eventItem) => typeof eventItem.lat === "number" && typeof eventItem.lng === "number")
    .map((eventItem) => {
      const business = eventItem.businessId ? businessById.get(String(eventItem.businessId)) : undefined;
      return {
        id: String(eventItem._id),
        title: eventItem.title,
        slug: slugify(eventItem.title || String(eventItem._id)),
        category: "info",
        lat: eventItem.lat ?? 30.4383,
        lng: eventItem.lng ?? -84.2807,
        address: eventItem.address ?? business?.address ?? "Address not provided",
        description: eventItem.details ?? "No details provided yet.",
        startAt: eventItem.startAt,
        endAt: eventItem.endAt,
        tags: [],
        businessName: business?.name ?? "Unassigned business",
        businessEmail: business?.email ?? "N/A",
        businessContactInfo: business?.contactInfo ?? "No contact info",
      };
    });
};
