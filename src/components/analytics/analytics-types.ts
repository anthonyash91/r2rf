import type { Category, ContentItem } from "@/lib/categories";

export type RangeKey = "7d" | "30d" | "90d" | "all" | "month";

export const RANGE_OPTIONS: { key: RangeKey; label: string; shortLabel: string }[] = [
  { key: "month", label: "Last month", shortLabel: "month" },
  { key: "7d", label: "Last 7 days", shortLabel: "7 days" },
  { key: "30d", label: "Last 30 days", shortLabel: "30 days" },
  { key: "90d", label: "Last 90 days", shortLabel: "90 days" },
  { key: "all", label: "All time", shortLabel: "All time" },
];

export type FacilityRow = {
  facilityValue: string;
  facilityLabel: string;
  facilitySiteId: string | null;
  activeUsers7d: number;
  activeUsers30d: number;
  totalUsers: number;
  avgCompletionRate: number | null;
  totalSessionSeconds: number;
  itemsCompletedTotal: number;
  updatedAt: string;
  totalBookmarks: number;
  totalThumbsUp: number;
  totalThumbsDown: number;
};

export type AggregatedRow = {
  category: Category;
  views: number;
  clicks: number;
  completionRate: number | null;
  totalSeconds: number;
  depth: number | null;
  items: {
    item: ContentItem;
    clicks: number;
    openCount: number;
    completeCount: number;
    completionRate: number | null;
    avgSessionSeconds: number | null;
    thumbsUp: number;
    thumbsDown: number;
    bookmarkCount: number;
  }[];
};

export type UsageScope =
  | { kind: "overall" }
  | { kind: "facility"; facilityValue: string; facilityLabel: string };
