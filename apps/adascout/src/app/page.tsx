"use client";

import Link from "next/link";

import { Button } from "@acme/ui/button";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <section className="from-background via-background to-primary/5 relative overflow-hidden bg-gradient-to-b px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="bg-primary/5 absolute -top-40 -right-40 h-80 w-80 rounded-full blur-3xl" />
          <div className="bg-primary/5 absolute -bottom-40 -left-40 h-80 w-80 rounded-full blur-3xl" />
          <div className="from-primary/10 absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] via-transparent to-transparent" />
        </div>

        <div className="mx-auto w-full max-w-5xl text-center">
          <div className="border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            WCAG 2.2 AA Compliant
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Make Your Website{" "}
            <span className="text-primary font-bold">
              Accessible to Everyone
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg sm:text-xl">
            ADA Scout automatically scans your websites and PDF files for
            accessibility issues, helping you achieve WCAG 2.2 AA compliance and
            create inclusive digital experiences.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="min-w-48">
              <Link href="/admin/assets">Start Scanning Free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="min-w-48">
              <Link href="/about">See How It Works</Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-4 text-sm">
            No credit card required • Free plan available • 5-minute setup
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Everything You Need for Accessibility
          </h2>
          <p className="text-muted-foreground mt-4">
            Comprehensive tools to identify, track, and fix accessibility issues
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                />
              </svg>
            }
            title="Website Scanning"
            description="Automated runtime analysis detects WCAG violations including color contrast, missing alt text, heading hierarchy issues, and more."
          />
          <FeatureCard
            icon={
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            }
            title="PDF Analysis"
            description="Scan uploaded PDFs for text-layer detection, structural issues, and accessibility red flags that need manual review."
          />
          <FeatureCard
            icon={
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            }
            title="Actionable Reports"
            description="Export detailed findings with remediation instructions in markdown or JSON format for your engineering team."
          />
        </div>
      </section>

      <section className="border-border/60 bg-primary/[0.03] border-y px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Why Accessibility Matters
            </h2>
            <p className="text-muted-foreground mt-4">
              Web accessibility isn't just about compliance—it's about
              inclusivity
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              value="1 in 4"
              label="Adults has a disability in the US"
              source="CDC"
            />
            <StatCard
              value="$490B"
              label="Annual spending power of people with disabilities"
              source="AAPD"
            />
            <StatCard
              value="71%"
              label="of users leave sites that aren't accessible"
              source="WebAIM"
            />
            <StatCard
              value="97%"
              label="of top 1M websites fail basic accessibility"
              source="WebAIM"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Trusted by Accessibility Teams
          </h2>
          <p className="text-muted-foreground mt-4">
            Join organizations committed to building inclusive web experiences
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-60 grayscale">
          <span className="text-xl font-semibold">Company A</span>
          <span className="text-xl font-semibold">Company B</span>
          <span className="text-xl font-semibold">Company C</span>
          <span className="text-xl font-semibold">Company D</span>
          <span className="text-xl font-semibold">Company E</span>
        </div>

        <div className="border-border/60 bg-card mt-16 rounded-2xl border p-8 text-center sm:p-12">
          <div className="mx-auto max-w-2xl">
            <svg
              className="text-primary/40 mx-auto h-10 w-10"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <blockquote className="mt-6 text-lg leading-relaxed font-medium">
              "ADA Scout has transformed how we approach accessibility. What
              used to take weeks now takes days, and our compliance team loves
              the actionable reports."
            </blockquote>
            <div className="mt-6">
              <p className="font-semibold">Sarah Johnson</p>
              <p className="text-muted-foreground text-sm">
                Head of Accessibility, TechCorp
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-primary-foreground mx-auto w-full max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Make Accessibility a Priority?
          </h2>
          <p className="text-primary-foreground/80 mx-auto mt-4 max-w-2xl text-lg">
            Start scanning your websites and PDFs today. Get detailed reports
            with prioritized remediation steps your team can implement
            immediately.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 min-w-48"
            >
              <Link href="/admin/assets">Get Started Free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 min-w-48"
            >
              <Link href="/about">Talk to Sales</Link>
            </Button>
          </div>
          <p className="text-primary-foreground/60 mt-6 text-sm">
            Free plan includes 5 website scans and 10 PDF scans per month
          </p>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="group border-border/60 bg-card hover:border-primary/30 hover:shadow-primary/5 relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg">
      <div className="from-primary/5 absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">
        <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
          {icon}
        </div>
        <h3 className="mt-4 text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </article>
  );
}

function StatCard({
  value,
  label,
  source,
}: {
  value: string;
  label: string;
  source: string;
}) {
  return (
    <div className="text-center">
      <p className="text-primary text-4xl font-bold tracking-tight">{value}</p>
      <p className="text-muted-foreground mt-2 text-sm">{label}</p>
      <p className="text-muted-foreground/60 mt-1 text-xs">Source: {source}</p>
    </div>
  );
}
