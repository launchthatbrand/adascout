import Link from "next/link";

interface LeadMagnetCardProps {
  title: string;
  description: string;
  points?: string[];
  ctaLabel: string;
  ctaHref: string;
}

export const LeadMagnetCard = ({
  title,
  description,
  points = [],
  ctaLabel,
  ctaHref,
}: LeadMagnetCardProps) => {
  return (
    <section className="my-10 rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Download</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      {points.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5">
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
};
