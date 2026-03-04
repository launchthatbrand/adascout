"use client";

import type { FestivalLocation } from "~/types/festival";

import { EventCard } from "./EventCard";

interface PinDetailsProps {
  location: FestivalLocation;
  onClose?: () => void;
}

export const PinDetails = ({ location, onClose }: PinDetailsProps) => {
  return <EventCard location={location} onClose={onClose} />;
};
