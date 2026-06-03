import { createFileRoute } from "@tanstack/react-router";
import { requireStrictAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, ChevronDown, ChevronRight, CheckCircle2, XCircle, MinusCircle, SkipForward, Circle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { CircleProgress } from "@/components/CircleProgress";
import { fmtDate } from "@/lib/date-format";
import { listAllTestRuns, getAdminRunDetail } from "@/lib/test-runs.functions";
import { QA_TESTS, QA_SECTIONS, STATUS_LABELS, STATUS_ICONS, PRIORITY_LABELS, type TestStatus } from "@/lib/qa-test-plan";

export const Route = createFileRoute("/admin/test-results")({
  beforeLoad: requireStrictAdminBeforeLoad,
  component: AdminTestResultsPage,
});

const TOTAL_TESTS = QA_TESTS.length;

const STATUS_ICON_COMPONENTS: Record<TestStatus, typeof CheckCircle2> = {
  pass:     CheckCircle2,
  fail:     XCircle,
  blocked:  MinusCircle,
  skipped:  SkipForward,
  untested: Circle,
};

const STATUS_COLORS_ADMIN: Record<TestStatus, string> = {
  pass:     "text-green-600",
  fail:     "text-red-600",
  blocked:  "text-yellow-600",
  skipped:  "text-muted-foreground",
  untested: "text-muted-foreground/40",
};

function RunSummaryBar({ counts }: { counts: Record<string, number> }) {
  const pass    = counts.pass    ?? 0;
  const fail    = counts.fail    ?? 0;
  const blocked = counts.blocked ?? 0;
  const skipped = counts.skipped ?? 0;
  const total   = pass + fail + blocked + skipped;
  const pct     = total === 0 ? 0 : Math.round((pass / total) * 100);

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <CircleProgress value={pct} size={36} stroke={4} />
      <div className="flex gap-3 flex-wrap">
        {pass    > 0 && <span className="text-green-600 font-medium">{pass} passed</span>}
        {fail    > 0 && <span className="text-red-600 font-medium">{fail} failed</span>}
        {blocked > 0 && <span className="text-yellow-600 font-medium">{blocked} blocked</span>}
        {skipped > 0 && <span className="text-muted-foreground">{skipped} skipped</span>}
        <span className="text-muted-foreground">{TOTAL_TESTS - total} untested</span>
      </div>
    </div>
  );
}

