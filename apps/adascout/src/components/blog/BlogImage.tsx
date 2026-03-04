import Image from "next/image";
import type * as React from "react";

interface BlogImageProps {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}

const DEFAULT_IMAGE_WIDTH = 1600;
const DEFAULT_IMAGE_HEIGHT = 900;

export const BlogImage = ({
  src,
  alt,
  caption,
  width = DEFAULT_IMAGE_WIDTH,
  height = DEFAULT_IMAGE_HEIGHT,
  priority = false,
  className,
}: BlogImageProps) => {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes="(min-width: 1024px) 768px, 100vw"
          className="h-auto w-full"
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
};

export type BlogMarkdownImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export const BlogMarkdownImage = ({ src, alt, title }: BlogMarkdownImageProps) => {
  if (!src) {
    return null;
  }

  return (
    <BlogImage
      src={src}
      alt={alt ?? "Blog image"}
      caption={title ?? undefined}
      className="my-8"
      width={DEFAULT_IMAGE_WIDTH}
      height={DEFAULT_IMAGE_HEIGHT}
    />
  );
};
