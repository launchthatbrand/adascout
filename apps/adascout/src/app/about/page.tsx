import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">About ADA Scount</p>
        <h1 className="text-3xl font-semibold tracking-tight">How the MVP works</h1>
        <p className="text-muted-foreground">
          ADA Scount provides automated accessibility detection and remediation guidance for websites and PDF files.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-border/60 bg-background p-5">
        <h2 className="text-lg font-semibold">What is included in MVP</h2>
        <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
          <li>Website URL and PDF asset intake.</li>
          <li>Automated WCAG 2.2 AA scan runs.</li>
          <li>Prioritized findings explorer and downloadable reports.</li>
          <li>Guidance-first remediation workflow with manual review flags.</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-border/60 bg-background p-5">
        <h2 className="text-lg font-semibold">Important note</h2>
        <p className="text-muted-foreground text-sm">
          This product provides automated detection and guidance. It does not independently certify legal compliance.
          Manual QA and assistive technology testing are still required.
        </p>
      </section>

      <div>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Go to ADA Dashboard
        </Link>
      </div>
    </main>
  );
}

