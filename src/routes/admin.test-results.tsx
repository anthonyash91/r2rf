import { createFileRoute } from "@tanstack/react-router";
import { requireStrictAdminBeforeLoad } from "@/lib/admin-guards";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardCheck, ChevronDown, ChevronRight,
  CheckCircle, XCircle, MinusCircle, SkipForward, Circle, Clock,
  LayoutList, Layers, AlertCircle, ChevronUp, Minus,
  ImagePlus, ExternalLink, User as UserIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { CircleProgress } from "@/components/CircleProgress";
import { fmtDate } from "@/lib/date-format";
import { listAllTestRuns, getAdminRunDetail } from "@/lib/test-runs.functions";
import { QA_TESTS, QA_SECTIONS, STATUS_LABELS, STATUS_COLORS, type TestStatus } from "@/lib/qa-test-plan";

export const Route = createFileRoute("/admin/test-results")({
  // Admin-only — requireStrictAdminBeforeLoad redirects all non-admin roles.
  // Server functions (listAllTestRuns, getAdminRunDetail) also assert admin independently.
  beforeLoad: requireStrictAdminBeforeLoad,
  component: AdminTestResultsPage,
});

const TOTAL_TESTS = QA_TESTS.length;

const STATUS_ICON_COMPONENTS: Record<TestStatus, typeof CheckCircle> = {
  pass:     CheckCircle,
  fail:     XCircle,
  blocked:  MinusCircle,
  skipped:  SkipForward,
  untested: Circle,
};


