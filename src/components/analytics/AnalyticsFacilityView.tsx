import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { UserSectionHeader } from "@/components/UserSectionHeader";
import { formatTimeSpent } from "@/lib/date-format";
import { csvEscape, downloadCsv } from "@/lib/csv-utils";
import { getFacilityComparison } from "@/lib/analytics-stats.functions";
import { InfoTooltip, UsageReportView } from "./AnalyticsUsageReport";
import type { FacilityRow } from "./analytics-types";

export function FacilityComparisonSection() {
  const fetch = useServerFn(getFacilityComparison);
  const { data, isLoading } = useQuery({
    queryKey: ["facility-comparison"],
    queryFn: () => fetch(),
    staleTime: 10 * 60 * 1000,
  });

  const facilities = data?.facilities ?? [];
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : null;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <UserSectionHeader
          title="Facility Comparison"
          description={`All facilities ranked by average content completion rate.${updatedAt ? ` · Updated daily · Last updated ${updatedAt}` : ""}`}
        />
        {facilities.length > 0 && (
          <LoadingButton
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => exportFacilityComparisonCsv(facilities as FacilityRow[])}
            className="flex-shrink-0"
          >
            Export CSV
          </LoadingButton>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : facilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No facility data yet — run content and check back after the nightly refresh.</p>
      ) : (
        <SectionCard padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Facility</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Users <InfoTooltip text="Total registered users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Active (7d) <InfoTooltip text="Users who engaged with at least one piece of content in the last 7 days." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Active (30d) <InfoTooltip text="Users who engaged with at least one piece of content in the last 30 days." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Participation <InfoTooltip text="Percentage of total registered users who were active in the last 30 days." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Avg completion <InfoTooltip text="Average item completion rate across all content visible to this facility's users. Updated nightly." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Items completed <InfoTooltip text="Total number of content items completed by all users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Time spent <InfoTooltip text="Total accumulated session time across all users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Bookmarks <InfoTooltip text="Total number of content items bookmarked by users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Helpful <InfoTooltip text="Total thumbs-up ratings given by users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Not helpful <InfoTooltip text="Total thumbs-down ratings given by users at this facility." /></span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(facilities as FacilityRow[]).map((f) => (
                  <tr key={f.facilityValue} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium whitespace-nowrap">{f.facilityLabel}</div>
                      {f.facilitySiteId && (
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{f.facilitySiteId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{f.totalUsers}</td>
                    <td className="px-4 py-3 tabular-nums">{f.activeUsers7d}</td>
                    <td className="px-4 py-3 tabular-nums">{f.activeUsers30d}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {f.totalUsers > 0 ? `${Math.round((f.activeUsers30d / f.totalUsers) * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {f.avgCompletionRate != null ? (
                        <span className={f.avgCompletionRate >= 70 ? "text-[var(--color-accent)] font-medium" : f.avgCompletionRate >= 40 ? "" : "text-muted-foreground"}>
                          {f.avgCompletionRate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{f.itemsCompletedTotal}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {f.totalSessionSeconds > 0 ? formatTimeSpent(f.totalSessionSeconds) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f.totalBookmarks || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f.totalThumbsUp || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f.totalThumbsDown || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export function FacilityReportTab({ preselected }: { preselected: { value: string; label: string } }) {
  const fetch = useServerFn(getFacilityComparison);
  const { data } = useQuery({
    queryKey: ["facility-comparison"],
    queryFn: () => fetch(),
    staleTime: 10 * 60 * 1000,
  });

  const facilities = data?.facilities ?? [];
  const typedFacilities = facilities as FacilityRow[];
  const rank = typedFacilities.findIndex((f) => f.facilityValue === preselected.value) + 1;
  const total = typedFacilities.length;
  const thisStats = typedFacilities.find((f) => f.facilityValue === preselected.value);
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : null;

  return (
    <div>
      {rank > 0 && total > 1 && (
        <div className="mb-8 rounded-lg border border-border bg-muted/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div>
            <p className="text-xs text-muted-foreground tracking-wide font-medium mb-1">Facility Ranking</p>
            <p className="text-2xl font-bold tabular-nums">#{rank} <span className="text-sm font-normal text-muted-foreground">of {total} facilities</span></p>
          </div>
          {thisStats?.avgCompletionRate != null && (
            <div>
              <p className="text-xs text-muted-foreground tracking-wide font-medium mb-1">Avg Completion</p>
              <p className="text-2xl font-bold tabular-nums">{thisStats.avgCompletionRate}%</p>
            </div>
          )}
          {updatedAt && (
            <p className="text-xs text-muted-foreground sm:ml-auto self-end sm:self-center italic">Updated daily · Last updated {updatedAt}</p>
          )}
        </div>
      )}
      <UsageReportView
        scope={{ kind: "facility", facilityValue: preselected.value, facilityLabel: preselected.label }}
      />
    </div>
  );
}

function exportFacilityComparisonCsv(facilities: FacilityRow[]) {
  const lines: string[] = [];
  lines.push(["Facility", "Site ID", "Total users", "Active (7d)", "Active (30d)", "Participation (30d)", "Avg completion %", "Items completed", "Time spent", "Bookmarks", "Helpful", "Not helpful"].map(csvEscape).join(","));
  for (const f of facilities) {
    const participation = f.totalUsers > 0 ? `${Math.round((f.activeUsers30d / f.totalUsers) * 100)}%` : "";
    const row = [
      f.facilityLabel,
      f.facilitySiteId ?? "",
      String(f.totalUsers),
      String(f.activeUsers7d),
      String(f.activeUsers30d),
      participation,
      f.avgCompletionRate != null ? `${f.avgCompletionRate}%` : "",
      String(f.itemsCompletedTotal),
      f.totalSessionSeconds > 0 ? formatTimeSpent(f.totalSessionSeconds) : "",
      f.totalBookmarks || "",
      f.totalThumbsUp || "",
      f.totalThumbsDown || "",
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  downloadCsv(`facility-comparison-${new Date().toISOString().slice(0, 10)}.csv`, lines);
}
