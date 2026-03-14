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
  title: "ADA Scout Blog",
  description:
    "Insights, guides, and best practices for web accessibility and ADA compliance.",
};

export default async function BlogIndexPage() {
  const posts = await getAllBlogPosts();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-14">
      <section className="border-primary/25 from-primary/5 via-card to-background relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8">
        <div className="bg-primary/10 absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl" />
        <div className="bg-primary/10 absolute -bottom-20 -left-20 h-40 w-40 rounded-full blur-3xl" />

        <div className="relative space-y-3">
          <div className="border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span className="relative flex h-1.5 w-1.5">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex h-1.5 w-1.5 rounded-full" />
            </span>
            ADA Scout Blog
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Accessibility Insights &{" "}
            <span className="from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-transparent">
              Best Practices
            </span>
          </h1>
          <p className="text-muted-foreground max-w-3xl text-base sm:text-lg">
            Stay up-to-date with the latest in web accessibility, WCAG
            guidelines, and practical tips for building inclusive digital
            experiences.
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="group border-border/60 bg-card/70 hover:border-primary/30 hover:shadow-primary/5 relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg"
          >
            <div className="from-primary/5 absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative">
              <p className="text-muted-foreground text-xs">
                {formatPublishedDate(post.publishedAt)}
              </p>
              <h2 className="group-hover:text-primary mt-2 text-lg leading-snug font-semibold tracking-tight transition-colors">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                {post.description}
              </p>
              <div className="text-primary mt-4 flex items-center gap-2 text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                Read more
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
            </div>
          </article>
        ))}
      </section>

      <InlineCta label="Learn about ADA compliance" href="/about" />
    </main>
  );
}
