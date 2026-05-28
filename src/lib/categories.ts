export type ContentType = "Article" | "Video" | "Podcast" | "Worksheet" | "Meeting" | "Guide";

export const CONTENT_TYPES: ContentType[] = [
  "Article",
  "Video",
  "Podcast",
  "Worksheet",
  "Meeting",
  "Guide",
];

export type HomePageMode = "default" | "custom";

export type Category = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon_url: string | null;
  icon_name: string | null;
  icon_color: string | null;
  sort_order: number;
  published: boolean;
  home_page_mode: HomePageMode;
  name_es: string | null;
  tagline_es: string | null;
  description_es: string | null;
  created_at?: string;
  facilities?: string[] | null; // facility values assigned to this category; null = fetch failed
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
  created_at?: string;
  facilities?: string[] | null; // null = restrictions failed to load; hide for non-admins
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
