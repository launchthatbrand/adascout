import type { Metadata } from "next";
import Link from "next/link";

import { InlineCta } from "~/components/blog/InlineCta";
import { getAllBlogPosts } from "~/lib/blog";

const formatPublishedDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const metadata: Metadata = {
  title: "Template Blog",
  description: "MDX-driven blog included in the frontend template.",
};

export default async function BlogIndexPage() {
  const posts = await getAllBlogPosts();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-14">
      <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card/80 p-6 sm:p-8">
        <div className="relative space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Template Blog
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Publish product updates and thought leadership with MDX
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            This blog implementation is ready to copy into new marketing apps and
            supports component-rich MDX posts out of the box.
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="rounded-2xl border border-border/60 bg-card/70 p-5"
          >
            <p className="text-xs text-muted-foreground">
              {formatPublishedDate(post.publishedAt)}
            </p>
            <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight">
              <Link href={`/blog/${post.slug}`} className="hover:underline">
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
          </article>
        ))}
      </section>

      <InlineCta label="Read setup guide" href="/blog/getting-started-template-blog" />
    </main>
  );
}
