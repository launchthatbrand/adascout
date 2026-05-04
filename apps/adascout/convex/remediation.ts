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
  {
    source: "pdf",
    ruleId: "pdf.text_layer.missing_page",
    title: "PDF page appears image-only",
    fixSummary: "Run OCR and rebuild tagged text semantics for accessibility tools.",
    fixSteps: [
      "Run OCR in authoring software or a remediation tool.",
      "Verify reading order and heading hierarchy after OCR.",
      "Add alt text to figures and table headers where applicable.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF1"],
  },
  {
    source: "pdf",
    ruleId: "pdf.meta.title_missing",
    title: "PDF metadata title missing",
    fixSummary: "Set a human-readable document title in PDF metadata.",
    fixSteps: [
      "Open the PDF properties panel in your authoring tool.",
      "Set a descriptive Title value that matches the document purpose.",
      "Re-export and verify the title is announced by assistive technology.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF18"],
  },
  {
    source: "pdf",
    ruleId: "pdf.meta.language_missing",
    title: "PDF metadata language missing",
    fixSummary: "Set a default document language for screen-reader pronunciation.",
    fixSteps: [
      "Set document language (for example en-US) in PDF metadata.",
      "Re-export ensuring the language entry persists in the final PDF.",
      "Verify pronunciation in at least one screen reader.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF16"],
  },
  {
    source: "pdf",
    ruleId: "pdf.tagging.missing",
    title: "PDF structure tags missing",
    fixSummary:
      "Create a properly tagged PDF with semantic heading, list, table, and figure structure.",
    fixSteps: [
      "Enable tagged PDF output in your authoring/export settings.",
      "Confirm heading hierarchy and list/table semantics before export.",
      "Run an accessibility checker and repair tag tree issues.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF1"],
  },
  {
    source: "pdf",
    ruleId: "pdf.scan_quality.low_confidence_ocr",
    title: "Low confidence OCR text quality",
    fixSummary:
      "Improve scan quality and OCR accuracy before publishing the accessible PDF.",
    fixSteps: [
      "Re-scan at higher DPI with deskew/denoise enabled.",
      "Run OCR again and manually correct recognition errors.",
      "Validate reading order and text alternatives after OCR cleanup.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF3"],
  },
  {
    source: "pdf",
    ruleId: "pdf.form.field_label_missing",
    title: "Form fields unlabeled or generic",
    fixSummary:
      "Provide meaningful labels/tooltips for all interactive form fields.",
    fixSteps: [
      "Rename fields from generic names (for example Text1) to meaningful labels.",
      "Set tooltip/alternate text for each field.",
      "Verify keyboard order and screen-reader announcement sequence.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF12"],
  },
  {
    source: "pdf",
    ruleId: "pdf.table.header_missing",
    title: "Possible table header semantics issue",
    fixSummary: "Ensure table headers are tagged and scoped correctly.",
    fixSteps: [
      "Identify each table and tag header cells as TH.",
      "Define header scope (row/column) for complex tables.",
      "Validate table navigation with a screen reader.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF6"],
  },
  {
    source: "pdf",
    ruleId: "pdf.reading_order.suspect",
    title: "Potential reading order issue",
    fixSummary:
      "Adjust reading order to match visual and logical content flow.",
    fixSteps: [
      "Inspect reading order in your PDF accessibility/tagging panel.",
      "Fix multi-column or floating element order conflicts.",
      "Retest sequential reading with keyboard and screen reader.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF3"],
  },
  {
    source: "pdf",
    ruleId: "pdf.image.text_detected_low_contrast",
    title: "Possible low-contrast text detected in PDF image regions",
    fixSummary:
      "Increase text/background contrast in scanned or embedded image content and re-export with accessible alternatives.",
    fixSteps: [
      "Locate affected page regions and check contrast ratio against WCAG 2.2 AA targets.",
      "Adjust scan settings or source artwork to improve contrast before OCR/export.",
      "If contrast cannot be corrected in image content, provide equivalent selectable text or alternate accessible representation.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/general/G18"],
  },
  {
    source: "pdf",
    ruleId: "pdf.image.text_detected_blurry",
    title: "Possible blurry text detected in PDF image regions",
    fixSummary:
      "Improve source scan sharpness so text remains legible for low-vision users and OCR tooling.",
    fixSteps: [
      "Re-scan original documents at higher DPI with deskew and denoise enabled.",
      "Replace low-quality page images with sharper source captures.",
      "Re-run OCR and manually validate corrected text output and reading order.",
    ],
    references: ["https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF3"],
  },
  {
    source: "pdf",
    ruleId: "pdf.image.meaningful_image_needs_alt_review",
    title: "Meaningful image content requires text alternative review",
    fixSummary:
      "Provide equivalent text alternatives for informative visual content in image-heavy PDF pages.",
    fixSteps: [
      "Identify diagrams, signatures, stamps, or embedded figures conveying meaning.",
      "Add figure alt text/captions in tagged PDF structure or adjacent accessible text.",
      "Validate that screen-reader users can access equivalent meaning without relying on the image alone.",
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
