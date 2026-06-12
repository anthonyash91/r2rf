import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-keys";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useBadgeStyles } from "@/hooks/use-badge-styles";
import { LoadingButton } from "@/components/LoadingButton";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { CircleProgress } from "@/components/CircleProgress";
import { ReadStatusBadge } from "@/components/ReadStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Circle, CheckCircle, XCircle, MinusCircle, SkipForward,
  ChevronRight, ChevronDown, AlertCircle, ChevronUp, Minus, LayoutList,
  Layers, ImagePlus, ExternalLink, X, ClipboardCheck, Plus, Trash2,
  CheckCircle2, Clock, Loader2, Info, Bookmark, ThumbsUp, ThumbsDown,
  User as UserIcon, type LucideIcon,
} from "lucide-react";
import { weightedCompletionPct } from "@/lib/content-progress";
import { withActionWord, parseMinutes } from "@/lib/duration";
import { formatTimeSpent, fmtDateShort } from "@/lib/date-format";
import { pickLang, translateDuration, translateType } from "@/lib/i18n";
import { readStatusLabels } from "@/lib/read-status";
import type { Category } from "@/lib/categories";
import {
  createTestRun, listMyTestRuns, getRunResults, upsertTestResult,
  completeTestRun, reopenTestRun, deleteTestRun, getQaScreenshotUploadUrl,
} from "@/lib/test-runs.functions";
import {
  QA_TESTS, QA_SECTIONS, PRIORITY_LABELS, STATUS_LABELS, STATUS_ICONS, STATUS_COLORS,
  type TestStatus,
} from "@/lib/qa-test-plan";

const TOTAL_TESTS = QA_TESTS.length;

const STATUS_ICON_COMPONENTS: Record<TestStatus, typeof CheckCircle> = {
  pass:     CheckCircle,
  fail:     XCircle,
  blocked:  MinusCircle,
  skipped:  SkipForward,
  untested: Circle,
};

