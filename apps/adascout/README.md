# Next.js Frontend Template

`apps/nextjs` is the reusable frontend template baseline for new marketing apps.

## Includes

- `StandardLayout` root shell with `@header`, `@footer`, and `@sidebar` parallel route slots
- Frontend-only app structure (no auth, tRPC, or database coupling)
- MDX blog foundation:
  - `src/content/blog/*.mdx`
  - `src/lib/blog.ts`
  - `src/app/blog/page.tsx`
  - `src/app/blog/[slug]/page.tsx`
  - `src/components/blog/*`

## How to use for new apps

1. Copy this app into `apps/<new-app-name>`.
2. Update `package.json` name, `src/app/layout.tsx` metadata, and slot components.
3. Replace `src/content/blog` posts with app-specific content.
4. Adjust top-level marketing routes (`src/app/page.tsx` and additional pages).

## First customizations

- Brand copy, colors, and links in:
  - `src/app/@header/default.tsx`
  - `src/app/@footer/default.tsx`
  - `src/app/page.tsx`
- Blog metadata/frontmatter defaults in `src/lib/blog.ts`
