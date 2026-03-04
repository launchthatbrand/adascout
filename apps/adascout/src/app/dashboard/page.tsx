export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Sidebar Demo Route
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Dashboard shell for template testing
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Use this route to verify sidebar behavior in the template. Marketing
          routes can keep sidebar hidden while app routes opt in.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/60 p-4">
            <div className="h-2 w-16 rounded bg-muted" />
            <div className="mt-4 h-5 rounded bg-muted/70" />
            <div className="mt-2 h-5 w-3/4 rounded bg-muted/70" />
          </div>
        ))}
      </section>
    </main>
  );
}