function RunDetailView({ runId, onBack }: { runId: string; onBack: () => void }) {
  const fetchDetail = useServerFn(getAdminRunDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "test-run-detail", runId],
    queryFn: () => fetchDetail({ data: { runId } }),
    staleTime: 30_000,
  });
  const results = data?.results ?? [];

  // Map testId → result
  const resultMap = new Map<string, any>();
  for (const r of results) resultMap.set(r.test_id, r);

  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<TestStatus | "all">("all");

  const toggleSection = (n: number) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const failures = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "fail");

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        Back to all runs
      </button>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "fail", "pass", "blocked", "skipped", "untested"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === s
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {s === "all" ? "All tests" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Failures summary */}
      {failures.length > 0 && filterStatus !== "pass" && (
        <SectionCard className="mb-6 !p-5 border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700 mb-3">{failures.length} failure{failures.length !== 1 ? "s" : ""} require attention</p>
          <ul className="space-y-2">
            {failures.map((t) => {
              const res = resultMap.get(t.id);
              return (
                <li key={t.id} className="text-sm">
                  <span className="font-medium text-red-700">{t.id}</span>
                  <span className="text-red-600"> — {t.title}</span>
                  {res?.notes && <p className="mt-0.5 text-xs text-red-600/80 pl-8">{res.notes}</p>}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {isLoading && <EmptyState>Loading results…</EmptyState>}

      {/* Section accordions */}
      {!isLoading && (
        <div className="space-y-2">
          {QA_SECTIONS.map((section) => {
            const sectionTests = QA_TESTS.filter((t) => t.sectionNum === section.num);
            const filtered = filterStatus === "all"
              ? sectionTests
              : sectionTests.filter((t) => (resultMap.get(t.id)?.status ?? "untested") === filterStatus);
            if (filtered.length === 0) return null;

            const passCount = sectionTests.filter((t) => resultMap.get(t.id)?.status === "pass").length;
            const failCount = sectionTests.filter((t) => resultMap.get(t.id)?.status === "fail").length;
            const isOpen = openSections.has(section.num);

            return (
              <SectionCard key={section.num} padded={false} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(section.num)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium text-sm flex-1">
                    {section.num}. {section.title}
                  </span>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    {passCount > 0    && <span className="text-green-600 font-medium">{passCount}✓</span>}
                    {failCount > 0    && <span className="text-red-600 font-medium">{failCount}✗</span>}
                    <span className="text-muted-foreground">{sectionTests.length} tests</span>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border">
                    {filtered.map((test) => {
                      const res = resultMap.get(test.id);
                      const status: TestStatus = res?.status ?? "untested";
                      const StatusIcon = STATUS_ICON_COMPONENTS[status];
                      return (
                        <div key={test.id} className="flex items-start gap-3 px-5 py-3 border-b border-border/50 last:border-0">
                          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${STATUS_COLORS_ADMIN[status]}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{test.id}</span>
                              <span className="text-sm font-medium">{test.title}</span>
                              <span className={`text-[10px] font-medium uppercase tracking-wide ${
                                test.priority === "critical" ? "text-red-600" :
                                test.priority === "high"     ? "text-orange-600" :
                                test.priority === "medium"   ? "text-yellow-600" : "text-green-600"
                              }`}>{test.priority}</span>
                            </div>
                            {res?.notes && (
                              <p className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">{res.notes}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{STATUS_LABELS[status]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminTestResultsPage() {
  const fetchRuns = useServerFn(listAllTestRuns);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "test-runs"],
    queryFn: () => fetchRuns(),
    staleTime: 30_000,
  });
  const runs = data?.runs ?? [];
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = runs.find((r: any) => r.id === selectedRunId);

  return (
    <div>
      <PageHeader
        className="mt-6 mb-8"
        icon={ClipboardCheck}
        title="Test Results"
        description="QA test runs from all tester accounts."
      />

      {selectedRunId ? (
        <div>
          <div className="mb-6">
            <p className="font-display text-lg font-semibold">{selectedRun?.label ?? "Run"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedRun?.testerUsername} · {fmtDate(selectedRun?.created_at)}
              {selectedRun?.completed_at ? " · Completed" : " · In progress"}
            </p>
            {selectedRun && (
              <div className="mt-3">
                <RunSummaryBar counts={selectedRun.statusCounts} />
              </div>
            )}
          </div>
          <RunDetailView runId={selectedRunId} onBack={() => setSelectedRunId(null)} />
        </div>
      ) : (
        <>
          {isLoading && <EmptyState>Loading test runs…</EmptyState>}
          {!isLoading && runs.length === 0 && (
            <EmptyState>No test runs yet. Tester accounts will see a Testing tab on their dashboard.</EmptyState>
          )}
          {!isLoading && runs.length > 0 && (
            <SectionCard padded={false}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-5 py-3 font-medium text-muted-foreground">Run label</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Tester</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Progress</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Results</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run: any) => {
                    const counts: Record<string, number> = run.statusCounts ?? {};
                    const actioned = (counts.pass ?? 0) + (counts.fail ?? 0) + (counts.blocked ?? 0) + (counts.skipped ?? 0);
                    const pct = Math.round((actioned / TOTAL_TESTS) * 100);
                    return (
                      <tr
                        key={run.id}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <td className="px-5 py-4 font-medium">{run.label}</td>
                        <td className="px-5 py-4 text-muted-foreground">{run.testerUsername}</td>
                        <td className="px-5 py-4 text-muted-foreground">{fmtDate(run.created_at)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium ${
                            run.completed_at
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }`}>
                            {run.completed_at ? "Completed" : "In progress"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--color-accent)] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">{actioned}/{TOTAL_TESTS}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-xs">
                            {(counts.pass ?? 0) > 0    && <span className="text-green-600 font-medium">{counts.pass}✓</span>}
                            {(counts.fail ?? 0) > 0    && <span className="text-red-600 font-medium">{counts.fail}✗</span>}
                            {(counts.blocked ?? 0) > 0 && <span className="text-yellow-600 font-medium">{counts.blocked}⊘</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