const PRIORITY_CONFIG = {
  critical: { icon: AlertCircle, label: "Critical", cls: "text-red-600 bg-red-50 border-red-200" },
  high:     { icon: ChevronUp,   label: "High",     cls: "text-orange-600 bg-orange-50 border-orange-200" },
  medium:   { icon: Minus,       label: "Medium",   cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  low:      { icon: ChevronDown, label: "Low",      cls: "text-green-600 bg-green-50 border-green-200" },
} as const;

function RunSummaryBar({ counts }: { counts: Record<string, number> }) {
  const pass    = counts.pass    ?? 0;
  const fail    = counts.fail    ?? 0;
  const blocked = counts.blocked ?? 0;
  const skipped = counts.skipped ?? 0;
  const actioned = pass + fail + blocked + skipped;
  const pct = Math.round((actioned / TOTAL_TESTS) * 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-5">
      <CircleProgress value={pct} size={64} stroke={6} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-2">{actioned} of {TOTAL_TESTS} tests actioned</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-green-600 font-medium">{pass} passed</span>
          <span className="text-red-600 font-medium">{fail} failed</span>
          <span className="text-yellow-600 font-medium">{blocked} blocked</span>
          <span className="text-muted-foreground">{skipped} skipped</span>
          <span className="text-muted-foreground">{TOTAL_TESTS - actioned} untested</span>
        </div>
      </div>
    </div>
  );
}

function RunDetailView({ runId }: { runId: string }) {
  const fetchDetail = useServerFn(getAdminRunDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "test-run-detail", runId],
    queryFn: () => fetchDetail({ data: { runId } }),
    staleTime: 30_000,
  });
  const results = data?.results ?? [];

  const resultMap = new Map<string, any>();
  for (const r of results) resultMap.set(r.test_id, r);

  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<TestStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  function toggleSection(n: number) {
    const isCurrentlyOpen = openSections.has(n);
    if (isCurrentlyOpen) {
      setOpenSections((prev) => { const next = new Set(prev); next.delete(n); return next; });
    } else {
      setOpenSections(new Set([n]));
      requestAnimationFrame(() => {
        const el = sectionRefs.current.get(n);
        if (!el) return;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
      });
    }
  }

  function jumpToSection(n: number) {
    setOpenSections(new Set([n]));
    requestAnimationFrame(() => {
      const el = sectionRefs.current.get(n);
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
    });
  }

  const failures = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "fail");

  // Connected pill renderer — identical to the tester dashboard
  const DEFAULT_ACTIVE = "relative z-10 text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30";
  const DEFAULT_HOVER  = "hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/30";
  const STATUS_ACTIVE: Record<string, string> = {
    all: DEFAULT_ACTIVE, ...STATUS_COLORS,
  };
  const STATUS_HOVER: Record<string, string> = {
    all:      DEFAULT_HOVER,
    pass:     "hover:text-green-700 hover:bg-green-50 hover:border-green-300",
    fail:     "hover:text-red-700 hover:bg-red-50 hover:border-red-300",
    blocked:  "hover:text-yellow-700 hover:bg-yellow-50 hover:border-yellow-300",
    skipped:  "hover:text-muted-foreground hover:bg-muted/60 hover:border-border",
    untested: "hover:text-muted-foreground hover:bg-muted hover:border-border",
  };
  const PRIORITY_ACTIVE: Record<string, string> = {
    all:      DEFAULT_ACTIVE,
    critical: "text-red-600 bg-red-50 border-red-200",
    high:     "text-orange-600 bg-orange-50 border-orange-200",
    medium:   "text-yellow-600 bg-yellow-50 border-yellow-200",
    low:      "text-green-600 bg-green-50 border-green-200",
  };
  const PRIORITY_HOVER: Record<string, string> = {
    all:      DEFAULT_HOVER,
    critical: "hover:text-red-600 hover:bg-red-50 hover:border-red-200",
    high:     "hover:text-orange-600 hover:bg-orange-50 hover:border-orange-200",
    medium:   "hover:text-yellow-600 hover:bg-yellow-50 hover:border-yellow-200",
    low:      "hover:text-green-600 hover:bg-green-50 hover:border-green-200",
  };
  const PRIORITY_ICONS = { all: Layers, critical: AlertCircle, high: ChevronUp, medium: Minus, low: ChevronDown } as const;

  const renderPill = (buttons: { key: string; Icon: any; label: string; active: boolean; activeClass: string; hoverClass: string; onClick: () => void }[]) =>
    buttons.map(({ key, Icon, label, active, activeClass, hoverClass, onClick }, i) => {
      const isFirst = i === 0;
      const isLast = i === buttons.length - 1;
      return (
        <span
          key={key}
          onClick={onClick}
          className={[
            "inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 cursor-pointer transition-colors",
            !isFirst && "-ml-px",
            isFirst && isLast ? "rounded-[8px]" : isFirst ? "rounded-l-[8px] rounded-r-none" : isLast ? "rounded-l-none rounded-r-[8px]" : "rounded-none",
            active ? `relative z-10 ${activeClass}` : `bg-background text-muted-foreground border-border ${hoverClass}`,
          ].filter(Boolean).join(" ")}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    });

  return (
    <div>
      {/* Failures summary */}
      {failures.length > 0 && filterStatus !== "pass" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 mb-6">
          <p className="text-sm font-semibold text-red-700 mb-3">{failures.length} failure{failures.length !== 1 ? "s" : ""} {failures.length !== 1 ? "require" : "requires"} attention</p>
          <ul className="space-y-1.5">
            {failures.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => jumpToSection(t.sectionNum)}
                  className="text-sm text-left hover:underline"
                >
                  <span className="font-medium text-red-700">{t.id}</span>
                  <span className="text-red-600"> — {t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter pills — connected groups matching the tester dashboard */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex items-center">
          {renderPill((["all", "pass", "fail", "blocked", "skipped", "untested"] as const).map((s) => ({
            key: `s-${s}`,
            Icon: s === "all" ? LayoutList : STATUS_ICON_COMPONENTS[s],
            label: s === "all" ? "All" : STATUS_LABELS[s],
            active: filterStatus === s,
            activeClass: STATUS_ACTIVE[s],
            hoverClass: STATUS_HOVER[s],
            onClick: () => setFilterStatus(s),
          })))}
        </div>
        <span className="h-5 w-px bg-border shrink-0" />
        <div className="flex items-center">
          {renderPill((["all", "critical", "high", "medium", "low"] as const).map((p) => ({
            key: `p-${p}`,
            Icon: PRIORITY_ICONS[p],
            label: p === "all" ? "All priorities" : p.charAt(0).toUpperCase() + p.slice(1),
            active: filterPriority === p,
            activeClass: PRIORITY_ACTIVE[p],
            hoverClass: PRIORITY_HOVER[p],
            onClick: () => setFilterPriority(p),
          })))}
        </div>
      </div>

      {isLoading && <EmptyState>Loading results…</EmptyState>}

      {/* Section accordions — connected card list matching the tester dashboard */}
      {!isLoading && (
        <div className="flex flex-col [&>div]:rounded-none [&>div:first-child]:rounded-t-2xl [&>div:last-child]:rounded-b-2xl [&>div:not(:first-child)]:-mt-px">
          {QA_SECTIONS.map((section) => {
            const sectionTests = QA_TESTS.filter((t) => t.sectionNum === section.num);
            const filtered = sectionTests.filter((t) => {
              const statusMatch = filterStatus === "all" || (resultMap.get(t.id)?.status ?? "untested") === filterStatus;
              const priorityMatch = filterPriority === "all" || t.priority === filterPriority;
              return statusMatch && priorityMatch;
            });
            if (filtered.length === 0) return null;

            const sPass    = sectionTests.filter((t) => resultMap.get(t.id)?.status === "pass").length;
            const sFail    = sectionTests.filter((t) => resultMap.get(t.id)?.status === "fail").length;
            const sActioned = sectionTests.filter((t) => (resultMap.get(t.id)?.status ?? "untested") !== "untested").length;
            const sPct = Math.round((sActioned / sectionTests.length) * 100);
            const isOpen = openSections.has(section.num);

            return (
              <div
                key={section.num}
                ref={(el) => { if (el) sectionRefs.current.set(section.num, el); else sectionRefs.current.delete(section.num); }}
                className={`overflow-hidden scroll-mt-24 transition-all duration-200 ${
                  isOpen ? "border-2 border-[var(--color-accent)] bg-[#fffdf8]" : "border border-border bg-[#fffdf8]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.num)}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${isOpen ? "bg-[#f7f5ed]" : "hover:bg-[#f7f5ed]"}`}
                >
                  <CircleProgress value={sPct} size={52} stroke={5} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-base sm:text-lg font-semibold truncate">
                      {section.num}. {section.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {sActioned} of {sectionTests.length} tests actioned
                      {sPass > 0 && <span className="text-green-600 font-medium"> · {sPass} passed</span>}
                      {sFail > 0 && <span className="text-red-600 font-medium"> · {sFail} failed</span>}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${isOpen ? "" : "-rotate-90"}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-border divide-y divide-border/60">
                    {filtered.map((test) => {
                      const res = resultMap.get(test.id);
                      const status: TestStatus = res?.status ?? "untested";
                      const StatusIcon = STATUS_ICON_COMPONENTS[status];
                      const pc = PRIORITY_CONFIG[test.priority as keyof typeof PRIORITY_CONFIG];
                      const PIcon = pc.icon;
                      return (
                        <div key={test.id} className="flex items-start gap-3 p-5" style={{ backgroundColor: status === "fail" ? "color-mix(in oklab, #fee2e2 40%, transparent)" : "#fffdf8" }}>
                          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${
                            status === "pass"    ? "text-green-600" :
                            status === "fail"    ? "text-red-600" :
                            status === "blocked" ? "text-yellow-600" :
                            status === "skipped" ? "text-muted-foreground" :
                            "text-muted-foreground/30"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-muted-foreground">{test.id}</span>
                              <div className="inline-flex items-center [&>span:not(:first-child)]:-ml-px [&>span:first-child]:rounded-r-none [&>span:not(:first-child):not(:last-child)]:rounded-none [&>span:last-child]:rounded-l-none [&>span:only-child]:rounded-[8px]">
                                <span className={`inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] ${pc.cls}`}>
                                  <PIcon className="h-3.5 w-3.5" />
                                  {pc.label}
                                </span>
                                <span className={`inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] ${STATUS_COLORS[status]}`}>
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  {STATUS_LABELS[status]}
                                </span>
                                {test.roles && test.roles.map((role) => (
                                  <span key={role} className="inline-flex items-center gap-1 rounded-[8px] border border-border bg-background px-2.5 py-[5px] text-xs font-medium text-muted-foreground">
                                    <UserIcon className="h-3.5 w-3.5 shrink-0" />
                                    {role}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <p className="text-sm font-medium mt-2 mb-1">{test.title}</p>
                            {(() => {
                              const parts = test.description.split('\n\n✅ Pass:');
                              return parts.length === 2 ? (
                                <>
                                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{parts[0]}</p>
                                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line mt-1.5">✅ Pass:{parts[1]}</p>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{test.description}</p>
                              );
                            })()}
                            {(res?.notes || (res as any)?.screenshot_url) && (
                              <div className="mt-[14px]">
                                {res?.notes && (
                                  <p className="text-xs text-muted-foreground rounded-md border border-input bg-background px-3 py-2 whitespace-pre-line">{res.notes}</p>
                                )}
                                {(res as any)?.screenshot_url && (
                                  <div className={res?.notes ? "mt-[14px]" : ""}>
                                    <a href={(res as any).screenshot_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] border-input bg-background text-foreground hover:bg-muted transition-colors"
                                    >
                                      <ImagePlus className="h-3.5 w-3.5" />
                                      View screenshot
                                      <ExternalLink className="h-3 w-3 opacity-60" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
          <div className="flex items-start gap-4 mb-6">
            <button
              type="button"
              onClick={() => setSelectedRunId(null)}
              className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ChevronRight className="h-4 w-4 rotate-180" /> All runs
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg font-semibold truncate">{selectedRun?.label ?? "Run"}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedRun?.testerUsername} · {fmtDate(selectedRun?.created_at)}
                {selectedRun?.completed_at ? " · Completed" : " · In progress"}
              </p>
            </div>
          </div>
          {selectedRun && (
            <div className="mb-6">
              <RunSummaryBar counts={selectedRun.statusCounts} />
            </div>
          )}
          <RunDetailView runId={selectedRunId} />
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
                          <span className={`inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] ${
                            run.completed_at
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }`}>
                            {run.completed_at
                              ? <><CheckCircle className="h-3.5 w-3.5" /> Completed</>
                              : <><Clock className="h-3.5 w-3.5" /> In progress</>}
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
                          <div className="flex items-center gap-1.5">
                            {(counts.pass ?? 0) > 0    && <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl border text-xs font-semibold tabular-nums" style={{ color: "oklch(0.52 0.12 165)", backgroundColor: "color-mix(in oklab, oklch(0.52 0.12 165) 12%, transparent)", borderColor: "color-mix(in oklab, oklch(0.52 0.12 165) 25%, transparent)" }}>{counts.pass}</span>}
                            {(counts.fail ?? 0) > 0    && <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl border text-xs font-semibold tabular-nums" style={{ color: "oklch(0.55 0.15 25)", backgroundColor: "color-mix(in oklab, oklch(0.55 0.15 25) 12%, transparent)", borderColor: "color-mix(in oklab, oklch(0.55 0.15 25) 25%, transparent)" }}>{counts.fail}</span>}
                            {(counts.blocked ?? 0) > 0 && <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl border text-xs font-semibold tabular-nums" style={{ color: "oklch(0.60 0.12 80)", backgroundColor: "color-mix(in oklab, oklch(0.60 0.12 80) 12%, transparent)", borderColor: "color-mix(in oklab, oklch(0.60 0.12 80) 25%, transparent)" }}>{counts.blocked}</span>}
                            {!(counts.pass ?? 0) && !(counts.fail ?? 0) && !(counts.blocked ?? 0) && <span className="text-xs text-muted-foreground">—</span>}
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
