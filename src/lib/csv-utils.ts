import { fmtDate } from "@/lib/date-format";

// RFC 4180: wrap in quotes if the value contains a quote, comma, or newline;
// double any existing quotes inside the value.
export function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, lines: string[]): void {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  // Temporarily append an <a> to the DOM to trigger the browser's native
  // file-download dialog. The element is removed immediately after the click.
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFacilityUsersCsv(
  users: { user_id: string; username: string; first_name: string; last_name: string; created_at: string; facility?: string; last_login_date?: string | null }[],
  facilityLabel: string,
  includeFacility = false,
) {
  const lines: string[] = [];
  const headers = includeFacility
    ? ["First name", "Last name", "Username", "Facility", "Joined", "Last login", "Engagement tier", "Facility percentile"]
    : ["First name", "Last name", "Username", "Joined", "Last login", "Engagement tier", "Facility percentile"];
  lines.push(headers.map(csvEscape).join(","));
  for (const u of users) {
    const lastLogin = u.last_login_date || "";
    const tier = (u as any).engagement_tier ?? "";
    const pct = (u as any).facility_percentile != null ? `${(u as any).facility_percentile}%` : "";
    const facilityName = (u as any).facility_label || u.facility || "";
    const row = includeFacility
      ? [u.first_name, u.last_name, u.username, facilityName, fmtDate(u.created_at), fmtDate(lastLogin), tier, pct]
      : [u.first_name, u.last_name, u.username, fmtDate(u.created_at), fmtDate(lastLogin), tier, pct];
    lines.push(row.map(csvEscape).join(","));
  }
  downloadCsv(
    `users-${facilityLabel || "facility"}-${new Date().toISOString().slice(0, 10)}.csv`,
    lines,
  );
}

export function exportBulkFacilityProgressCsv(
  data: any,
  facilityLabel: string,
) {
  const { users, categories, items, progress, engagement, bookmarks, ratings, logins, userStats } = data as any;

  const progressSet = new Set<string>();
  const progressDate = new Map<string, string>();
  for (const r of progress as any[]) {
    const key = `${r.user_id}|${r.content_item_id}`;
    progressSet.add(key);
    if (r.created_at && !progressDate.has(key)) progressDate.set(key, r.created_at);
  }
  const engMap = new Map<string, any>();
  for (const r of engagement as any[]) engMap.set(`${r.user_id}|${r.content_item_id}`, r);
  const bookmarkSet = new Set<string>();
  for (const r of bookmarks as any[]) bookmarkSet.add(`${r.user_id}|${r.content_item_id}`);
  const ratingMap = new Map<string, number>();
  for (const r of ratings as any[]) ratingMap.set(`${r.user_id}|${r.content_item_id}`, r.rating as number);
  const lastLoginMap = new Map<string, string>();
  for (const r of logins as any[]) {
    if (!lastLoginMap.has(r.user_id) || r.login_date > (lastLoginMap.get(r.user_id) ?? "")) {
      lastLoginMap.set(r.user_id as string, r.login_date as string);
    }
  }
  const statsMap = new Map<string, any>();
  for (const r of userStats as any[]) statsMap.set(r.user_id as string, r);

  const itemsByCategory = new Map<string, any[]>();
  for (const item of items as any[]) {
    const cid = item.category_id as string;
    if (!itemsByCategory.has(cid)) itemsByCategory.set(cid, []);
    itemsByCategory.get(cid)!.push(item);
  }

  const lines: string[] = [];
  lines.push([
    "First Name", "Last Name", "Username",
    "Last Login", "Items Completed", "Time Spent (hrs)",
    "Category", "Item Title",
    "Completed", "Completed On", "Progress %", "Time on Item (min)",
    "Bookmarked", "Rating",
  ].map(csvEscape).join(","));

  let prevUid = "";
  let prevCatId = "";

  for (const user of users as any[]) {
    const uid = user.user_id as string;
    const stats = statsMap.get(uid);
    const itemsCompleted = stats?.items_completed ?? 0;
    const totalSecs = stats?.total_session_seconds ?? 0;
    const lastLogin = lastLoginMap.get(uid) ? fmtDate(lastLoginMap.get(uid)!) : "";
    const hoursSpent = totalSecs > 0 ? (totalSecs / 3600).toFixed(1) : "0";

    for (const cat of categories as any[]) {
      const catItems = itemsByCategory.get(cat.id as string) ?? [];
      for (const item of catItems) {
        const key = `${uid}|${item.id}`;
        const eng = engMap.get(key);
        const isRead = progressSet.has(key);
        const readDate = progressDate.get(key) ? fmtDate(progressDate.get(key)!) : "";
        const bookmarked = bookmarkSet.has(key) ? "Yes" : "";
        const rating = ratingMap.get(key);
        const ratingStr = rating === 1 ? "Helpful" : rating === -1 ? "Not helpful" : "";

        const isAV = item.type && (item.type.toLowerCase().includes("video") || item.type.toLowerCase().includes("audio") || item.type.toLowerCase().includes("podcast"));
        const isPdf = (item.file_url && /\.pdf(\?|#|$)/i.test(item.file_url)) || (item.url && /\.pdf(\?|#|$)/i.test(item.url));
        let progressPct = "";
        if (isRead) {
          progressPct = "100%";
        } else if (eng) {
          if (isAV && eng.media_progress_seconds && eng.media_duration_seconds > 0) {
            progressPct = `${Math.min(100, Math.round((eng.media_progress_seconds / eng.media_duration_seconds) * 100))}%`;
          } else if (isPdf && eng.manual_completion_pct != null) {
            progressPct = `${eng.manual_completion_pct}%`;
          }
        }

        const itemSecs = eng?.session_seconds ?? 0;
        const timeOnItem = itemSecs > 0 ? (itemSecs / 60).toFixed(1) : "";

        const isNewUser = uid !== prevUid;
        const isNewCat = isNewUser || cat.id !== prevCatId;

        lines.push([
          isNewUser ? (user.first_name ?? "") : "",
          isNewUser ? (user.last_name ?? "") : "",
          isNewUser ? (user.username ?? "") : "",
          isNewUser ? lastLogin : "",
          isNewUser ? itemsCompleted : "",
          isNewUser ? hoursSpent : "",
          isNewCat ? cat.name : "",
          item.title,
          isRead ? "Yes" : "No", readDate, progressPct, timeOnItem,
          bookmarked, ratingStr,
        ].map(csvEscape).join(","));

        prevUid = uid;
        prevCatId = cat.id;
      }
    }
  }

  downloadCsv(
    `bulk-progress-${facilityLabel.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
    lines,
  );
}
