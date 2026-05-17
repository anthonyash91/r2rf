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
  icon_url: string | null;
  sort_order: number;
  published: boolean;
  name_es: string | null;
  tagline_es: string | null;
  description_es: string | null;
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
  file_url: string | null;
  file_name: string | null;
  sort_order: number;
  published: boolean;
  title_es: string | null;
  description_es: string | null;
  source_es: string | null;
  file_url_es: string | null;
  file_name_es: string | null;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
