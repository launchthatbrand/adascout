import { evaluate } from "@mdx-js/mdx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as jsxRuntime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";

import { BlogImage } from "~/components/blog/BlogImage";
import { InlineCta } from "~/components/blog/InlineCta";
import { mdxComponents } from "~/components/blog/mdx-components";
import { getAllBlogPosts, getBlogPostBySlug } from "~/lib/blog";

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

const formatPublishedDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(
  props: BlogPostPageProps,
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getBlogPostBySlug(slug);
  if (!post) {
    return {
      title: "Blog post not found",
    };
  }

  const socialImage = post.ogImage ?? post.heroImage;

  return {
    title: `${post.title} | Template Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      images: socialImage
        ? [
            {
              url: socialImage,
              alt: post.heroAlt ?? post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title: post.title,
      description: post.description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function BlogPostPage(props: BlogPostPageProps) {
  const { slug } = await props.params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const evaluated = await evaluate(post.content, {
    Fragment: jsxRuntime.Fragment,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    development: false,
    remarkPlugins: [remarkGfm],
    format: "mdx",
  });
  const Content = evaluated.default;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/blog"
        className="mb-8 inline-flex text-sm text-muted-foreground hover:underline"
      >
        ← Back to blog
      </Link>

      <article className="mt-4">
        <header className="mb-8 border-b border-border/60 pb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {post.product}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{post.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{formatPublishedDate(post.publishedAt)}</span>
            <span aria-hidden>•</span>
            <span>{post.author}</span>
          </div>
        </header>

        {post.heroImage ? (
          <BlogImage
            src={post.heroImage}
            alt={post.heroAlt ?? post.title}
            className="mb-8"
            priority
            caption={post.heroAlt}
          />
        ) : null}

        <div className="max-w-none pb-2">
          <Content components={mdxComponents} />
        </div>

        <InlineCta label="Browse all posts" href="/blog" />
      </article>
    </main>
  );
}
