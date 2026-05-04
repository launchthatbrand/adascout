import type { ComponentPropsWithoutRef } from "react";

type MdxTrackedLinkProps = ComponentPropsWithoutRef<"a">;

export const MdxTrackedLink = ({ href, children, ...props }: MdxTrackedLinkProps) => {
  return (
    <a
      href={href}
      className="text-primary underline underline-offset-4 hover:opacity-90"
      {...props}
    >
      {children}
    </a>
  );
};
