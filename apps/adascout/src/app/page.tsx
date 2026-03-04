"use client";

import Link from "next/link";
import { Button } from "@acme/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-14 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">ADA Scount</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Accessibility scanning and remediation guidance for websites and PDFs.
        </h1>
        <p className="text-muted-foreground max-w-3xl text-base">
          Add website URLs and PDF files, run WCAG 2.2 AA checks, and generate prioritized remediation reports for
          engineering and content teams.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/admin/assets">Start Scanning</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/about">How It Works</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          title="Website Scanning"
          description="Runtime page analysis with automated WCAG issue detection for common accessibility violations."
        />
        <FeatureCard
          title="PDF Analysis"
          description="Scan uploaded PDFs for text-layer and structural red flags. Surface manual-review priorities."
        />
        <FeatureCard
          title="Actionable Reports"
          description="Export technical findings and remediation instructions in markdown or JSON formats."
        />
      </section>
    </main>
  );
}

const FeatureCard = ({ title, description }: { title: string; description: string }) => (
  <article className="rounded-xl border border-border/60 bg-background p-4">
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="text-muted-foreground mt-2 text-sm">{description}</p>
  </article>
);
