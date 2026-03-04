import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { Children, isValidElement } from "react";

import { BlogImage, BlogMarkdownImage } from "~/components/blog/BlogImage";
import { Callout } from "~/components/blog/Callout";
import { Checklist } from "~/components/blog/Checklist";
import { InlineCta } from "~/components/blog/InlineCta";
import { LeadMagnetCard } from "~/components/blog/LeadMagnetCard";
import { MdxTrackedLink } from "~/components/blog/MdxTrackedLink";

const H2 = (props: ComponentPropsWithoutRef<"h2">) => (
  <h2
    className="mt-10 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
    {...props}
  />
);

const H3 = (props: ComponentPropsWithoutRef<"h3">) => (
  <h3
    className="mt-8 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
    {...props}
  />
);

const H4 = (props: ComponentPropsWithoutRef<"h4">) => (
  <h4 className="mt-6 text-lg font-semibold text-foreground" {...props} />
);

const P = ({ children, ...props }: ComponentPropsWithoutRef<"p">) => {
  const hasBlockMediaChild = Children.toArray(children).some((child) => {
    if (!isValidElement(child)) return false;
    return child.type === BlogMarkdownImage || child.type === BlogImage;
  });

  if (hasBlockMediaChild) {
    return (
      <div className="mt-4 text-base leading-7 text-foreground/90" {...props}>
        {children}
      </div>
    );
  }

  return (
    <p className="mt-4 text-base leading-7 text-foreground/90" {...props}>
      {children}
    </p>
  );
};

const UL = (props: ComponentPropsWithoutRef<"ul">) => (
  <ul
    className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-foreground/90"
    {...props}
  />
);

const OL = (props: ComponentPropsWithoutRef<"ol">) => (
  <ol
    className="mt-4 list-decimal space-y-2 pl-6 text-base leading-7 text-foreground/90"
    {...props}
  />
);

const LI = (props: ComponentPropsWithoutRef<"li">) => <li className="pl-1" {...props} />;

const Strong = (props: ComponentPropsWithoutRef<"strong">) => (
  <strong className="font-semibold text-foreground" {...props} />
);

const Hr = (props: ComponentPropsWithoutRef<"hr">) => (
  <hr className="my-10 border-border/60" {...props} />
);

const Blockquote = (props: ComponentPropsWithoutRef<"blockquote">) => (
  <blockquote
    className="mt-6 border-l-2 border-primary/70 pl-4 italic text-foreground/80"
    {...props}
  />
);

const Code = (props: ComponentPropsWithoutRef<"code">) => (
  <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]" {...props} />
);

const Pre = (props: ComponentPropsWithoutRef<"pre">) => (
  <pre
    className="mt-5 overflow-x-auto rounded-xl border border-border/60 bg-card/70 p-4 text-sm"
    {...props}
  />
);

export const mdxComponents: MDXComponents = {
  h2: H2,
  h3: H3,
  h4: H4,
  p: P,
  ul: UL,
  ol: OL,
  li: LI,
  strong: Strong,
  a: MdxTrackedLink,
  hr: Hr,
  blockquote: Blockquote,
  code: Code,
  pre: Pre,
  img: BlogMarkdownImage,
  BlogImage,
  InlineCta,
  LeadMagnetCard,
  Callout,
  Checklist,
};