function TestingTab() {
  const qc = useQueryClient();
  const createRunFn    = useServerFn(createTestRun);
  const listRunsFn     = useServerFn(listMyTestRuns);
  const getResultsFn   = useServerFn(getRunResults);
  const upsertFn       = useServerFn(upsertTestResult);
  const completeFn     = useServerFn(completeTestRun);
  const reopenFn       = useServerFn(reopenTestRun);
  const deleteRunFn    = useServerFn(deleteTestRun);
  const getUploadUrlFn = useServerFn(getQaScreenshotUploadUrl);

  const confirmDelete = useConfirmDelete();

  // Single hidden file input shared across all test items.
  // uploadTestIdRef tracks which test the next file-picker result belongs to.
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const uploadTestIdRef    = useRef<string | null>(null);
  const [uploadingTests, setUploadingTests] = useState<Set<string>>(new Set());

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);
  const [newLabel, setNewLabel]       = useState("");
  const [saving, setSaving]           = useState(false);

  const runsQuery = useQuery({
    queryKey: QK.myTestRuns,
    queryFn:  () => listRunsFn(),
    staleTime: 30_000,
  });
  const runs = runsQuery.data?.runs ?? [];

  const resultsQuery = useQuery({
    queryKey: QK.myTestRunResults(activeRunId),
    enabled:  !!activeRunId,
    queryFn:  () => getResultsFn({ data: { runId: activeRunId! } }),
    staleTime: 0,
  });

  // resultMap: testId → { status, notes, screenshot_url }
  const resultMap = new Map<string, { status: TestStatus; notes: string | null; screenshot_url: string | null }>();
  for (const r of resultsQuery.data?.results ?? []) {
    resultMap.set(r.test_id, { status: r.status as TestStatus, notes: r.notes ?? null, screenshot_url: r.screenshot_url ?? null });
  }

  const activeRun = runs.find((r: any) => r.id === activeRunId);
  const isCompleted = !!activeRun?.completed_at;

  // ── Local optimistic state for note editing ─────────────────────────────
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Set<string>>(new Set()); // briefly populated after a successful save
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set()); // tracks which test items have the notes section expanded
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [focusedSection, setFocusedSection] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<TestStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  function toggleSection(n: number) {
    const isCurrentlyOpen = openSections.has(n);
    if (isCurrentlyOpen) {
      // Close this section; clear focus
      setOpenSections((prev) => { const next = new Set(prev); next.delete(n); return next; });
      if (focusedSection === n) setFocusedSection(null);
    } else {
      // Accordion: close all others, open only this one, focus and scroll
      setOpenSections(new Set([n]));
      setFocusedSection(n);
      requestAnimationFrame(() => {
        const el = sectionRefs.current.get(n);
        if (!el) return;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
      });
    }
  }

  function jumpToSection(n: number) {
    // Accordion: close all others, open only this section, focus and scroll
    setOpenSections(new Set([n]));
    setFocusedSection(n);
    requestAnimationFrame(() => {
      const el = sectionRefs.current.get(n);
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
    });
  }

  async function handleSetStatus(testId: string, status: TestStatus) {
    if (!activeRunId || isCompleted) return;
    setSaving(true);
    try {
      const currentNotes = pendingNotes[testId] ?? resultMap.get(testId)?.notes ?? undefined;
      await upsertFn({ data: { runId: activeRunId, testId, status, notes: currentNotes } });
      qc.invalidateQueries({ queryKey: QK.myTestRunResults(activeRunId) });
      // Auto-expand the notes section for statuses that typically need an explanation.
      if (status === "fail" || status === "blocked") {
        setOpenNotes((prev) => new Set(prev).add(testId));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save result");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote(testId: string) {
    if (!activeRunId || isCompleted) return;
    const notes = pendingNotes[testId];
    if (notes === undefined) return;
    const currentStatus = resultMap.get(testId)?.status ?? "untested";
    try {
      await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes } });
      qc.invalidateQueries({ queryKey: QK.myTestRunResults(activeRunId) });
      setPendingNotes((prev) => { const next = { ...prev }; delete next[testId]; return next; });
      // "Saved ✓" persists until the user types again (onChange clears it).
      setSavedNotes((prev) => new Set(prev).add(testId));
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save note");
    }
  }

  async function handleRemoveNote(testId: string) {
    if (!activeRunId || isCompleted) return;
    // Clear local state immediately so the UI collapses.
    setPendingNotes((prev) => { const next = { ...prev }; delete next[testId]; return next; });
    setSavedNotes((prev) => { const next = new Set(prev); next.delete(testId); return next; });
    setOpenNotes((prev) => { const next = new Set(prev); next.delete(testId); return next; });
    // Persist the cleared note to the DB.
    const currentStatus = resultMap.get(testId)?.status ?? "untested";
    try {
      await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes: "" } });
      qc.invalidateQueries({ queryKey: QK.myTestRunResults(activeRunId) });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove note");
    }
  }

  async function handleScreenshotUpload(testId: string, file: File) {
    if (!activeRunId) return;
    setUploadingTests((prev) => new Set(prev).add(testId));
    try {
      const { signedUrl, publicUrl } = await getUploadUrlFn({ data: { runId: activeRunId, testId, fileName: file.name } });
      const res = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "image/png" }, body: file });
      if (!res.ok) throw new Error("Upload failed");
      const currentStatus = resultMap.get(testId)?.status ?? "untested";
      const currentNotes  = pendingNotes[testId] ?? resultMap.get(testId)?.notes ?? undefined;
      await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes: currentNotes, screenshotUrl: publicUrl } });
      qc.invalidateQueries({ queryKey: QK.myTestRunResults(activeRunId) });
      toast.success("Screenshot attached");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingTests((prev) => { const next = new Set(prev); next.delete(testId); return next; });
    }
  }

  async function handleRemoveScreenshot(testId: string) {
    if (!activeRunId) return;
    const currentStatus = resultMap.get(testId)?.status ?? "untested";
    const currentNotes  = pendingNotes[testId] ?? resultMap.get(testId)?.notes ?? undefined;
    await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes: currentNotes, screenshotUrl: null } });
    qc.invalidateQueries({ queryKey: QK.myTestRunResults(activeRunId) });
  }

  async function handleCreateRun() {
    const label = newLabel.trim();
    if (!label) return;
    try {
      const { run } = await createRunFn({ data: { label } });
      await qc.invalidateQueries({ queryKey: QK.myTestRuns });
      setActiveRunId((run as any).id);
      setCreating(false);
      setNewLabel("");
      setOpenSections(new Set());
      setFilterStatus("all");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create run");
    }
  }

  async function handleComplete() {
    if (!activeRunId) return;
    await completeFn({ data: { runId: activeRunId } });
    qc.invalidateQueries({ queryKey: QK.myTestRuns });
  }

  async function handleReopen() {
    if (!activeRunId) return;
    await reopenFn({ data: { runId: activeRunId } });
    qc.invalidateQueries({ queryKey: QK.myTestRuns });
  }

  async function handleDeleteRun(runId: string, label: string) {
    await confirmDelete({
      title: `Delete "${label}"?`,
      description: "This will permanently delete the test run and all its results, statuses, notes, and screenshots.",
      onConfirm: async () => {
        await deleteRunFn({ data: { runId } });
        if (activeRunId === runId) setActiveRunId(null);
        qc.invalidateQueries({ queryKey: QK.myTestRuns });
      },
    });
  }

  // ── Stats for the active run ───────────────────────────────────────────
  const passCount    = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "pass").length;
  const failCount    = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "fail").length;
  const blockedCount = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "blocked").length;
  const skippedCount = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "skipped").length;
  const actionedCount = passCount + failCount + blockedCount + skippedCount;
  const progressPct = Math.round((actionedCount / TOTAL_TESTS) * 100);
  const failures = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "fail");

  // ── Run list view ─────────────────────────────────────────────────────
  if (!activeRunId) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-7 w-7 text-[var(--color-accent)]" /> QA Test Runs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{TOTAL_TESTS} test cases across {QA_SECTIONS.length} sections</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New run
          </button>
        </div>

        {creating && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5 flex items-center gap-3">
            <input
              autoFocus
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateRun(); if (e.key === "Escape") { setCreating(false); setNewLabel(""); } }}
              placeholder="Run label (e.g. Post-deploy June 3)"
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateRun}
              disabled={!newLabel.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewLabel(""); }}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {runsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium">No test runs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a new run to start working through the QA checklist.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run: any) => {
              const counts: Record<string, number> = {};
              // We don't have counts in the list view — just show the run metadata
              return (
                <div
                  key={run.id}
                  className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => { setActiveRunId(run.id); setOpenSections(new Set()); setFilterStatus("all"); }}
                >
                  <ClipboardCheck className={`h-5 w-5 shrink-0 ${run.completed_at ? "text-green-600" : "text-[var(--color-accent)]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{run.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(run.created_at).toLocaleDateString()}
                      {run.completed_at ? " · Completed" : " · In progress"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id, run.label); }}
                    className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors text-[oklch(0.55_0.15_25)] border-[color-mix(in_oklab,oklch(0.55_0.15_25)_25%,transparent)] bg-[color-mix(in_oklab,oklch(0.55_0.15_25)_12%,transparent)] hover:bg-[color-mix(in_oklab,oklch(0.55_0.15_25)_20%,transparent)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Active run view ───────────────────────────────────────────────────
  return (
    <div>
      {/* Hidden file input shared across all test items */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const testId = uploadTestIdRef.current;
          if (file && testId) handleScreenshotUpload(testId, file);
          e.target.value = "";
        }}
      />
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          type="button"
          onClick={() => setActiveRunId(null)}
          className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> All runs
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-semibold truncate">{activeRun?.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(activeRun?.created_at).toLocaleDateString()}
            {isCompleted ? " · Completed" : " · In progress"}
          </p>
        </div>
        {isCompleted ? (
          <button
            type="button"
            onClick={handleReopen}
            className="shrink-0 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Reopen
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            className="shrink-0 inline-flex items-center gap-2 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
          >
            <CheckCircle className="h-4 w-4" /> Mark complete
          </button>
        )}
      </div>

      {/* Progress summary */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-6 flex items-center gap-5">
        <CircleProgress value={progressPct} size={64} stroke={6} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-2">{actionedCount} of {TOTAL_TESTS} tests actioned</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-green-600 font-medium">{passCount} passed</span>
            <span className="text-red-600 font-medium">{failCount} failed</span>
            <span className="text-yellow-600 font-medium">{blockedCount} blocked</span>
            <span className="text-muted-foreground">{skippedCount} skipped</span>
            <span className="text-muted-foreground">{TOTAL_TESTS - actionedCount} untested</span>
          </div>
        </div>
      </div>

      {/* Failures summary */}
      {failures.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 mb-6">
          <p className="text-sm font-semibold text-red-700 mb-3">
            {failures.length} failure{failures.length !== 1 ? "s" : ""} {failures.length !== 1 ? "require" : "requires"} attention
          </p>
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

      {/* Filters — two connected pills; active state matches the badge color in the test list */}
      {(() => {
        const PRIORITY_ICONS = { all: Layers, critical: AlertCircle, high: ChevronUp, medium: Minus, low: ChevronDown } as const;
        const DEFAULT_ACTIVE = "relative z-10 text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30";
        const DEFAULT_HOVER  = "hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/30";
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

        const STATUS_ACTIVE: Record<string, string> = {
          all:      DEFAULT_ACTIVE,
          ...STATUS_COLORS,
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

        return (
          <>
            <div className="flex items-center gap-3 my-6 lg:hidden">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TestStatus | "all")}>
                <SelectTrigger className="flex-1 min-w-0 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pass">Passed</SelectItem>
                  <SelectItem value="fail">Failed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="untested">Untested</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as typeof filterPriority)}>
                <SelectTrigger className="flex-1 min-w-0 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="hidden lg:flex items-center gap-3 my-6">
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
          </>
        );
      })()}

      {/* Section accordions — connected card list matching the dashboard category style */}
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
          const sActioned = sectionTests.filter((t) => {
            const s = resultMap.get(t.id)?.status ?? "untested";
            return s !== "untested";
          }).length;
          const sPct = Math.round((sActioned / sectionTests.length) * 100);
          const isOpen = openSections.has(section.num);

          return (
            <div
              key={section.num}
              ref={(el) => { if (el) sectionRefs.current.set(section.num, el); else sectionRefs.current.delete(section.num); }}
              className={`overflow-hidden scroll-mt-24 transition-all duration-200 ${
                focusedSection !== null && focusedSection !== section.num
                  ? "opacity-40"
                  : "opacity-100"
              } ${
                isOpen
                  ? "border-2 border-[var(--color-accent)] bg-[#fffdf8]"
                  : "border border-border bg-[#fffdf8]"
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
                    {sActioned} of {sectionTests.length} tests completed
                    {sPass > 0 && <span className="text-green-600 font-medium"> · {sPass} passed</span>}
                    {sFail > 0 && <span className="text-red-600 font-medium"> · {sFail} failed</span>}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${isOpen ? "" : "-rotate-90"}`} />
              </button>

              {isOpen && (
                <div className="border-t border-border divide-y divide-border/60">
                  {filtered.map((test) => {
                    const result = resultMap.get(test.id);
                    const status: TestStatus = result?.status ?? "untested";
                    const currentNote = pendingNotes[test.id] ?? result?.notes ?? "";
                    const noteDirty = pendingNotes[test.id] !== undefined && pendingNotes[test.id] !== (result?.notes ?? "");
                    const StatusIcon = STATUS_ICON_COMPONENTS[status];

                    return (
                      <div key={test.id} className="p-5" style={{ backgroundColor: status === "fail" ? "color-mix(in oklab, #fee2e2 40%, transparent)" : "#fffdf8" }}>
                        {/* Test header */}
                        <div className="flex items-start gap-3">
                          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${
                            status === "pass"     ? "text-green-600" :
                            status === "fail"     ? "text-red-600" :
                            status === "blocked"  ? "text-yellow-600" :
                            status === "skipped"  ? "text-muted-foreground" :
                            "text-muted-foreground/30"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-muted-foreground">{test.id}</span>
                              <div className="inline-flex items-center [&>span:not(:first-child)]:-ml-px [&>span:first-child]:rounded-r-none [&>span:not(:first-child):not(:last-child)]:rounded-none [&>span:last-child]:rounded-l-none [&>span:only-child]:rounded-[8px]">
                                {(() => {
                                  const priorityConfig = {
                                    critical: { icon: AlertCircle, label: "Critical", cls: "text-red-600 bg-red-50 border-red-200" },
                                    high:     { icon: ChevronUp,   label: "High",     cls: "text-orange-600 bg-orange-50 border-orange-200" },
                                    medium:   { icon: Minus,        label: "Medium",   cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
                                    low:      { icon: ChevronDown,  label: "Low",      cls: "text-green-600 bg-green-50 border-green-200" },
                                  }[test.priority];
                                  const PIcon = priorityConfig.icon;
                                  return (
                                    <span className={`inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] ${priorityConfig.cls}`}>
                                      <PIcon className="h-3.5 w-3.5" />
                                      {priorityConfig.label}
                                    </span>
                                  );
                                })()}
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
                              // Split the description at the pass-criteria marker so we can
                              // control the gap between steps and ✅ Pass independently.
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
                          </div>
                        </div>

                        {/* Status buttons + Add note button on the same row */}
                        {!isCompleted && (() => {
                          // Notes section is open when: manually opened, already has content, or status requires explanation.
                          const notesOpen = openNotes.has(test.id) || !!currentNote || status === "fail" || status === "blocked";
                          return (
                            <>
                              <div className="flex items-center mt-4 ml-7">
                                {/* Status buttons as a connected pill matching the filter pills */}
                                {(["pass", "fail", "blocked", "skipped", "untested"] as TestStatus[]).map((s, i, arr) => {
                                  const SIcon = STATUS_ICON_COMPONENTS[s];
                                  const isFirst = i === 0;
                                  const isLast = i === arr.length - 1;
                                  return (
                                    <span
                                      key={s}
                                      onClick={() => { if (!saving) handleSetStatus(test.id, s); }}
                                      className={[
                                        "inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 cursor-pointer transition-colors",
                                        !isFirst && "-ml-px",
                                        isFirst && isLast ? "rounded-[8px]" : isFirst ? "rounded-l-[8px] rounded-r-none" : isLast ? "rounded-l-none rounded-r-[8px]" : "rounded-none",
                                        status === s ? `relative z-10 ${STATUS_COLORS[s]}` : "bg-background text-muted-foreground border-border hover:bg-muted",
                                        saving ? "opacity-60 pointer-events-none" : "",
                                      ].filter(Boolean).join(" ")}
                                    >
                                      <SIcon className="h-3.5 w-3.5" />
                                      {STATUS_LABELS[s]}
                                    </span>
                                  );
                                })}
                                {/* Add note / Remove note — hidden for fail/blocked where notes are always expected */}
                                {status !== "fail" && status !== "blocked" && (
                                  <span
                                    onClick={() => notesOpen ? handleRemoveNote(test.id) : setOpenNotes((prev) => new Set(prev).add(test.id))}
                                    className={`ml-auto inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] cursor-pointer transition-colors ${notesOpen ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-border text-muted-foreground hover:bg-muted"}`}
                                  >
                                    {notesOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                    {notesOpen ? "Remove note" : "Add note"}
                                  </span>
                                )}
                              </div>

                              {/* Notes textarea + action row — only shown when notesOpen */}
                              {notesOpen && (
                                <div className="ml-7 mt-[14px]">
                                  <textarea
                                    rows={3}
                                    value={currentNote}
                                    placeholder="Add notes (required for failures)…"
                                    onChange={(e) => {
                                      setPendingNotes((prev) => ({ ...prev, [test.id]: e.target.value }));
                                      // Typing resets the "Saved ✓" state back to "Save note".
                                      setSavedNotes((prev) => { const next = new Set(prev); next.delete(test.id); return next; });
                                    }}
                                    onBlur={() => { if (noteDirty) handleSaveNote(test.id); }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                                  />
                                  <div className="flex items-center justify-between gap-2 mt-[8px]">
                                    {/* Left: screenshot button (only for fail/blocked/skipped) */}
                                    <div>
                                      {result?.screenshot_url ? (
                                        <div className="flex items-center gap-2">
                                          <a
                                            href={result.screenshot_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] border-input bg-background text-foreground hover:bg-muted transition-colors"
                                          >
                                            <ImagePlus className="h-3.5 w-3.5" />
                                            View screenshot
                                            <ExternalLink className="h-3 w-3 opacity-60" />
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveScreenshot(test.id)}
                                            className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            title="Remove screenshot"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ) : (status === "fail" || status === "blocked" || status === "skipped") && (
                                        <span
                                          onClick={() => {
                                            if (uploadingTests.has(test.id)) return;
                                            uploadTestIdRef.current = test.id;
                                            fileInputRef.current?.click();
                                          }}
                                          className={`inline-flex items-center border border-dashed px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] cursor-pointer transition-colors border-border text-muted-foreground hover:text-foreground ${uploadingTests.has(test.id) ? "opacity-60 pointer-events-none" : ""}`}
                                        >
                                          {uploadingTests.has(test.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                                          {uploadingTests.has(test.id) ? "Uploading…" : "Attach screenshot"}
                                        </span>
                                      )}
                                    </div>
                                    {/* Right: Save note — disabled until text is entered */}
                                    <span
                                      onClick={() => { if (currentNote.trim()) handleSaveNote(test.id); }}
                                      className={`inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] transition-colors ${
                                        !currentNote.trim()
                                          ? "border-input bg-background text-muted-foreground opacity-40 cursor-not-allowed"
                                          : savedNotes.has(test.id)
                                            ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer"
                                            : "border-input bg-background text-foreground hover:bg-muted cursor-pointer"
                                      }`}
                                    >
                                      {savedNotes.has(test.id) ? <><CheckCircle className="h-3.5 w-3.5" /> Saved</> : "Save note"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Completed state: notes + screenshot (only if content exists) */}
                        {isCompleted && (currentNote || result?.screenshot_url) && (
                          <div className="ml-7 mt-3">
                            {currentNote && (
                              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground whitespace-pre-line">
                                {currentNote}
                              </div>
                            )}
                            {result?.screenshot_url && (
                              <a
                                href={result.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 justify-center gap-1 rounded-[8px] border-input bg-background text-foreground hover:bg-muted transition-colors"
                              >
                                <ImagePlus className="h-3.5 w-3.5" />
                                View screenshot
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TestingTab;
