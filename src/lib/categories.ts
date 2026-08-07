export type ContentType = "Article" | "Video" | "Podcast" | "Worksheet" | "Guide";

export type ContentChapter = {
  id: string;
  content_item_id: string;
  title: string;
  title_es: string | null;
  sort_order: number;
  file_url: string | null;
  file_name: string | null;
  file_url_es: string | null;
  file_name_es: string | null;
  duration_seconds: number | null;
  section: string | null;
  section_es: string | null;
};


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
  exempt_from_progress?: boolean;
  title_es: string | null;
  description_es: string | null;
  source_es: string | null;
  file_url_es: string | null;
  file_name_es: string | null;
  created_at?: string;
  facilities?: string[] | null; // null = restrictions failed to load; hide for non-admins
  /** Bunny storage folder for this item's uploads (uploads/{category-slug}/{storage_folder}/...).
   * Null for items created before this feature — their files stay in the flat legacy structure. */
  storage_folder?: string | null;
  /** Bunny Stream collection grouping this item's video/audio uploads. Null
   * for items with no Stream video yet, or whose media stays on Bunny Storage. */
  stream_collection_id?: string | null;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
