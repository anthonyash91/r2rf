export type ContentType = "Article" | "Video" | "Podcast" | "Worksheet" | "Meeting" | "Guide";

export const CONTENT_TYPES: ContentType[] = [
  "Article",
  "Video",
  "Podcast",
  "Worksheet",
  "Meeting",
  "Guide",
];

export type Category = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  sort_order: number;
  published: boolean;
};

export type ContentItem = {
  id: string;
  category_id: string;
  title: string;
  type: string;
  source: string;
  duration: string;
  description: string;
  url: string | null;
  sort_order: number;
  published: boolean;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
