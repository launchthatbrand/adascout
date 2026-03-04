interface ChecklistProps {
  title?: string;
  items: string[];
}

export const Checklist = ({ title = "Action checklist", items }: ChecklistProps) => {
  return (
    <section className="my-8 rounded-xl border border-border/60 bg-muted/20 p-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground">
        {title}
      </h4>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex items-start gap-2 text-sm text-foreground/90">
            <span aria-hidden className="mt-0.5 text-emerald-500">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
