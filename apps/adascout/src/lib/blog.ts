import "server-only";

import matter from "gray-matter";
import { promises as fs } from "node:fs";
import path from "node:path";

export type BlogPostStatus = "draft" | "published";

export interface BlogPostMeta {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  author: string;
  tags: string[];
  product: string;
  status: BlogPostStatus;
  heroImage?: string;
  heroAlt?: string;
  ogImage?: string;
}

export interface BlogPost extends BlogPostMeta {
  content: string;
}

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const BLOG_CONTENT_DIR = path.join(process.cwd(), "src/content/blog");

const readMdxFiles = async () => {
  const entries = await fs.readdir(BLOG_CONTENT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => path.join(BLOG_CONTENT_DIR, entry.name));
};

const parsePost = async (filePath: string): Promise<BlogPost> => {
  const raw = await fs.readFile(filePath, "utf8");
  const { data, content } = matter(raw);
  const typedData = data as Record<string, unknown>;

  return {
    title: readString(typedData.title),
    description: readString(typedData.description),
    slug: readString(typedData.slug),
    publishedAt: readString(typedData.publishedAt),
    author: readString(typedData.author, "Template Team"),
    tags: readStringArray(typedData.tags),
    product: readString(typedData.product, "template"),
    status: (typedData.status === "draft" ? "draft" : "published") as BlogPostStatus,
    heroImage: typeof typedData.heroImage === "string" ? typedData.heroImage : undefined,
    heroAlt: typeof typedData.heroAlt === "string" ? typedData.heroAlt : undefined,
    ogImage: typeof typedData.ogImage === "string" ? typedData.ogImage : undefined,
    content,
  };
};

export const getAllBlogPosts = async (opts?: { includeDrafts?: boolean }) => {
  const files = await readMdxFiles();
  const posts = await Promise.all(files.map(parsePost));
  const includeDrafts = opts?.includeDrafts === true;

  return posts
    .filter((post) => (includeDrafts ? true : post.status === "published"))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

export const getBlogPostBySlug = async (slug: string) => {
  const posts = await getAllBlogPosts();
  return posts.find((post) => post.slug === slug);
};
