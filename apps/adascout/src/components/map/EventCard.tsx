"use client";

import type { FestivalLocation } from "~/types/festival";

interface EventCardProps {
  location: FestivalLocation;
  active?: boolean;
  mode?: "standard" | "compact";
  onClose?: () => void;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatRange = (startAt?: string, endAt?: string) => {
  if (!startAt) return "Time TBD";
  const start = new Date(startAt);
  if (!endAt) return timeFormatter.format(start);
  return `${timeFormatter.format(start)} - ${timeFormatter.format(new Date(endAt))}`;
};

export const EventCard = ({
  location,
  active = false,
  mode = "standard",
  onClose,
}: EventCardProps) => {
  const avatarLabel = location.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  const isCompact = mode === "compact";

  return (
    <article
      className={`w-[19.5rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border bg-white/92 p-4 text-foreground shadow-xl backdrop-blur-md ${
        active
          ? "border-primary/60 ring-2 ring-primary/20"
          : "border-black/10 hover:border-black/20"
      }`}
    >
      {onClose && !isCompact && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="rounded-md border border-black/10 bg-black/[0.04] px-2 py-1 text-[11px] font-medium text-foreground hover:bg-black/[0.08]"
            aria-label="Close location details"
          >
            Close
          </button>
        </div>
      )}

      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Event/Activity Name
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/[0.04] text-[11px] font-semibold text-foreground"
          aria-hidden="true"
        >
          {avatarLabel || "EV"}
        </span>
        <h3 className="text-[15px] font-semibold leading-tight text-foreground">
          {location.title}
        </h3>
      </div>

      <p className="mt-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Details
      </p>
      <p
        className={`mt-1.5 text-[12px] leading-relaxed text-foreground ${isCompact ? "line-clamp-3" : ""}`}
      >
        {location.description}
      </p>
      {!isCompact && (
        <>
          <p className="mt-1.5 text-[12px] font-semibold text-foreground">
            {formatRange(location.startAt, location.endAt)}
          </p>

          <p className="mt-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Business Name
          </p>
          <p className="mt-1 text-[12px] text-foreground">{location.businessName}</p>

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Business Email
          </p>
          <p className="mt-1 text-[12px] break-all text-foreground">
            {location.businessEmail}
          </p>

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Business Contact Info
          </p>
          <p className="mt-1 text-[12px] text-foreground">
            {location.businessContactInfo}
          </p>

          {location.tags.length > 0 && (
            <ul className="mt-3.5 flex flex-wrap gap-1.5">
              {location.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-black/[0.06] px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
};
