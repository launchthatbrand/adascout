"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import { FestivalMap } from "~/components/map/FestivalMap";
import { toFestivalLocations } from "~/lib/festival-locations";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminEventsPage() {
  const events = useQuery(api.events.list);
  const businesses = useQuery(api.businesses.list);
  const createEvent = useMutation(api.events.create);
  const createBusiness = useMutation(api.businesses.create);
  const updateEventCoordinates = useMutation(api.events.updateCoordinates);

  const [statusMessage, setStatusMessage] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [businessDialogOpen, setBusinessDialogOpen] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);

  const [eventForm, setEventForm] = useState({
    title: "",
    details: "",
    businessId: "",
    address: "",
    lat: "",
    lng: "",
    startAt: "",
    endAt: "",
  });

  const [businessForm, setBusinessForm] = useState({
    name: "",
    email: "",
    contactInfo: "",
    description: "",
    address: "",
    lat: "",
    lng: "",
  });

  const locations = useMemo(() => toFestivalLocations(events, businesses), [events, businesses]);

  const openEventDialogAt = (coords: { lat: number; lng: number }) => {
    setEventForm((prev) => ({
      ...prev,
      lat: coords.lat.toFixed(6),
      lng: coords.lng.toFixed(6),
    }));
    setEventDialogOpen(true);
    setStatusMessage(`Selected map location: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
  };

  const handleMoveEventPin = async (args: { eventId: string; lat: number; lng: number }) => {
    try {
      await updateEventCoordinates({
        eventId: args.eventId as Id<"events">,
        lat: args.lat,
        lng: args.lng,
      });
      setStatusMessage(`Moved event pin to ${args.lat.toFixed(5)}, ${args.lng.toFixed(5)}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to move event pin.");
    }
  };

  const handleSaveEvent = async () => {
    if (isSavingEvent) return;
    if (!eventForm.title.trim()) {
      setStatusMessage("Event title is required.");
      return;
    }
    const lat = eventForm.lat.trim() ? Number(eventForm.lat) : undefined;
    const lng = eventForm.lng.trim() ? Number(eventForm.lng) : undefined;
    if ((lat !== undefined && Number.isNaN(lat)) || (lng !== undefined && Number.isNaN(lng))) {
      setStatusMessage("Latitude/Longitude must be valid numbers.");
      return;
    }

    try {
      setIsSavingEvent(true);
      await createEvent({
        title: eventForm.title.trim(),
        details: eventForm.details.trim() || undefined,
        businessId: eventForm.businessId.trim() ? (eventForm.businessId as Id<"businesses">) : undefined,
        address: eventForm.address.trim() || undefined,
        lat,
        lng,
        startAt: eventForm.startAt.trim() || undefined,
        endAt: eventForm.endAt.trim() || undefined,
      });
      setEventDialogOpen(false);
      setEventForm({
        title: "",
        details: "",
        businessId: "",
        address: "",
        lat: "",
        lng: "",
        startAt: "",
        endAt: "",
      });
      setStatusMessage("Event created.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create event.");
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleSaveBusiness = async () => {
    if (isSavingBusiness) return;
    if (!businessForm.name.trim()) {
      setStatusMessage("Business name is required.");
      return;
    }
    const lat = businessForm.lat.trim() ? Number(businessForm.lat) : undefined;
    const lng = businessForm.lng.trim() ? Number(businessForm.lng) : undefined;
    if ((lat !== undefined && Number.isNaN(lat)) || (lng !== undefined && Number.isNaN(lng))) {
      setStatusMessage("Business Latitude/Longitude must be valid numbers.");
      return;
    }

    try {
      setIsSavingBusiness(true);
      const createdBusinessId = await createBusiness({
        name: businessForm.name.trim(),
        email: businessForm.email.trim() || undefined,
        contactInfo: businessForm.contactInfo.trim() || undefined,
        description: businessForm.description.trim() || undefined,
        address: businessForm.address.trim() || undefined,
        lat,
        lng,
      });

      setBusinessDialogOpen(false);
      setBusinessForm({
        name: "",
        email: "",
        contactInfo: "",
        description: "",
        address: "",
        lat: "",
        lng: "",
      });

      // Return to the event dialog with the new business selected.
      setEventDialogOpen(true);
      setEventForm((prev) => ({ ...prev, businessId: String(createdBusinessId) }));
      setStatusMessage("Business created and selected for this event.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create business.");
    } finally {
      setIsSavingBusiness(false);
    }
  };

  return (
    <section className="relative h-full w-full overflow-hidden">
      <FestivalMap
        locations={locations}
        onAddEventAt={openEventDialogAt}
        onMoveEventPin={(args) => void handleMoveEventPin(args)}
      />

      {statusMessage ? (
        <p
          className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-md bg-black/65 px-3 py-1.5 text-xs text-white shadow"
          role="alert"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}

      <Dialog
        open={eventDialogOpen}
        onOpenChange={(open) => {
          setEventDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              Create an event at the selected map location. Right-click the map to pick coordinates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={eventForm.title}
                onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Event title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-details">Details</Label>
              <Input
                id="event-details"
                value={eventForm.details}
                onChange={(event) => setEventForm((prev) => ({ ...prev, details: event.target.value }))}
                placeholder="Short event details"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-business">Business</Label>
              <div className="flex gap-2">
                <select
                  id="event-business"
                  value={eventForm.businessId}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, businessId: event.target.value }))}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="">No linked business</option>
                  {(businesses ?? []).map((business) => (
                    <option key={business._id} value={String(business._id)}>
                      {business.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setBusinessDialogOpen(true);
                  }}
                >
                  Add Business
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-address">Address</Label>
              <Input
                id="event-address"
                value={eventForm.address}
                onChange={(event) => setEventForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="event-lat">Latitude</Label>
                <Input
                  id="event-lat"
                  value={eventForm.lat}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, lat: event.target.value }))}
                  placeholder="30.4383"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-lng">Longitude</Label>
                <Input
                  id="event-lng"
                  value={eventForm.lng}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, lng: event.target.value }))}
                  placeholder="-84.2807"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="event-start">Start (ISO)</Label>
                <Input
                  id="event-start"
                  value={eventForm.startAt}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, startAt: event.target.value }))}
                  placeholder="2026-04-25T09:00:00-04:00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">End (ISO)</Label>
                <Input
                  id="event-end"
                  value={eventForm.endAt}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, endAt: event.target.value }))}
                  placeholder="2026-04-25T11:00:00-04:00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEvent()} disabled={isSavingEvent}>
              {isSavingEvent ? "Saving..." : "Save Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={businessDialogOpen} onOpenChange={setBusinessDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Business</DialogTitle>
            <DialogDescription>Create a business and immediately attach it to the in-progress event.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="business-name">Name</Label>
              <Input
                id="business-name"
                value={businessForm.name}
                onChange={(event) => setBusinessForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Business name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-email">Email</Label>
              <Input
                id="business-email"
                value={businessForm.email}
                onChange={(event) => setBusinessForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="contact@business.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-contact">Contact info</Label>
              <Input
                id="business-contact"
                value={businessForm.contactInfo}
                onChange={(event) => setBusinessForm((prev) => ({ ...prev, contactInfo: event.target.value }))}
                placeholder="Phone, social, or booking contact"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-description">Description</Label>
              <Input
                id="business-description"
                value={businessForm.description}
                onChange={(event) => setBusinessForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Short description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-address">Address</Label>
              <Input
                id="business-address"
                value={businessForm.address}
                onChange={(event) => setBusinessForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="business-lat">Latitude</Label>
                <Input
                  id="business-lat"
                  value={businessForm.lat}
                  onChange={(event) => setBusinessForm((prev) => ({ ...prev, lat: event.target.value }))}
                  placeholder="30.4383"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-lng">Longitude</Label>
                <Input
                  id="business-lng"
                  value={businessForm.lng}
                  onChange={(event) => setBusinessForm((prev) => ({ ...prev, lng: event.target.value }))}
                  placeholder="-84.2807"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBusinessDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveBusiness()} disabled={isSavingBusiness}>
              {isSavingBusiness ? "Saving..." : "Save Business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
