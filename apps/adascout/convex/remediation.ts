import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./helpers";
import { findingSourceValidator } from "./scanTypes";

interface PlaybookRow {
  source: "axe" | "ibm" | "pdf" | "stagehand";
  ruleId: string;
  title: string;
  fixSummary: string;
  fixSteps: string[];
  references: string[];
}

const PLAYBOOKS: PlaybookRow[] = [
  {
    source: "axe",
    ruleId: "image-alt",
    title: "Images need alternative text",
    fixSummary: "Every meaningful image needs descriptive alt text.",
    fixSteps: [
      "Add a concise `alt` attribute that describes purpose, not appearance.",
      "Use empty alt (`alt=\"\"`) for purely decorative images.",
      "Avoid duplicate adjacent text and alt content.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/html/H37"],
  },
  {
    source: "axe",
    ruleId: "label",
    title: "Form controls need associated labels",
    fixSummary: "Inputs/selects require visible labels linked with `for` and `id`.",
    fixSteps: [
      "Ensure each form control has an `id`.",
      "Add a `<label for=\"...\">` element for each control.",
      "If visually hidden, keep it available to screen readers.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/html/H44"],
  },
  {
    source: "pdf",
    ruleId: "pdf.text_layer.missing",
    title: "PDF page appears image-only",
    fixSummary: "Run OCR and rebuild tagged text semantics for accessibility tools.",
    fixSteps: [
      "Run OCR in authoring software or a remediation tool.",
      "Verify reading order and heading hierarchy after OCR.",
      "Add alt text to figures and table headers where applicable.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF1"],
  },
];

const playbookValidator = v.object({
  source: findingSourceValidator,
  ruleId: v.string(),
  title: v.string(),
  fixSummary: v.string(),
  fixSteps: v.array(v.string()),
  references: v.array(v.string()),
});

export const listMyRemediationPlaybooks = query({
  args: {},
  returns: v.array(playbookValidator),
  handler: async (ctx) => {
    await requireUserId(ctx);
    return PLAYBOOKS;
  },
});

export const getMyRemediationPlaybook = query({
  args: {
    source: findingSourceValidator,
    ruleId: v.string(),
  },
  returns: v.union(playbookValidator, v.null()),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const exact = PLAYBOOKS.find((row) => row.source === args.source && row.ruleId === args.ruleId);
    if (exact) return exact;
    const sourceFallback = PLAYBOOKS.find((row) => row.source === args.source);
    return sourceFallback ?? null;
  },
});

export const getRemediationPlaybook = query({
  args: {
    source: findingSourceValidator,
    ruleId: v.string(),
  },
  returns: v.object({
    key: v.string(),
    title: v.string(),
    steps: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const selected =
      PLAYBOOKS.find((row) => row.source === args.source && row.ruleId === args.ruleId) ??
      PLAYBOOKS.find((row) => row.source === args.source);
    return {
      key: `${args.source}:${args.ruleId}`,
      title: selected?.title ?? "General remediation workflow",
      steps:
        selected?.fixSteps ?? [
          "Reproduce the issue on the affected page/template.",
          "Apply semantic HTML/ARIA fixes aligned with WCAG 2.2 AA.",
          "Validate with automated checks and manual keyboard + screen reader pass.",
        ],
    };
  },
});
