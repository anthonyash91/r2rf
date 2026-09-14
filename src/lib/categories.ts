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
  /** Admin-managed display order for this category's content-item sections
   * (lowercased/trimmed section values). Any section in use but not listed
   * here is appended alphabetically at render time. */
  section_order?: string[] | null;
  /** Bunny Stream collection shared by every video/audio upload within this
   * category. Null until the first video/audio upload creates one. */
  stream_collection_id?: string | null;
  /** Not a live-inherited flag — turning this on bulk-sets every current item
   * in the category to exempt (one-time) and becomes the default for new
   * items created in the category going forward. Turning it off does not
   * auto-revert existing items. */
  exempt_from_progress?: boolean;
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
  /** Independent per-item section label (e.g. "eBooks", "Audiobooks") for
   * grouping items on the category page — unrelated to `type`. Null falls
   * into an "uncategorized" bucket. */
  section?: string | null;
  section_es?: string | null;
};

/** The pseudo-section key for items with no `section` set — rendered as
 * "Other Content" on the public category page. */
export const OTHER_CONTENT_SECTION_KEY = "uncategorized";

/**
 * Groups items by their `section` field (case-insensitively, trimmed) in
 * display order: sections listed in `sectionOrder` first (in that order,
 * including the OTHER_CONTENT_SECTION_KEY pseudo-section wherever it's been
 * explicitly placed), then any used-but-unlisted section appended
 * alphabetically, then Other Content defaulting to last only when it wasn't
 * explicitly positioned in `sectionOrder`.
 *
 * Shared by the public category page and the admin content list so both
 * stay in sync — the admin list should show items in the same section
 * grouping/order a resident actually sees.
 */
export function groupItemsBySection<T extends { section?: string | null }>(
  items: T[],
  sectionOrder: string[] | null | undefined,
): { key: string; items: T[] }[] {
  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const key = (item.section ?? "").trim().toLowerCase() || OTHER_CONTENT_SECTION_KEY;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }
  const orderedKeys = (sectionOrder ?? []).map((s) => s.trim().toLowerCase());
  const seenKeys = new Set<string>();
  const groups: { key: string; items: T[] }[] = [];
  for (const k of orderedKeys) {
    const bucket = byKey.get(k);
    if (bucket && !seenKeys.has(k)) {
      groups.push({ key: k, items: bucket });
      seenKeys.add(k);
    }
  }
  for (const k of Array.from(byKey.keys())
    .filter((k) => k !== OTHER_CONTENT_SECTION_KEY && !seenKeys.has(k))
    .sort((a, b) => a.localeCompare(b))) {
    groups.push({ key: k, items: byKey.get(k)! });
  }
  if (byKey.has(OTHER_CONTENT_SECTION_KEY) && !seenKeys.has(OTHER_CONTENT_SECTION_KEY)) {
    groups.push({ key: OTHER_CONTENT_SECTION_KEY, items: byKey.get(OTHER_CONTENT_SECTION_KEY)! });
  }
  return groups;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
