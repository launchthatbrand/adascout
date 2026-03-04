import Link from "next/link";

interface InlineCtaProps {
  label: string;
  href: string;
}

export const InlineCta = ({ label, href }: InlineCtaProps) => {
  return (
    <div className="my-8 rounded-xl border border-border/60 bg-card/70 p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Ready to publish your next update?
        </p>
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          {label}
        </Link>
      </div>
    </div>
  );
};
