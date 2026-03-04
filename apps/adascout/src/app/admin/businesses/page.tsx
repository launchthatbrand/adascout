"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@acme/ui/button";
import type { ColumnDefinition } from "@acme/ui/entity-list";
import { EntityList } from "@acme/ui/entity-list";
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
import { api } from "@/convex/_generated/api";

type BusinessRow = Record<string, unknown> & {
  id: string;
  name: string;
  email?: string;
  contactInfo?: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  createdAt: number;
  updatedAt: number;
};

export default function AdminBusinessesPage() {
  const businesses = useQuery(api.businesses.list);
  const createBusiness = useMutation(api.businesses.create);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    contactInfo: "",
    description: "",
    address: "",
    lat: "",
    lng: "",
  });

  const rows = useMemo<BusinessRow[]>(
    () =>
      (businesses ?? []).map((business) => ({
        id: String(business._id),
        name: business.name,
        email: business.email,
        contactInfo: business.contactInfo,
        description: business.description,
        address: business.address,
        lat: business.lat,
        lng: business.lng,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
      })),
    [businesses],
  );

  const columns = useMemo<ColumnDefinition<BusinessRow>[]>(
    () => [
      {
        id: "name",
        header: "Business",
        accessorKey: "name",
        cell: (row: BusinessRow) => (
          <div className="space-y-1">
            <div className="font-medium">{row.name}</div>
            <div className="text-muted-foreground text-xs">{row.description || "No description"}</div>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        accessorKey: "email",
        cell: (row: BusinessRow) => (
          <div className="space-y-1">
            <div className="text-sm">{row.email || "—"}</div>
            <div className="text-muted-foreground text-xs">{row.contactInfo || "—"}</div>
          </div>
        ),
      },
      {
        id: "location",
        header: "Location",
        accessorKey: "address",
        cell: (row: BusinessRow) => (
          <div className="space-y-1">
            <div className="text-sm">{row.address || "—"}</div>
            <div className="text-muted-foreground text-xs">
              {typeof row.lat === "number" && typeof row.lng === "number"
                ? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`
                : "No coordinates"}
            </div>
          </div>
        ),
      },
      {
        id: "updatedAt",
        header: "Updated",
        accessorKey: "updatedAt",
        cell: (row: BusinessRow) => (
          <span className="text-muted-foreground text-xs">{new Date(row.updatedAt).toLocaleString()}</span>
        ),
      },
    ],
    [],
  );

  const handleCreateBusiness = async () => {
    if (isSaving) return;
    if (!form.name.trim()) {
      setStatusMessage("Business name is required.");
      return;
    }

    const parsedLat = form.lat.trim() ? Number(form.lat) : undefined;
    const parsedLng = form.lng.trim() ? Number(form.lng) : undefined;

    if ((parsedLat !== undefined && Number.isNaN(parsedLat)) || (parsedLng !== undefined && Number.isNaN(parsedLng))) {
      setStatusMessage("Latitude/Longitude must be valid numbers.");
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage("");
      await createBusiness({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        contactInfo: form.contactInfo.trim() || undefined,
        description: form.description.trim() || undefined,
        address: form.address.trim() || undefined,
        lat: parsedLat,
        lng: parsedLng,
      });
      setForm({
        name: "",
        email: "",
        contactInfo: "",
        description: "",
        address: "",
        lat: "",
        lng: "",
      });
      setDialogOpen(false);
      setStatusMessage("Business created.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create business.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="min-h-0 flex-1 p-4">
      <EntityList<BusinessRow>
        data={rows}
        columns={columns}
        title="Businesses"
        description="Manage participating businesses for Springtime Tallahassee."
        defaultViewMode="list"
        viewModes={[]}
        enableSearch
        isLoading={businesses === undefined}
        getRowId={(row) => row.id}
        actions={<Button onClick={() => setDialogOpen(true)}>Add New Business</Button>}
        emptyState={
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            No businesses yet. Create your first business.
          </div>
        }
      />

      {statusMessage ? (
        <p className="text-muted-foreground mt-3 text-xs" role="alert" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Business</DialogTitle>
            <DialogDescription>Businesses can be linked to one or more festival events.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="business-name">Name</Label>
              <Input
                id="business-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Business name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-email">Email</Label>
              <Input
                id="business-email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="contact@business.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-contact">Contact Info</Label>
              <Input
                id="business-contact"
                value={form.contactInfo}
                onChange={(event) => setForm((prev) => ({ ...prev, contactInfo: event.target.value }))}
                placeholder="Phone, social, or booking contact"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-description">Description</Label>
              <Input
                id="business-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Short description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-address">Address</Label>
              <Input
                id="business-address"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="business-lat">Latitude</Label>
                <Input
                  id="business-lat"
                  value={form.lat}
                  onChange={(event) => setForm((prev) => ({ ...prev, lat: event.target.value }))}
                  placeholder="30.4383"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-lng">Longitude</Label>
                <Input
                  id="business-lng"
                  value={form.lng}
                  onChange={(event) => setForm((prev) => ({ ...prev, lng: event.target.value }))}
                  placeholder="-84.2807"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateBusiness()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Create Business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
