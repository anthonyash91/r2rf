import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { requireContentAdminBeforeLoad } from "@/lib/admin-guards";
import { Checkbox } from "@/components/ui/checkbox";
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category, type ContentItem, type ContentChapter } from "@/lib/categories";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { withActionWord } from "@/lib/duration";
import { useI18n, translateDuration } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Save, X, Sparkles, RefreshCw, ExternalLink, Pencil, FolderOpen, GripVertical, Info, Tag, ChevronDown, ChevronUp, Languages, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateCategoryCopy, generateContentDescription } from "@/lib/category-ai.functions";
import { listFacilities } from "@/lib/facilities.functions";
import { generateUniqueCategoryIcon, resolveCategoryIcon } from "@/lib/category-icons";
import { FileUploader } from "@/components/FileUploader";
import { StreamUploader } from "@/components/StreamUploader";
import { uploadFile } from "@/lib/upload-client";
import { deleteStorageFile, estimatePdfDuration } from "@/lib/storage.functions";
import {
  uploadFileToStream,
  waitForStreamProcessing,
  beginStreamUpload,
  runTusUpload,
} from "@/lib/upload-stream-client";
import { useTranslateToSpanish } from "@/components/TranslateButton";
import { TranslationPanel } from "@/components/TranslationPanel";
const SortableList = lazy(() =>
  import("@/components/SortableList").then((m) => ({ default: m.SortableList }))
);
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { IconButton, TooltipWrap, iconButtonClassName } from "@/components/IconButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { useBadgeStyles } from "@/hooks/use-badge-styles";
import { paletteStyle, nextUnusedIndex, paletteIndexOfColor, DEFAULT_BADGE_STYLES, BADGE_VARIANTS, type BadgeStyles } from "@/lib/badge-styles";
import { badgeStylesQueryKey, BADGE_STYLES_KEY } from "@/hooks/use-badge-styles";
import { BulkActionBar } from "@/components/BulkActionBar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LabeledInput } from "@/components/FormField";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { LoadingButton, actionButtonClassName } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { FacilityBadge } from "@/components/FacilityBadge";
import { isMutationPendingFor } from "@/hooks/use-row-pending";
import { PageHeader } from "@/components/PageHeader";
import { BackToTopButton } from "@/components/BackToTopButton";
import { QK } from "@/lib/query-keys";


function itemTranslationStatus(item: ContentItem): "complete" | "partial" | "missing" {
  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [item.title, item.title_es],
    [item.description?.trim() ? item.description : null, item.description_es],
    [item.source?.trim() ? item.source : null, item.source_es],
  ];
  const required = pairs.filter(([en]) => !!en?.toString().trim());
  if (required.length === 0) return "complete";
  const translated = required.filter(([, es]) => !!es?.toString().trim()).length;
  if (translated === 0) return "missing";
  if (translated < required.length) return "partial";
  return "complete";
}


export const Route = createFileRoute("/admin/category/$id")({
  beforeLoad: requireContentAdminBeforeLoad,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
  component: AdminCategoryPage,
});

function AdminCategoryPage() {
  const { isFacilityUser, rolesLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (rolesLoaded && isFacilityUser) navigate({ to: "/admin/users" });
  }, [isFacilityUser, rolesLoaded, navigate]);

  if (!rolesLoaded || isFacilityUser) return null;
  return <AdminCategoryPageContent />;
}

function AdminCategoryPageContent() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QK.adminCategory(id),
    queryFn: async () => {
      const { data: cat, error: e1 } = await supabase.from("categories").select("*").eq("id", id).single();
      if (e1) throw e1;
      const { data: catFacLinks } = await (supabase as any)
        .from("category_facilities")
        .select("facility_value")
        .eq("category_id", id);
      const catFacilities = ((catFacLinks ?? []) as { facility_value: string }[]).map((r) => r.facility_value);
      const { data: items, error: e2 } = await supabase
        .from("content_items")
        .select("*")
        .eq("category_id", id)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      const itemIds = (items ?? []).map((i) => i.id as string);
      const facilityMap: Record<string, string[]> = {};
      if (itemIds.length > 0) {
        const { data: links, error: linksError } = await (supabase as any)
          .from("content_item_facilities")
          .select("content_item_id, facility_value")
          .in("content_item_id", itemIds);
        if (linksError) {
          console.error("[admin category] facility restrictions fetch failed:", linksError.message);
        } else {
          for (const link of (links ?? []) as Array<{ content_item_id: string; facility_value: string }>) {
            if (!facilityMap[link.content_item_id]) facilityMap[link.content_item_id] = [];
            facilityMap[link.content_item_id].push(link.facility_value);
          }
        }
      }
      const itemsWithFacilities = (items ?? []).map((item) => ({
        ...item,
        facilities: facilityMap[item.id as string] ?? [],
      })) as ContentItem[];
      return {
        category: { ...cat, facilities: catFacilities } as Category,
        items: itemsWithFacilities,
      };
    },
  });

  const saveCategory = useMutation({
    mutationFn: async (input: Partial<Category>) => {
      const { facilities, ...categoryFields } = input;
      const { error } = await (supabase as any)
        .from("categories")
        .update(categoryFields)
        .eq("id", id);
      if (error) throw error;
      // Sync category_facilities
      await (supabase as any).from("category_facilities").delete().eq("category_id", id);
      if (facilities && facilities.length > 0) {
        await (supabase as any).from("category_facilities").insert(
          facilities.map((f) => ({ category_id: id, facility_value: f }))
        );
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: QK.adminCategory(id) });
      qc.invalidateQueries({ queryKey: QK.adminCategories });
      qc.invalidateQueries({ queryKey: QK.adminCategoryFacilityMap });
      qc.invalidateQueries({ queryKey: QK.categories });
      qc.invalidateQueries({ queryKey: QK.categoryBase });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      {isLoading || !data ? (
        <p className="mt-6 text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-6">
            <PageHeader
              icon={FolderOpen}
              title="Edit Category"
              description="Update the category name, copy, icon, and visibility settings."
            />
          </div>
          <CategoryEditor category={data.category} onSave={(v) => saveCategory.mutate(v)} busy={saveCategory.isPending} />
          <ContentManager
            categoryId={id}
            categoryName={data.category.name}
            categorySlug={data.category.slug}
            items={data.items}
            initialEditId={edit}
            categoryFacilities={data.category.facilities ?? []}
            sectionOrder={data.category.section_order ?? []}
          />
          <BackToTopButton />
        </>
      )}
    </div>
  );
}

function CategoryEditor({
  category,
  onSave,
  busy,
}: {
  category: Category;
  onSave: (v: Partial<Category>) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [tagline, setTagline] = useState(category.tagline);
  const [description, setDescription] = useState(category.description);
  const [iconName, setIconName] = useState<string | null>(category.icon_name);
  const [iconColor, setIconColor] = useState<string | null>(category.icon_color);
  const [published, setPublished] = useState(category.published);
  const [catFacilities, setCatFacilities] = useState<string[]>(category.facilities ?? []);
  const [nameEs, setNameEs] = useState(category.name_es ?? "");
  const [taglineEs, setTaglineEs] = useState(category.tagline_es ?? "");
  const [descriptionEs, setDescriptionEs] = useState(category.description_es ?? "");
  const [showEs, setShowEs] = useState(
    !!(category.name_es || category.tagline_es || category.description_es),
  );
  const [iconKeywords, setIconKeywords] = useState("");
  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();


  useEffect(() => {
    setName(category.name);
    setSlug(category.slug);
    setTagline(category.tagline);
    setDescription(category.description);
    setIconName(category.icon_name);
    setIconColor(category.icon_color);
    setPublished(category.published);
    setCatFacilities(category.facilities ?? []);
    setNameEs(category.name_es ?? "");
    setTaglineEs(category.tagline_es ?? "");
    setDescriptionEs(category.description_es ?? "");
    if (category.name_es || category.tagline_es || category.description_es) setShowEs(true);
  }, [category]);

  const catBadgeStyles = useBadgeStyles();
  const facilityPs = paletteStyle(catBadgeStyles.variants["facility"] ?? 11);
  const fetchFacilityList = useServerFn(listFacilities);
  const { data: facilityListData } = useQuery({
    queryKey: QK.facilities,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilityList(),
  });
  const allFacilities = facilityListData?.facilities ?? [];

  const generate = useServerFn(generateCategoryCopy);
  const [generating, setGenerating] = useState(false);

  async function handleAutoGenerate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a name first");
      return;
    }
    setGenerating(true);
    try {
      const result = await generate({ data: { name: trimmed } });
      if (result.tagline) setTagline(result.tagline);
      if (result.description) setDescription(result.description);
      toast.success("Generated tagline and description");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerateIcon() {
    const { data, error } = await supabase
      .from("categories")
      .select("id, icon_name, icon_color");
    if (error) {
      toast.error(error.message);
      return;
    }
    const others = (data ?? []).filter((r) => r.id !== category.id);
    const trimmed = name.trim();
    const kw = iconKeywords.trim();
    const next = generateUniqueCategoryIcon({
      usedNames: others.map((c) => c.icon_name),
      usedColors: others.map((c) => c.icon_color),
      title: kw ? `${trimmed} ${kw}` : trimmed,
    });
    setIconName(next.icon_name);
    setIconColor(next.icon_color);
    toast.success("New icon generated. Save to apply.");
  }


  return (
    <SectionCard className="mt-8 pt-[18px]">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            slug: slugify(slug),
            tagline,
            description,
            icon_name: iconName,
            icon_color: iconColor,
            published,
            facilities: catFacilities,
            name_es: nameEs.trim() || null,
            tagline_es: taglineEs.trim() || null,
            description_es: descriptionEs.trim() || null,
          });
        }}
      >
        <div className="grid sm:grid-cols-3 gap-4 items-start">
          <LabeledInput label="Name" value={name} onChange={setName} />
          <LabeledInput label="Slug" value={slug} onChange={(v) => setSlug(slugify(v))} />
          <div id="facilities-section" className="sm:relative">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              Facilities
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground rounded-sm focus:outline-none">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">
                    Restrict this category to specific facilities. Only users whose profile matches a selected facility will see it. Leave empty to show to everyone.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <div className="mt-1">
              <FacilityCombobox
                value=""
                onChange={(v) => { if (v && !catFacilities.includes(v)) setCatFacilities((prev) => [...prev, v]); }}
                options={allFacilities.filter((a) => !catFacilities.includes(a.value))}
                placeholder="Add facility…"
                searchPlaceholder="Search facilities…"
                emptyMessage={allFacilities.length === 0 ? "No facilities found." : "All facilities selected."}
              />
            </div>
            {catFacilities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 sm:absolute sm:top-full sm:inset-x-0 sm:mt-0 sm:pt-2 sm:z-10">
                {catFacilities.map((f) => {
                  const label = allFacilities.find((a) => a.value === f)?.label ?? f;
                  return (
                    <span key={f} className="inline-flex items-center gap-1 leading-none rounded-[8px] border px-2.5 py-[5px] text-xs font-medium flex-shrink-0" style={{ color: facilityPs.color, backgroundColor: facilityPs.bg, borderColor: facilityPs.border }}>
                      {label}
                      <button type="button" onClick={() => setCatFacilities((prev) => prev.filter((x) => x !== f))} className="rounded-[2px] p-0.5 hover:bg-black/10 dark:hover:bg-white/10">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div>
          <LoadingButton
            variant="secondary"
            onClick={handleAutoGenerate}
            disabled={generating || !name.trim()}
            pending={generating}
            pendingText="Generating…"
            icon={<Sparkles className="h-4 w-4" />}
          >
            Auto-generate tagline & description
          </LoadingButton>
          <p className="mt-1 text-xs text-muted-foreground">Uses the Name to draft copy. You can edit the result.</p>
        </div>
        <LabeledInput label="Tagline" value={tagline} onChange={setTagline} />
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
        </label>
        <div>
          <span className="text-sm font-medium">Icon</span>
          <div className="mt-2 flex items-start gap-4">
            {(() => {
              const Icon = resolveCategoryIcon(iconName);
              const color = iconColor || "var(--color-accent)";
              return (
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
                    borderColor: `color-mix(in oklab, ${color} 25%, transparent)`,
                  }}
                >
                  <Icon className="h-7 w-7" style={{ color }} strokeWidth={1.75} />
                </div>
              );
            })()}

            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <input
                type="search"
                value={iconKeywords}
                onChange={(e) => setIconKeywords(e.target.value)}
                placeholder="Optional keywords for a better result (e.g. coffee, gym, books)"
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-3">
                <LoadingButton
                  variant="secondary"
                  onClick={handleRegenerateIcon}
                  icon={<RefreshCw className="h-4 w-4" />}
                >
                  Regenerate icon
                </LoadingButton>
                <p className="text-xs text-muted-foreground">Generate an icon preview.</p>
              </div>
            </div>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox checked={published} onCheckedChange={(v) => setPublished(Boolean(v))} />

          Published (visible to the public)
        </label>


        <TranslationPanel
          open={showEs}
          onOpenChange={setShowEs}
          busy={addEsBusy}
          onTranslate={() => {
            runAddEs(
              { name, tagline, description },
              (t) => {
                if (t.name) setNameEs(t.name);
                if (t.tagline) setTaglineEs(t.tagline);
                if (t.description) setDescriptionEs(t.description);
              },
              "Category metadata for a content library",
            );
          }}
        >
          <LabeledInput label="Name (ES)" value={nameEs} onChange={setNameEs} />
          <LabeledInput label="Tagline (ES)" value={taglineEs} onChange={setTaglineEs} />
          <label className="block">
            <span className="text-sm font-medium">Description (ES)</span>
            <textarea
              rows={3}
              value={descriptionEs}
              onChange={(e) => setDescriptionEs(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
          </label>
        </TranslationPanel>

        <div className="flex justify-end gap-2">
          <Link to="/admin">
            <LoadingButton variant="secondary" type="button">
              Cancel
            </LoadingButton>
          </Link>
          <LoadingButton
            type="submit"
            pending={busy}
            pendingText="Saving…"
            icon={<Save className="h-4 w-4" />}
          >
            Save
          </LoadingButton>
        </div>
      </form>
    </SectionCard>
  );
}

// Lets an admin control the top-to-bottom order sections appear in on the
// public category page — independent of item order/type, since a section is
// just a free-text label an admin assigns per item (see ItemEditor's
// "Section" field). Only shown once 2+ distinct sections are in use; a
// single section has nothing to order relative to.
function SectionsPanel({
  categoryId,
  items,
  sectionOrder,
  onReordered,
}: {
  categoryId: string;
  items: ContentItem[];
  sectionOrder: string[];
  onReordered: () => void;
}) {
  const qc = useQueryClient();
  const distinctSections = Array.from(
    new Set(items.map((i) => i.section).filter((s): s is string => !!s?.trim())),
  );
  const orderedLower = sectionOrder.map((s) => s.trim().toLowerCase());
  const bySection = new Map(distinctSections.map((s) => [s.trim().toLowerCase(), s]));
  const seen = new Set<string>();
  const displayOrder: string[] = [];
  for (const k of orderedLower) {
    const original = bySection.get(k);
    if (original) {
      displayOrder.push(original);
      seen.add(k);
    }
  }
  for (const s of distinctSections
    .filter((s) => !seen.has(s.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b))) {
    displayOrder.push(s);
  }

  const reorderMut = useMutation({
    mutationFn: async (newOrder: string[]) => {
      const { error } = await (supabase as any)
        .from("categories")
        .update({ section_order: newOrder.map((s) => s.trim().toLowerCase()) })
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: onReordered,
    onError: (e: any) => toast.error(e.message ?? "Failed to reorder sections"),
  });

  function move(section: string, direction: -1 | 1) {
    const idx = displayOrder.indexOf(section);
    const swapWith = idx + direction;
    if (idx < 0 || swapWith < 0 || swapWith >= displayOrder.length) return;
    const next = [...displayOrder];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    reorderMut.mutate(next);
  }

  if (displayOrder.length < 2) return null;

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Section order (category page)
      </p>
      <ul className="space-y-1">
        {displayOrder.map((s, idx) => (
          <li key={s} className="flex items-center gap-1 text-sm">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => move(s, -1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === displayOrder.length - 1}
              onClick={() => move(s, 1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type BulkReviewSavePayload = {
  id: string;
  title: string;
  type: string;
  section: string | null;
  section_es: string | null;
  description: string;
  published: boolean;
};

// Shown above the item list right after a bulk upload — one lightweight
// card per just-created (unpublished) item, so the admin can fill in the
// real details without leaving this page or opening the full ItemEditor N
// times. Cards are purely a review convenience: the rows already exist and
// are already saved, so dismissing (individually or all at once) just hides
// the card, it never deletes anything. Field edits are lifted up here (not
// held in each card) so one "Save all" button can save every card's current
// values in a single action.
function BulkReviewPanel({
  ids,
  items,
  typeOptions,
  existingSections,
  onSaveAll,
  saving,
  onDismiss,
  onDismissAll,
}: {
  ids: string[];
  items: ContentItem[];
  typeOptions: string[];
  existingSections: string[];
  onSaveAll: (payloads: BulkReviewSavePayload[]) => void;
  saving: boolean;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}) {
  const reviewItems = ids
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is ContentItem => !!i);

  const [drafts, setDrafts] = useState<Record<string, BulkReviewSavePayload>>({});

  // Seed a draft for any reviewed item that doesn't have one yet — defaults
  // Published to true (the common case: the admin is here specifically to
  // finish and publish), not the item's actual just-created "false" state.
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of reviewItems) {
        if (next[item.id]) continue;
        next[item.id] = {
          id: item.id,
          title: item.title,
          type: item.type,
          section: item.section ?? null,
          section_es: item.section_es ?? null,
          description: item.description ?? "",
          published: true,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewItems.map((i) => i.id).join(",")]);

  function updateDraft(id: string, patch: Partial<BulkReviewSavePayload>) {
    setDrafts((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }

  if (reviewItems.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Review new uploads ({reviewItems.length})
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {reviewItems.map((item) => {
          const draft = drafts[item.id];
          if (!draft) return null;
          return (
            <BulkReviewCard
              key={item.id}
              fileName={item.file_name ?? item.title}
              draft={draft}
              onChange={(patch) => updateDraft(item.id, patch)}
              typeOptions={typeOptions}
              existingSections={existingSections}
              onDismiss={() => onDismiss(item.id)}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onDismissAll}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Done reviewing
        </button>
        <LoadingButton
          type="button"
          pending={saving}
          pendingText="Saving…"
          onClick={() => onSaveAll(reviewItems.map((item) => drafts[item.id]).filter(Boolean))}
        >
          Save all
        </LoadingButton>
      </div>
    </div>
  );
}

function BulkReviewCard({
  fileName,
  draft,
  onChange,
  typeOptions,
  existingSections,
  onDismiss,
}: {
  fileName: string;
  draft: BulkReviewSavePayload;
  onChange: (patch: Partial<BulkReviewSavePayload>) => void;
  typeOptions: string[];
  existingSections: string[];
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground" title={fileName}>
          {fileName}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          title="Remove from review (the item stays saved either way)"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <LabeledInput label="Title" value={draft.title} onChange={(v) => onChange({ title: v })} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-sm font-medium">Type</span>
          <Select value={draft.type} onValueChange={(v) => onChange({ type: v })}>
            <SelectTrigger className="mt-1 w-full shadow-none bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <LabeledInput
          label="Section"
          value={draft.section ?? ""}
          onChange={(v) => onChange({ section: v || null })}
          suggestions={existingSections}
        />
      </div>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </label>
      <label className="flex items-center gap-1.5 pt-1 text-sm">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) => onChange({ published: e.target.checked })}
        />
        Published
      </label>
    </div>
  );
}

function ContentManager({
  categoryId,
  categoryName,
  categorySlug,
  items,
  initialEditId,
  categoryFacilities,
  sectionOrder,
}: {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  items: ContentItem[];
  initialEditId?: string;
  categoryFacilities: string[];
  sectionOrder: string[];
}) {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const { lang } = useI18n();
  const fetchFacilitiesList = useServerFn(listFacilities);
  const deleteOldFile = useServerFn(deleteStorageFile);
  const pendingDeletesRef = useRef<string[]>([]);
  const pendingBadgeStylesRef = useRef<BadgeStyles | null>(null);
  const { data: facilitiesData } = useQuery({
    queryKey: QK.facilities,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilitiesList(),
  });
  const facilityLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of facilitiesData?.facilities ?? []) map[f.value] = f.label;
    return map;
  }, [facilitiesData]);
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const [order, setOrder] = useState<ContentItem[]>([]);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  useEffect(() => { setOrder(items); }, [items]);
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (!initialEditId || didAutoOpenRef.current) return;
    const target = items.find((it) => it.id === initialEditId);
    if (target) {
      setEditing(target);
      didAutoOpenRef.current = true;
    }
  }, [initialEditId, items]);
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [editing]);
  useEffect(() => {
    if (!pendingScrollId) return;
    if (!items.some((it) => it.id === pendingScrollId)) return;
    const t = setTimeout(() => {
      const inner = document.querySelector<HTMLElement>(`[data-item-id="${pendingScrollId}"]`);
      const el = inner?.closest("li") as HTMLElement | null ?? inner;
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "center" });
        el.classList.add("bg-[var(--color-accent)]/15", "transition-colors", "duration-700");
        setTimeout(() => el.classList.remove("bg-[var(--color-accent)]/15"), 1800);
      }
      setPendingScrollId(null);
    }, 100);
    return () => clearTimeout(t);
  }, [pendingScrollId, items]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.adminCategory(categoryId) });
    qc.invalidateQueries({ queryKey: QK.categoryBase });
    qc.invalidateQueries({ queryKey: QK.adminCategoryItems });
  };

  const saveMut = useMutation({
    mutationFn: async (values: ItemSavePayload) => {
      const { facilities, chapters, pregeneratedId, ...itemValues } = values;
      let savedId: string;
      if (itemValues.id) {
        const { id: itemId, ...rest } = itemValues;
        const { error } = await (supabase as any).from("content_items").update(rest).eq("id", itemId!);
        if (error) throw error;
        savedId = itemId!;
      } else {
        // storage_folder isn't in the generated Database types yet — (supabase as any)
        // here matches the existing pattern used for the update branch above.
        const { data, error } = await (supabase as any).from("content_items").insert({
          id: pregeneratedId,
          category_id: categoryId,
          title: itemValues.title!,
          type: itemValues.type ?? "Article",
          source: itemValues.source ?? "",
          duration: itemValues.duration ?? "",
          description: itemValues.description ?? "",
          url: itemValues.url ?? null,
          file_url: itemValues.file_url ?? null,
          file_name: itemValues.file_name ?? null,
          title_es: itemValues.title_es ?? null,
          description_es: itemValues.description_es ?? null,
          source_es: itemValues.source_es ?? null,
          file_url_es: itemValues.file_url_es ?? null,
          file_name_es: itemValues.file_name_es ?? null,
          published: itemValues.published ?? true,
          storage_folder: itemValues.storage_folder ?? null,
          stream_collection_id: itemValues.stream_collection_id ?? null,
          section: itemValues.section ?? null,
          section_es: itemValues.section_es ?? null,
          sort_order: (items.at(-1)?.sort_order ?? 0) + 1,
        }).select("id").single();
        if (error) throw error;
        savedId = data.id as string;
      }
      // Sync facility restrictions: delete existing, reinsert selected
      await (supabase as any).from("content_item_facilities").delete().eq("content_item_id", savedId);
      if (facilities && facilities.length > 0) {
        const { error: fErr } = await (supabase as any).from("content_item_facilities").insert(
          facilities.map((f: string) => ({ content_item_id: savedId, facility_value: f }))
        );
        if (fErr) throw fErr;
      }
      // Sync chapters: replace all existing rows then reinsert in order
      if (chapters !== undefined) {
        await (supabase as any).from("content_chapters").delete().eq("content_item_id", savedId);
        if (chapters.length > 0) {
          const { error: chErr } = await (supabase as any).from("content_chapters").insert(
            chapters.map((ch, i) => ({
              // Reuse the chapter's existing id (real or client-pregenerated)
              // rather than letting Postgres assign a new one on every
              // reinsert — keeps user_chapter_progress rows (FK'd to this id,
              // ON DELETE CASCADE) attached across edits instead of silently
              // wiping residents' saved listening progress, and lets a
              // late-arriving duration be patched in by id (see StreamUploader
              // onUploaded below).
              id: ch.id,
              content_item_id: savedId,
              title: ch.title,
              title_es: ch.title_es || null,
              sort_order: i + 1,
              file_url: ch.file_url,
              file_name: ch.file_name,
              file_url_es: ch.file_url_es || null,
              file_name_es: ch.file_name_es || null,
              duration_seconds: ch.duration_seconds,
              section: ch.section || null,
              section_es: ch.section_es || null,
            })),
          );
          if (chErr) throw chErr;
        }
      }
      return savedId;
    },
    onSuccess: (savedId) => {
      toast.success("Saved");
      setEditing(null);
      if (savedId) setPendingScrollId(savedId);
      // Remove stale chapter cache so the next editor open always fetches fresh data
      if (savedId) qc.removeQueries({ queryKey: ["chapters", savedId] });
      invalidate();
      qc.invalidateQueries({ queryKey: QK.contentTypes });
      const pendingStyles = pendingBadgeStylesRef.current;
      if (pendingStyles) {
        pendingBadgeStylesRef.current = null;
        supabase
          .from("site_settings")
          .upsert({ key: BADGE_STYLES_KEY, value: pendingStyles as unknown as never, updated_at: new Date().toISOString() }, { onConflict: "key" })
          .then(() => qc.invalidateQueries({ queryKey: [...badgeStylesQueryKey] }));
      }
      // Fire-and-forget cleanup of old storage files now that the new URL is
      // safely persisted. A failed delete is non-fatal — just wastes storage.
      const toDelete = pendingDeletesRef.current.splice(0);
      if (toDelete.length > 0) {
        Promise.all(toDelete.map((url) => deleteOldFile({ data: { url } }))).catch(() => {});
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async (item: ContentItem) => {
      const { error } = await supabase
        .from("content_items")
        .update({ published: !item.published })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulk = useBulkSelect();
  const [addingBulkSection, setAddingBulkSection] = useState(false);
  const [newBulkSection, setNewBulkSection] = useState("");
  const { data: existingTypes = [] } = useQuery({
    queryKey: QK.contentTypes,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_types")
        .select("value")
        .order("value");
      if (error) throw error;
      return (data ?? []).map((r: { value: string }) => r.value);
    },
  });
  const bulkTypeOptions = [...existingTypes].sort((a, b) => a.localeCompare(b));
  const existingSections = Array.from(
    new Set(items.map((i) => i.section).filter((s): s is string => !!s?.trim())),
  ).sort((a, b) => a.localeCompare(b));
  // Bulk file->item upload: each selected file becomes its own unpublished
  // content_items row, then shows up as a review card below until the admin
  // fills in details and publishes. bulkReviewIds tracks which ids (from
  // this session's bulk uploads) still have a review card showing.
  const [bulkType, setBulkType] = useState("Article");
  const [bulkReviewIds, setBulkReviewIds] = useState<string[]>([]);
  const bulkUploadInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deleteManyMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("content_items").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (deleted) => {
      toast.success(`Deleted ${deleted} ${deleted === 1 ? "item" : "items"}`);
      invalidate();
      bulk.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTypeMut = useMutation({
    mutationFn: async ({ ids, type }: { ids: string[]; type: string }) => {
      const { error } = await supabase.from("content_items").update({ type }).in("id", ids);
      if (error) throw error;
      return { count: ids.length, type };
    },
    onSuccess: ({ count, type }) => {
      toast.success(`Updated ${count} ${count === 1 ? "item" : "items"} to ${type}`);
      invalidate();
      bulk.clear();
      bulk.exitEditMode();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSectionMut = useMutation({
    mutationFn: async ({ ids, section }: { ids: string[]; section: string | null }) => {
      const { error } = await (supabase as any)
        .from("content_items")
        .update({ section })
        .in("id", ids);
      if (error) throw error;
      return { count: ids.length, section };
    },
    onSuccess: ({ count, section }) => {
      toast.success(
        `Updated ${count} ${count === 1 ? "item" : "items"} to ${section || "Uncategorized"}`,
      );
      invalidate();
      bulk.clear();
      bulk.exitEditMode();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: async (next: ContentItem[]) => {
      await Promise.all(
        next.map((it, i) =>
          supabase.from("content_items").update({ sort_order: i + 1 }).eq("id", it.id),
        ),
      );
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  // Each file uploads (Bunny Storage, same as a single-item FileUploader)
  // and becomes its own unpublished content_items row — no per-file session/
  // transcode wait like the Stream chapter uploader, so every file can run
  // fully in parallel; failures are isolated per file via allSettled.
  const bulkCreateMut = useMutation({
    mutationFn: async ({ files, type }: { files: File[]; type: string }) => {
      let nextSortOrder = (items.at(-1)?.sort_order ?? 0) + 1;
      const results = await Promise.allSettled(
        files.map(async (file) => {
          // .map()'s callback runs synchronously per file before any await,
          // so this assigns sort_order in file order even though the async
          // bodies themselves resolve concurrently.
          const sortOrder = nextSortOrder++;
          const id = crypto.randomUUID();
          const title = filenameToTitle(file.name);
          const folder = `${slugify(title) || "untitled"}-${id.slice(0, 8)}`;
          const { publicUrl } = await uploadFile({
            file,
            kind: "content-file",
            categorySlug,
            itemFolder: folder,
            language: "english",
          });
          const { error } = await (supabase as any).from("content_items").insert({
            id,
            category_id: categoryId,
            title,
            type,
            source: "",
            duration: "",
            description: "",
            url: publicUrl,
            published: false,
            storage_folder: folder,
            sort_order: sortOrder,
          });
          if (error) throw error;
          return id as string;
        }),
      );
      return {
        createdIds: results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
          .map((r) => r.value),
        failedCount: results.filter((r) => r.status === "rejected").length,
      };
    },
    onSuccess: ({ createdIds, failedCount }) => {
      if (createdIds.length > 0) {
        toast.success(
          `Created ${createdIds.length} ${createdIds.length === 1 ? "item" : "items"} — review below`,
        );
        setBulkReviewIds((prev) => [...prev, ...createdIds]);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} file${failedCount === 1 ? "" : "s"} failed to upload`);
      }
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Bulk upload failed"),
  });

  // Deliberately separate from saveMut — that mutation's onSuccess sets
  // pendingScrollId, which scrolls the page down to and highlights the
  // saved row (right, for a single-item edit; wrong here, since saving N
  // review cards at once shouldn't yank the page down to wherever the last
  // one happens to sit in the list). One summary toast instead of N.
  const saveAllReviewMut = useMutation({
    mutationFn: async (payloads: BulkReviewSavePayload[]) => {
      const results = await Promise.allSettled(
        payloads.map(async (d) => {
          const { error } = await (supabase as any)
            .from("content_items")
            .update({
              title: d.title.trim() || d.title,
              type: d.type,
              section: d.section,
              section_es: d.section_es,
              description: d.description,
              published: d.published,
            })
            .eq("id", d.id);
          if (error) throw error;
        }),
      );
      return {
        savedCount: results.filter((r) => r.status === "fulfilled").length,
        failedCount: results.filter((r) => r.status === "rejected").length,
      };
    },
    onSuccess: ({ savedCount, failedCount }) => {
      if (savedCount > 0) {
        toast.success(`Saved ${savedCount} ${savedCount === 1 ? "item" : "items"}`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} item${failedCount === 1 ? "" : "s"} failed to save`);
      }
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Content <span className="text-muted-foreground font-normal">({order.length})</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={bulkType} onValueChange={setBulkType}>
            <SelectTrigger
              className="w-[140px] shadow-none bg-background"
              title="Type applied to bulk-uploaded files"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bulkTypeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={bulkUploadInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                bulkCreateMut.mutate({ files: Array.from(e.target.files), type: bulkType });
              }
              if (bulkUploadInputRef.current) bulkUploadInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            disabled={bulkCreateMut.isPending}
            onClick={() => bulkUploadInputRef.current?.click()}
            title="Each file becomes its own content item (documents/images only)"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {bulkCreateMut.isPending ? "Uploading…" : "Bulk upload"}
          </button>
          <button
            onClick={() => setEditing("new")}
            disabled={editing === "new"}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            <Plus className="h-4 w-4" /> New item
          </button>
        </div>
      </div>

      <SectionsPanel categoryId={categoryId} items={items} sectionOrder={sectionOrder} onReordered={invalidate} />

      <BulkReviewPanel
        ids={bulkReviewIds}
        items={items}
        typeOptions={bulkTypeOptions}
        existingSections={existingSections}
        saving={saveAllReviewMut.isPending}
        onSaveAll={(payloads) => saveAllReviewMut.mutate(payloads)}
        onDismiss={(id) => setBulkReviewIds((prev) => prev.filter((x) => x !== id))}
        onDismissAll={() => setBulkReviewIds([])}
      />

      {editing && (
        <div ref={editorRef} className="scroll-mt-24">
          <ItemEditor
            item={editing === "new" ? null : editing}
            categoryId={categoryId}
            categoryName={categoryName}
            categorySlug={categorySlug}
            onCancel={() => setEditing(null)}
            onSave={(v) => saveMut.mutate(v as ItemSavePayload)}
            busy={saveMut.isPending}
            categoryFacilities={categoryFacilities}
            existingSections={existingSections}
            onPendingDelete={(url) => { pendingDeletesRef.current.push(url); }}
            onNewTypeBadgeStyle={(styles) => { pendingBadgeStylesRef.current = styles; }}
          />
        </div>
      )}

      {(() => {
        const q = searchQuery.trim().toLowerCase();
        const filteredOrder = q
          ? order.filter((i) =>
              [i.title, i.description, i.source, i.type]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q)),
            )
          : order;
        return (
          <>
      {order.length > 0 && (
        <BulkActionBar
          bulk={bulk}
          filteredCount={filteredOrder.length}
          totalCount={order.length}
          isFiltered={Boolean(q)}
          noun={{ singular: "item", plural: "items" }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search content…"
          emptyEditHint="Click items to select for deletion"
          allIds={filteredOrder.map((i) => i.id)}
          onEnterEditMode={() => setEditing(null)}
          onDeleteSelected={async (ids) =>
            confirmDelete({
              title: `Delete ${ids.length} ${ids.length === 1 ? "item" : "items"}?`,
              description: `Permanently delete ${ids.length === 1 ? "the selected item" : `${ids.length} selected items`}?`,
              onConfirm: () => deleteManyMut.mutateAsync(ids),
            })
          }
          extraSelectionActions={(ids) => (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <LoadingButton
                    variant="secondary"
                    pending={updateTypeMut.isPending}
                    pendingText="Updating…"
                    icon={<Tag className="h-4 w-4" />}
                  >
                    Change type ({ids.length})
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </LoadingButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={16} className="max-h-[80vh]">
                  {bulkTypeOptions.map((t) => (
                    <DropdownMenuItem
                      key={t}
                      onSelect={() => updateTypeMut.mutate({ ids, type: t })}
                    >
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu
                onOpenChange={(open) => {
                  if (!open) {
                    setAddingBulkSection(false);
                    setNewBulkSection("");
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <LoadingButton
                    variant="secondary"
                    pending={updateSectionMut.isPending}
                    pendingText="Updating…"
                    icon={<FolderOpen className="h-4 w-4" />}
                  >
                    Change section ({ids.length})
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </LoadingButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={16} className="max-h-[80vh]">
                  {addingBulkSection ? (
                    <div className="flex items-center gap-2 p-1.5">
                      <input
                        autoFocus
                        value={newBulkSection}
                        onChange={(e) => setNewBulkSection(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = newBulkSection.trim();
                            if (!v) return;
                            updateSectionMut.mutate({ ids, section: v });
                            setAddingBulkSection(false);
                            setNewBulkSection("");
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setAddingBulkSection(false);
                            setNewBulkSection("");
                          }
                        }}
                        placeholder="New section name"
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const v = newBulkSection.trim();
                          if (!v) return;
                          updateSectionMut.mutate({ ids, section: v });
                          setAddingBulkSection(false);
                          setNewBulkSection("");
                        }}
                        className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => updateSectionMut.mutate({ ids, section: null })}>
                        Uncategorized
                      </DropdownMenuItem>
                      {existingSections.length > 0 && <DropdownMenuSeparator />}
                      {existingSections.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onSelect={() => updateSectionMut.mutate({ ids, section: s })}
                        >
                          {s}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAddingBulkSection(true); }}>
                        + New section…
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        />
      )}

      <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${order.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
        {(() => {
          const renderItemRow = (item: ContentItem) => {
            const isEditingThis = editing !== null && editing !== "new" && editing.id === item.id;
            const isDimmed = editing !== null && !isEditingThis;
            return (
              <div data-item-id={item.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-6 pl-3 pb-6 sm:pb-5 transition-opacity ${isDimmed ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  {(() => {
                    const s = itemTranslationStatus(item);
                    const trLabel = s === "missing" ? "Needs ES" : "Partially translated";
                    const trTitle = s === "missing" ? "Missing Spanish translation" : "Some Spanish fields are missing";
                    return (
                      <BadgeGroup trailing={item.duration ? translateDuration(lang, withActionWord(item.duration, item.type)) : undefined}>
                        <Badge variant="type" type={item.type} className="rounded-[8px]">{item.type}</Badge>
                        {!item.published && <Badge variant="draft" className="rounded-[8px]">Draft</Badge>}
                        {item.exempt_from_progress && <Badge variant="exempt" className="rounded-[8px]">Exempt</Badge>}
                        {s !== "complete" && (
                          <Badge variant="translation" className="rounded-[8px]" title={trTitle}>
                            {trLabel}
                          </Badge>
                        )}
                        {(item.facilities?.length ?? 0) > 0 && (
                          <FacilityBadge
                            facilities={item.facilities!}
                            facilityLabelMap={facilityLabelMap}
                            className="rounded-[8px]"
                          />
                        )}
                      </BadgeGroup>
                    );
                  })()}
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-foreground leading-snug truncate">{item.title}</h3>
                    {item.description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>}
                    {item.source && <p className="mt-2 text-xs text-muted-foreground/80">Source · {item.source}</p>}
                  </div>
                </div>
                <TooltipProvider delayDuration={150}>
                  <div className="flex items-center shrink-0 self-end sm:self-auto gap-1.5">
                    {/* Left connected group */}
                    <div className="flex items-center [&>*:not(:first-child)]:-ml-px [&>:first-child]:rounded-r-none [&>:not(:first-child):not(:last-child)]:rounded-none [&>:last-child]:rounded-l-none">
                      <IconButton
                        aria-label={item.published ? "Unpublish" : "Publish"}
                        tooltip={item.published ? "Unpublish" : "Publish"}
                        icon={item.published ? Eye : EyeOff}
                        pending={togglePublish.isPending && (togglePublish.variables as any)?.id === item.id}
                        onClick={() => togglePublish.mutate(item)}
                      />
                      <TooltipWrap tooltip="View on site">
                        <Link
                          to="/category/$slug"
                          params={{ slug: categorySlug }}
                          hash={`item-${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View on site"
                          className={iconButtonClassName()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </TooltipWrap>
                      <IconButton
                        aria-label="Edit"
                        tooltip="Edit"
                        icon={Pencil}
                        onClick={() => setEditing(item)}
                      />
                    </div>
                    <div className="mx-1 h-6 w-px bg-border" aria-hidden />
                    <IconButton
                      aria-label="Delete"
                      tooltip="Delete"
                      pendingTooltip="Deleting…"
                      variant="destructive"
                      icon={Trash2}
                      pending={isMutationPendingFor(deleteMut, item.id)}
                      onClick={async () => {
                        await confirmDelete({
                          title: `Delete "${item.title}"?`,
                          description: "This content will be permanently removed.",
                          onConfirm: () => deleteMut.mutateAsync(item.id),
                        });
                      }}
                    />
                  </div>
                </TooltipProvider>
              </div>
            );
          };

          if (order.length === 0) {
            return <EmptyState>No items yet.</EmptyState>;
          }
          if (filteredOrder.length === 0) {
            return <EmptyState>No items match your search.</EmptyState>;
          }
          if (bulk.editMode || q) {
            return (
              <ul className="divide-y divide-border">
                {filteredOrder.map((item) => {
                  const selected = bulk.has(item.id);
                  const isInteractive = bulk.editMode;
                  return (
                    <li
                      key={item.id}
                      onClick={isInteractive ? () => bulk.toggle(item.id) : undefined}
                      className={`flex items-stretch transition-colors ${
                        isInteractive ? "cursor-pointer " : ""
                      }${
                        selected ? "bg-destructive/10 hover:bg-destructive/15" : isInteractive ? "hover:bg-muted/50" : ""
                      }`}
                    >
                      {(bulk.editMode || q) && (
                        <div
                          className={`flex items-center pl-5 pr-0 ${bulk.editMode ? "text-muted-foreground/50" : "text-muted-foreground/30 cursor-not-allowed"}`}
                          aria-disabled={!bulk.editMode}
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      )}

                      <div className={`flex-1 min-w-0 ${bulk.editMode ? "pointer-events-none" : ""}`}>{renderItemRow(item)}</div>
                    </li>
                  );
                })}
              </ul>
            );
          }
          return (
            <Suspense fallback={null}>
              <SortableList
                className="divide-y divide-border"
                dragHandleClassName="pl-5"
                items={order}
                onReorder={(next) => { setOrder(next as ContentItem[]); reorderMut.mutate(next as ContentItem[]); }}
                renderItem={(item) => renderItemRow(item as ContentItem)}
              />
            </Suspense>

          );
        })()}
      </div>
          </>
        );
      })()}
    </section>
  );
}

type ChapterDraft = {
  id?: string;
  title: string;
  title_es: string;
  file_url: string | null;
  file_name: string | null;
  file_url_es: string | null;
  file_name_es: string | null;
  duration_seconds: number | null;
  section: string;
  section_es: string;
};

// pregeneratedId: only set for new items — the id chosen client-side up front
// so uploaded files' storage folder matches the row's eventual id (see itemId
// below). Kept separate from `id` (which stays undefined for new items) so
// saveMut's insert-vs-update branch is unaffected.
type ItemSavePayload = Partial<ContentItem> & {
  id?: string;
  pregeneratedId?: string;
  chapters?: ChapterDraft[];
};

function ItemEditor({
  item,
  categoryId,
  categoryName,
  categorySlug,
  onCancel,
  onSave,
  busy,
  categoryFacilities,
  existingSections,
  onPendingDelete,
  onNewTypeBadgeStyle,
}: {
  item: ContentItem | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  onCancel: () => void;
  onSave: (v: ItemSavePayload) => void;
  busy: boolean;
  categoryFacilities: string[];
  /** Distinct section names already used elsewhere in this category, for
   * the Section field's autocomplete — unrelated to content types. */
  existingSections: string[];
  onPendingDelete: (url: string) => void;
  onNewTypeBadgeStyle?: (styles: BadgeStyles) => void;
}) {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const badgeStyles = useBadgeStyles();
  const facilityPs = paletteStyle(badgeStyles.variants["facility"] ?? 11);
  const { data: categoryColors = [] } = useQuery({
    queryKey: QK.adminIconsBadgesCategories,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, icon_color");
      if (error) throw error;
      return (data ?? []) as { id: string; icon_color: string | null }[];
    },
  });
  const fetchFacilitiesList = useServerFn(listFacilities);
  const { data: facilitiesData } = useQuery({
    queryKey: QK.facilitiesList,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilitiesList(),
  });
  const availableFacilities = facilitiesData?.facilities ?? [];
  const { data: sourceSuggestions = [] } = useQuery({
    queryKey: QK.adminContentSources,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("content_items")
        .select("source")
        .not("source", "is", null)
        .limit(1000);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of (data ?? []) as { source: string | null }[]) {
        const s = (row.source ?? "").trim();
        if (s) set.add(s);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
  });
  const [title, setTitle] = useState(item?.title ?? "");
  // Stable identity for this item's Bunny storage folder (uploads/{categorySlug}/{itemFolder}/...).
  // itemId is generated once for a NEW item (no id yet) and reused as the
  // row's actual id on save. itemFolder is derived live from the current
  // title for new/not-yet-organized items — so an upload uses whatever's
  // been typed by then, not whatever the title was when the editor opened —
  // but always uses the persisted storage_folder for an item that already
  // has one, so a later title edit doesn't move already-uploaded files into
  // a new folder.
  const [itemId] = useState(() => item?.id ?? crypto.randomUUID());
  const itemFolder =
    item?.storage_folder || `${slugify(title) || "untitled"}-${itemId.slice(0, 8)}`;
  // Bunny Stream collection grouping this item's video/audio uploads (main
  // file + all chapters). Created lazily on the first Stream upload of an
  // editing session, then reused for every subsequent one and persisted on save.
  const [streamCollectionId, setStreamCollectionId] = useState<string | null>(
    item?.stream_collection_id ?? null,
  );
  // Chapter indices currently mid-upload/processing via the batch uploader
  // below, keyed to the same phase/progress shape StreamUploader's own
  // internal state uses — passed back into that row's uploader as
  // externalUpload so a batch upload shows through the exact same busy
  // button UI as a manual single-file upload, instead of a separate
  // indicator.
  const [chapterUploadState, setChapterUploadState] = useState<
    Map<number, { phase: "uploading" | "processing"; progress: number }>
  >(new Map());
  const setChapterUpload = (
    idx: number,
    value: { phase: "uploading" | "processing"; progress: number } | null,
  ) =>
    setChapterUploadState((prev) => {
      const next = new Map(prev);
      if (value) next.set(idx, value);
      else next.delete(idx);
      return next;
    });
  const [type, setType] = useState(item?.type ?? "Article");
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState("");
  // Independent of `type` — which shelf this item sits on, not what kind of
  // content it is. Empty means "uncategorized" on the category page.
  const [section, setSection] = useState(item?.section ?? "");
  const [sectionEs, setSectionEs] = useState(item?.section_es ?? "");
  const [source, setSource] = useState(item?.source ?? "");
  const [duration, setDuration] = useState(item?.duration ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [published, setPublished] = useState(item?.published ?? true);
  const [exemptFromProgress, setExemptFromProgress] = useState(item?.exempt_from_progress ?? false);
  const [facilities, setFacilities] = useState<string[]>(item?.facilities ?? []);
  const [titleEs, setTitleEs] = useState(item?.title_es ?? "");
  const [descriptionEs, setDescriptionEs] = useState(item?.description_es ?? "");
  const [sourceEs, setSourceEs] = useState(item?.source_es ?? item?.source ?? "");
  
  const [fileUrlEs, setFileUrlEs] = useState<string | null>(item?.file_url_es ?? null);
  const [fileNameEs, setFileNameEs] = useState<string | null>(item?.file_name_es ?? null);
  const [showEs, setShowEs] = useState(
    !!(item?.title_es || item?.description_es || item?.source_es || item?.file_url_es),
  );
  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();
  const { run: runChapterTitleEs, busy: chapterTitleEsBusy } = useTranslateToSpanish();
  const [translatingChapterIdx, setTranslatingChapterIdx] = useState<number | null>(null);

  // Chapters — only relevant for audio/podcast types
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  // A newly added chapter defaults to the last existing chapter's section —
  // adding one more chapter to a section-in-progress is the common case, so
  // this avoids re-typing/re-selecting the label every time.
  function lastChapterSection(list: ChapterDraft[]): { section: string; section_es: string } {
    const last = list[list.length - 1];
    return { section: last?.section ?? "", section_es: last?.section_es ?? "" };
  }
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const [multiUploading, setMultiUploading] = useState(false);
  const multiUploadInputRef = useRef<HTMLInputElement>(null);
  const { data: existingChapters } = useQuery({
    queryKey: ["chapters", item?.id ?? null],
    enabled: !!item?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_chapters")
        .select("*")
        .eq("content_item_id", item!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentChapter[];
    },
  });
  // Initialise chapter state once the DB data arrives (only on first load)
  const chaptersInitialised = useRef(false);
  useEffect(() => {
    if (!existingChapters || chaptersInitialised.current) return;
    chaptersInitialised.current = true;
    setChapters(
      existingChapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        title_es: ch.title_es ?? "",
        file_url: ch.file_url,
        file_name: ch.file_name,
        file_url_es: ch.file_url_es,
        file_name_es: ch.file_name_es,
        duration_seconds: ch.duration_seconds,
        section: ch.section ?? "",
        section_es: ch.section_es ?? "",
      })),
    );
  }, [existingChapters]);

  const generateDesc = useServerFn(generateContentDescription);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [pdfEstimating, setPdfEstimating] = useState(false);

  // Auto-recalculate duration when the PDF URL changes (after initial mount).
  const initialPdfUrlRef = useRef(item?.url ?? "");
  useEffect(() => {
    const u = url.trim();
    if (!u || extOf(u, null) !== "pdf") return;
    if (u === initialPdfUrlRef.current) return;
    initialPdfUrlRef.current = u;
    let cancelled = false;
    setPdfEstimating(true);
    (async () => {
      try {
        const estimated = await estimateDuration(u, null, type);
        if (!cancelled && estimated) setDuration(estimated);
      } finally {
        if (!cancelled) setPdfEstimating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url, type]);

  // Auto-recalculate duration when the content type changes (after initial mount).
  const initialTypeRef = useRef(item?.type ?? "Article");
  useEffect(() => {
    if (type === initialTypeRef.current) return;
    initialTypeRef.current = type;
    let cancelled = false;
    (async () => {
      const u = url.trim();
      const ext = u ? extOf(u, null) : null;
      const isMedia = ext && (ext === "pdf" || AUDIO_EXT.has(ext) || VIDEO_EXT.has(ext));
      if (isMedia) {
        if (ext === "pdf") setPdfEstimating(true);
        try {
          const estimated = await estimateDuration(u, null, type);
          if (!cancelled && estimated) setDuration(estimated);
        } finally {
          if (!cancelled && ext === "pdf") setPdfEstimating(false);
        }
      } else {
        const fallback = defaultDurationForType(type);
        if (!cancelled && fallback) setDuration(fallback);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, url]);

  const isAudioType =
    type.toLowerCase().includes("audio") || type.toLowerCase().includes("podcast");
  const isVideoType = type.toLowerCase().includes("video");

  async function handleMultipleFiles(files: FileList) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    // Read directly from the current render's chapters array rather than
    // inside the setChapters updater — a plain, unambiguous snapshot instead
    // of relying on a side effect inside the updater to hand back the right
    // index.
    const baseIdx = chapters.length;
    setMultiUploading(true);
    setChaptersOpen(true);
    const inheritedSection = lastChapterSection(chapters);
    const drafts: ChapterDraft[] = arr.map((f) => ({
      // Generated up front (not left for the DB to assign on first save) so
      // a chapter has a stable id even before the item is ever saved — lets
      // a late-arriving duration (see the Phase 2 loop below) be patched
      // straight into the DB by id, not just into local state.
      id: crypto.randomUUID(),
      title: filenameToTitle(f.name),
      title_es: "",
      file_url: null,
      file_name: null,
      file_url_es: null,
      file_name_es: null,
      duration_seconds: null,
      ...inheritedSection,
    }));
    setChapters((prev) => [...prev, ...drafts]);

    // Phase 1 — create every Stream session up front, sequentially. Each
    // call is a small JSON round trip (no file bytes), so this is fast, and
    // it means only the very first call can ever need to lazily create the
    // shared collection — every later call already has its id, instead of
    // every file racing to create its own duplicate. The URL for each file
    // is known as soon as its session exists, so every new chapter row gets
    // its (not-yet-playable) URL filled in within a couple seconds of
    // selecting files, not just the first one.
    let collectionId = streamCollectionId;
    const sessions: Array<{
      file: File;
      chIdx: number;
      chapterId: string;
      session: Awaited<ReturnType<typeof beginStreamUpload>>;
    } | null> = [];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const chIdx = baseIdx + i;
      try {
        const session = await beginStreamUpload({
          title: `${title || "Untitled"} — ${filenameToTitle(file.name)}`,
          collectionId,
          collectionName: title || "Untitled",
          onCollectionCreated: (id) => {
            collectionId = id;
            setStreamCollectionId(id);
          },
        });
        setChapters((prev) =>
          prev.map((c, idx) =>
            idx === chIdx ? { ...c, file_url: session.playbackUrl, file_name: file.name } : c,
          ),
        );
        sessions.push({ file, chIdx, chapterId: drafts[i].id!, session });
      } catch (err: any) {
        console.error(`[handleMultipleFiles] failed to start "${file.name}":`, err);
        toast.error(`Failed to start upload for "${file.name}": ${err.message ?? "Upload failed"}`);
        sessions.push(null);
      }
    }

    // Phase 2 — the slow part (byte transfer + transcode wait, which can
    // each take from seconds to minutes) runs for every file in parallel
    // instead of making chapter 2 wait for chapter 1 to fully finish
    // processing before it even starts.
    await Promise.all(
      sessions.map(async (entry) => {
        if (!entry) return;
        const { file, chIdx, chapterId, session } = entry;
        setChapterUpload(chIdx, { phase: "uploading", progress: 0 });
        try {
          const { videoId, playbackUrl } = await runTusUpload(file, session, (pct) =>
            setChapterUpload(chIdx, { phase: "uploading", progress: pct }),
          );
          setChapterUpload(chIdx, { phase: "processing", progress: 0 });
          const seconds = await waitForStreamProcessing(videoId);
          setChapters((prev) =>
            prev.map((c, idx) =>
              idx === chIdx
                ? {
                    ...c,
                    file_url: playbackUrl,
                    file_name: file.name,
                    duration_seconds: seconds && seconds > 0 ? seconds : null,
                  }
                : c,
            ),
          );
          // Same reasoning as the single-chapter uploader: Save doesn't wait
          // on processing, so patch the duration straight into the DB by id
          // in case the item was already saved while this file was still
          // transcoding — a no-op if it hasn't been saved yet.
          if (seconds && seconds > 0) {
            const { error } = await (supabase as any)
              .from("content_chapters")
              .update({ duration_seconds: seconds })
              .eq("id", chapterId);
            if (error) console.error("Failed to patch chapter duration:", error);
          }
        } catch (err: any) {
          console.error(`[handleMultipleFiles] "${file.name}" failed:`, err);
          toast.error(`Failed to upload "${file.name}": ${err.message ?? "Upload failed"}`);
        } finally {
          setChapterUpload(chIdx, null);
        }
      }),
    );

    setMultiUploading(false);
    if (multiUploadInputRef.current) multiUploadInputRef.current.value = "";
  }

  // When chapters have known durations, auto-sum them into the duration field
  useEffect(() => {
    if (!isAudioType || chapters.length === 0) return;
    const total = chapters.reduce((s, ch) => s + (ch.duration_seconds ?? 0), 0);
    if (total > 0) setDuration(withActionWord(formatMediaDuration(total), type));
  }, [chapters, isAudioType, type]);

  async function handleAutoGenerateDesc() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a title first");
      return;
    }
    setGeneratingDesc(true);
    try {
      const result = await generateDesc({ data: { title: trimmed, type, categoryName } });
      if (result.description) setDescription(result.description);
      toast.success("Generated description");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate");
    } finally {
      setGeneratingDesc(false);
    }
  }

  const { data: existingTypes = [] } = useQuery({
    queryKey: QK.contentTypes,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_types")
        .select("value")
        .order("value");
      if (error) throw error;
      return (data ?? []).map((r: { value: string }) => r.value);
    },
  });

  // Include the current item's type even if it's not in the list yet
  // (e.g. a just-added type before the cache refreshes).
  const typeOptions = Array.from(new Set([...existingTypes, type].filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));

  const commitNewType = () => {
    const v = newType.trim();
    if (!v) return;
    const key = v.toLowerCase();
    setType(v);
    setAddingType(false);
    setNewType("");
    // Optimistically add to cache, then persist to DB and confirm
    qc.setQueryData<string[]>(QK.contentTypes as unknown as string[], (old = []) =>
      Array.from(new Set([...old, v]))
    );
    supabase.from("content_types" as any).insert({ value: v }).then(() => {
      qc.invalidateQueries({ queryKey: QK.contentTypes });
    });
    // Assign a unique palette color using all currently-in-use indices across
    // variants, all types, and category icon colors.
    const currentStyles = qc.getQueryData<BadgeStyles>(badgeStylesQueryKey) ?? DEFAULT_BADGE_STYLES;
    if ((currentStyles.types as Record<string, number>)[key] !== undefined) return;
    const used = new Set<number>();
    for (const k of BADGE_VARIANTS) {
      const idx = currentStyles.variants[k];
      if (idx !== undefined) used.add(idx);
    }
    for (const idx of Object.values(currentStyles.types as Record<string, number>)) {
      if (idx !== undefined) used.add(idx);
    }
    for (const cat of categoryColors) {
      const idx = paletteIndexOfColor(cat.icon_color);
      if (idx >= 0) used.add(idx);
    }
    const newIdx = nextUnusedIndex(0, used);
    const updatedStyles: BadgeStyles = {
      ...currentStyles,
      types: { ...currentStyles.types, [key]: newIdx } as any,
    };
    qc.setQueryData(badgeStylesQueryKey, updatedStyles);
    // Save badge styles to DB immediately so any other page (e.g. icons & badges)
    // reads the correct color without assigning a conflicting one.
    (supabase as any).from("site_settings").upsert(
      { key: BADGE_STYLES_KEY, value: updatedStyles as unknown as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    ).then(() => qc.invalidateQueries({ queryKey: [...badgeStylesQueryKey] }));
    onNewTypeBadgeStyle?.(updatedStyles);
  };

  const cancelNewType = () => {
    setAddingType(false);
    setNewType("");
  };

  const deleteType = async (t: string) => {
    // Get confirmation without onConfirm — if we put the work inside onConfirm
    // the dialog's catch block swallows errors silently.
    const confirmed = await confirmDelete({
      title: `Delete type "${t}"?`,
      description: `Any items using this type will be changed to "Article".`,
    });
    if (!confirmed) return;

    // RPC reassigns all items of this type to "Article" AND deletes the
    // type from content_types — both in one SECURITY DEFINER call.
    const { error: rpcError } = await (supabase as any)
      .rpc("reassign_content_type", { old_type: t });
    if (rpcError) {
      toast.error(rpcError.message);
      return;
    }

    if (type === t) setType("Article");
    toast.success(`Deleted type "${t}"`);
    qc.setQueryData<string[]>(QK.contentTypes as unknown as string[], (old = []) => old.filter((x) => x !== t));
    qc.setQueryData(QK.adminCategory(categoryId), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        items: (old.items ?? []).map((i: any) => i.type === t ? { ...i, type: "Article" } : i),
      };
    });
    qc.invalidateQueries({ queryKey: QK.contentTypes });
    qc.invalidateQueries({ queryKey: QK.adminCategoryBase });
    qc.invalidateQueries({ queryKey: QK.categoryBase });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: item?.id,
          pregeneratedId: item ? undefined : itemId,
          storage_folder: itemFolder,
          stream_collection_id: streamCollectionId,
          title: title.trim(),
          type,
          source: source.trim(),
          duration: duration.trim(),
          description: description.trim(),
          url: url.trim() || null,
          file_url: null,
          file_name: null,
          published,
          exempt_from_progress: exemptFromProgress,
          facilities,
          title_es: titleEs.trim() || null,
          description_es: descriptionEs.trim() || null,
          source_es: sourceEs.trim() || null,
          file_url_es: fileUrlEs,
          file_name_es: fileNameEs,
          section: section.trim() || null,
          section_es: sectionEs.trim() || null,
          chapters: isAudioType ? chapters : undefined,
        });
      }}
      className="mt-6 mb-8 rounded-2xl border border-border bg-card p-6 pt-[18px] space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{item ? "Edit item" : "New item"}</h3>
        <button type="button" onClick={onCancel} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <LabeledInput label="Title" value={title} onChange={setTitle} required />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="block">
          <span className="text-sm font-medium">Type</span>
          {addingType ? (
            <div className="mt-1 flex gap-2">
              <input
                autoFocus
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitNewType(); }
                  if (e.key === "Escape") { cancelNewType(); }
                }}
                onBlur={cancelNewType}
                placeholder="New type name"
                className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitNewType}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add
              </button>
            </div>
          ) : (
            <Select
              value={type}
              onValueChange={(v) => {
                if (v === "__new__") setAddingType(true);
                else setType(v);
              }}
            >
              <SelectTrigger className="mt-1 w-full shadow-none bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">{t}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        title={`Delete type "${t}"`}
                        // Radix Select treats the whole item as the "select"
                        // target, so this needs to stop the event before it
                        // bubbles to the item's own select handling — both on
                        // pointerdown (which Radix uses to start selection)
                        // and click (where the actual delete happens).
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          deleteType(t);
                        }}
                        className="shrink-0 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ Add new type…</SelectItem>
              </SelectContent>
            </Select>
          )}
        </label>
        <LabeledInput label="Source" value={source} onChange={setSource} suggestions={sourceSuggestions} />
        <label className="block">
          <span className="text-sm font-medium">Duration</span>
          <div className="relative mt-1">
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="8 min read"
              className={`w-full rounded-md border border-input bg-background px-4 py-2 text-sm ${extOf(url, null) === "pdf" ? "pr-9" : ""}`}
            />
            {extOf(url, null) === "pdf" && (
              <button
                type="button"
                disabled={pdfEstimating}
                onClick={async () => {
                  setPdfEstimating(true);
                  try {
                    const estimated = await estimateDuration(url, null, type);
                    if (estimated) setDuration(estimated);
                  } finally {
                    setPdfEstimating(false);
                  }
                }}
                title={pdfEstimating ? "Calculating PDF duration…" : "Recalculate PDF duration"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${pdfEstimating ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </label>
        <div className={categoryFacilities.length > 0 ? "opacity-40 pointer-events-none select-none" : ""}>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            Facility
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground rounded-sm focus:outline-none">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs">
                  {categoryFacilities.length > 0
                    ? "This category is already assigned to a facility. Item-level facility restrictions are not needed."
                    : "Restrict this item to specific facilities. Only users whose profile matches a selected facility will see it. Leave empty to show to everyone."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
          <div className="mt-1">
            <FacilityCombobox
              value=""
              onChange={(v) => {
                if (v && !facilities.includes(v)) {
                  setFacilities((prev) => [...prev, v]);
                }
              }}
              options={availableFacilities.filter((a) => !facilities.includes(a.value))}
              placeholder="Add facility…"
              searchPlaceholder="Search facilities…"
              emptyMessage={availableFacilities.length === 0 ? "No facilities found." : "All facilities selected."}
            />
          </div>
          {facilities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {facilities.map((f) => {
                const label = availableFacilities.find((a) => a.value === f)?.label ?? f;
                return (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 leading-none rounded-[8px] border px-2.5 py-[5px] text-xs font-medium flex-shrink-0"
                    style={{ color: facilityPs.color, backgroundColor: facilityPs.bg, borderColor: facilityPs.border }}
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => setFacilities((prev) => prev.filter((x) => x !== f))}
                      className="rounded-[2px] p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <LabeledInput
          label="Section"
          value={section}
          onChange={setSection}
          suggestions={existingSections}
          placeholder="e.g. eBooks, Audiobooks"
          description="Which shelf this shows under on the category page — unrelated to Type. Leave blank to leave it uncategorized."
        />
      </div>
      {/* Hidden once the item has chapters — a chaptered audio item plays
          through its chapter files, so a top-level URL alongside them is
          redundant and confusing, not an alternative source. */}
      {!(isAudioType && chapters.length > 0) && (
        <label className="block">
          <span className="text-sm font-medium">URL (optional)</span>
          {(() => {
            const urlInput = (
              <input
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={async (e) => {
                  const v = e.target.value.trim();
                  if (!v) return;
                  const kind = mediaKindFor(type, v, null);
                  if (kind) {
                    const seconds = await probeMediaDuration(v, kind);
                    const formatted = formatMediaDuration(seconds);
                    if (formatted) setDuration(formatted);
                    else {
                      const fallback = defaultDurationForType(type);
                      if (fallback) setDuration(fallback);
                    }
                    return;
                  }
                  const estimated = await estimateDuration(v, null, type);
                  if (estimated) setDuration(estimated);
                }}
                className="mt-0 min-w-0 flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            );
            // Video/audio types go through Bunny Stream (adaptive HLS); everything
            // else (PDF, image, article, etc.) keeps using the Storage flow.
            return isAudioType || isVideoType ? (
              <StreamUploader
                className="mt-1"
                existingFileUrl={url || undefined}
                onPendingDelete={onPendingDelete}
                itemTitle={title || "Untitled"}
                collectionName={title || "Untitled"}
                collectionId={streamCollectionId}
                onCollectionCreated={setStreamCollectionId}
                onUploaded={(playbackUrl, _name, seconds) => {
                  setUrl(playbackUrl);
                  if (seconds) {
                    const formatted = withActionWord(formatMediaDuration(seconds), type);
                    setDuration(formatted);
                    // Same reasoning as the chapter uploaders: Save doesn't wait
                    // on processing, so patch the duration straight into the DB
                    // in case the item was already saved while this file was
                    // still transcoding — a no-op if it hasn't been saved yet.
                    (supabase as any)
                      .from("content_items")
                      .update({ duration: formatted })
                      .eq("id", itemId)
                      .then(({ error }: any) => {
                        if (error) console.error("Failed to patch item duration:", error);
                      });
                  }
                }}
              >
                {urlInput}
              </StreamUploader>
            ) : (
              <FileUploader
                className="mt-1"
                existingFileUrl={url || undefined}
                onPendingDelete={onPendingDelete}
                categorySlug={categorySlug}
                itemFolder={itemFolder}
                language="english"
                onUploaded={async (u, name) => {
                  setUrl(u);
                  const estimated = await estimateDuration(u, name, type);
                  if (estimated) setDuration(estimated);
                }}
              >
                {urlInput}
              </FileUploader>
            );
          })()}
        </label>
      )}
      {/* ── Audio Files (audio types only) ── */}
      {isAudioType && (
        <div className="space-y-3">
          <input
            ref={multiUploadInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.opus"
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleMultipleFiles(e.target.files); }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setChaptersOpen((o) => !o)}
                className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground/70 transition-colors"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${chaptersOpen ? "" : "-rotate-90"}`} />
                Audio Files
                {chapters.length > 0 && (
                  <span className="ml-0.5 text-xs text-muted-foreground font-normal">
                    ({chapters.length})
                  </span>
                )}
              </button>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground rounded-sm focus:outline-none">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs">
                    Use this section to break an audio post into multiple chapters — one file per chapter. Users can jump between chapters in the audio player. This is different from the URL field above, which is for a single standalone audio file with no chapters.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={multiUploading}
                onClick={() => multiUploadInputRef.current?.click()}
                className={actionButtonClassName("secondary")}
              >
                <Upload className="h-4 w-4" />
                {multiUploading
                  ? chapterUploadState.size > 0
                    ? `Uploading ${chapterUploadState.size} file${chapterUploadState.size === 1 ? "" : "s"}…`
                    : "Starting…"
                  : "Upload multiple"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChaptersOpen(true);
                  setChapters((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      title: "",
                      title_es: "",
                      file_url: null,
                      file_name: null,
                      file_url_es: null,
                      file_name_es: null,
                      duration_seconds: null,
                      ...lastChapterSection(prev),
                    },
                  ]);
                }}
                className={actionButtonClassName("secondary")}
              >
                <Plus className="h-4 w-4" /> Add audio file
              </button>
            </div>
          </div>

          {chaptersOpen && chapters.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No audio files yet. Add audio files to let users navigate this content by section.
            </p>
          )}

          <datalist id="chapter-section-options">
            {Array.from(new Set(chapters.map((c) => c.section).filter(Boolean))).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          {chaptersOpen &&
            chapters.map((ch, idx) => (
              <Fragment key={idx}>
                {ch.section && ch.section !== chapters[idx - 1]?.section && (
                  <p className="pt-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">
                    {ch.section}
                  </p>
                )}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Audio File {idx + 1}
                      {ch.duration_seconds ? ` · ${formatMediaDuration(ch.duration_seconds)}` : ""}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setChapters((prev) => {
                            const next = [...prev];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return next;
                          })
                        }
                        className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === chapters.length - 1}
                        onClick={() =>
                          setChapters((prev) => {
                            const next = [...prev];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            return next;
                          })
                        }
                        className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ch = chapters[idx];
                          // deleteStorageFile re-derives the provider/path from the URL
                          // itself server-side, so no client-side extraction is needed here.
                          if (ch.file_url) onPendingDelete(ch.file_url);
                          if (ch.file_url_es) onPendingDelete(ch.file_url_es);
                          setChapters((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        title="Remove audio file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <LabeledInput
                      label="Title"
                      value={ch.title}
                      onChange={(v) =>
                        setChapters((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, title: v } : c)),
                        )
                      }
                      required
                    />
                    <label className="block">
                      <span className="flex items-center justify-between gap-2 text-sm font-medium">
                        Title (ES)
                        <button
                          type="button"
                          disabled={
                            !ch.title.trim() ||
                            (chapterTitleEsBusy && translatingChapterIdx === idx)
                          }
                          onClick={async () => {
                            setTranslatingChapterIdx(idx);
                            await runChapterTitleEs(
                              { title: ch.title, section: ch.section },
                              (t) => {
                                if (t.title || t.section)
                                  setChapters((prev) =>
                                    prev.map((c, i) =>
                                      i === idx
                                        ? {
                                            ...c,
                                            ...(t.title ? { title_es: t.title } : {}),
                                            ...(t.section ? { section_es: t.section } : {}),
                                          }
                                        : c,
                                    ),
                                  );
                              },
                              "Audio chapter title in a recovery education app",
                            );
                            setTranslatingChapterIdx(null);
                          }}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-normal text-muted-foreground border border-transparent hover:border-input hover:bg-muted disabled:opacity-40 transition-colors"
                          title="Generate Spanish translation of title and section with AI"
                        >
                          {chapterTitleEsBusy && translatingChapterIdx === idx ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Languages className="h-3 w-3" />
                          )}
                          Translate
                        </button>
                      </span>
                      <input
                        type="text"
                        value={ch.title_es}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, title_es: e.target.value } : c,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-sm font-medium">Section (optional)</span>
                      <input
                        type="text"
                        list="chapter-section-options"
                        placeholder="e.g. Foreword, Chapters, Appendices"
                        value={ch.section}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, section: e.target.value } : c)),
                          )
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Section (ES)</span>
                      <input
                        type="text"
                        value={ch.section_es}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, section_es: e.target.value } : c,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium">Audio file (EN)</span>
                    <StreamUploader
                      className="mt-1"
                      existingFileUrl={ch.file_url ?? undefined}
                      onPendingDelete={onPendingDelete}
                      itemTitle={`${title || "Untitled"} — ${ch.title || `Chapter ${idx + 1}`}`}
                      collectionName={title || "Untitled"}
                      collectionId={streamCollectionId}
                      onCollectionCreated={setStreamCollectionId}
                      externalUpload={chapterUploadState.get(idx) ?? null}
                      onUploaded={(playbackUrl, name, seconds) => {
                        setChapters((prev) =>
                          prev.map((c, i) =>
                            i === idx
                              ? {
                                  ...c,
                                  file_url: playbackUrl,
                                  file_name: name ?? null,
                                  duration_seconds: seconds && seconds > 0 ? seconds : null,
                                  title: c.title.trim()
                                    ? c.title
                                    : name
                                      ? filenameToTitle(name)
                                      : c.title,
                                }
                              : c,
                          ),
                        );
                        // Save no longer waits on processing to finish, so an
                        // admin can already have saved the item (and moved on)
                        // by the time the real duration is known. Patch it
                        // straight into the DB by id — a no-op if the row
                        // hasn't been saved yet, in which case the setChapters
                        // update above is what the next Save will persist.
                        if (seconds && seconds > 0 && ch.id) {
                          (supabase as any)
                            .from("content_chapters")
                            .update({ duration_seconds: seconds })
                            .eq("id", ch.id)
                            .then(({ error }: any) => {
                              if (error) console.error("Failed to patch chapter duration:", error);
                            });
                        }
                      }}
                    >
                      <input
                        type="url"
                        placeholder="https://…"
                        value={ch.file_url ?? ""}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, file_url: e.target.value || null } : c,
                            ),
                          )
                        }
                        onBlur={async (e) => {
                          const v = e.target.value.trim();
                          if (!v) return;
                          const seconds = await probeMediaDuration(v, "audio");
                          if (seconds > 0) {
                            setChapters((prev) =>
                              prev.map((c, i) =>
                                i === idx ? { ...c, duration_seconds: seconds } : c,
                              ),
                            );
                          }
                        }}
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
                      />
                    </StreamUploader>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Audio file (ES, optional)</span>
                    <StreamUploader
                      className="mt-1"
                      existingFileUrl={ch.file_url_es ?? undefined}
                      onPendingDelete={onPendingDelete}
                      itemTitle={`${title || "Untitled"} — ${ch.title || `Chapter ${idx + 1}`} (ES)`}
                      collectionName={title || "Untitled"}
                      collectionId={streamCollectionId}
                      onCollectionCreated={setStreamCollectionId}
                      onUploaded={(playbackUrl, name) =>
                        setChapters((prev) =>
                          prev.map((c, i) =>
                            i === idx
                              ? { ...c, file_url_es: playbackUrl, file_name_es: name ?? null }
                              : c,
                          ),
                        )
                      }
                    >
                      <input
                        type="url"
                        placeholder="https://…"
                        value={ch.file_url_es ?? ""}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, file_url_es: e.target.value || null } : c,
                            ),
                          )
                        }
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
                      />
                    </StreamUploader>
                  </label>
                </div>
              </Fragment>
            ))}

          {chaptersOpen && chapters.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={multiUploading}
                onClick={() => multiUploadInputRef.current?.click()}
                className={actionButtonClassName("secondary", "flex-1 border-dashed")}
              >
                <Upload className="h-3 w-3" />
                {multiUploading
                  ? chapterUploadState.size > 0
                    ? `Uploading ${chapterUploadState.size} file${chapterUploadState.size === 1 ? "" : "s"}…`
                    : "Starting…"
                  : "Upload multiple"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setChapters((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      title: "",
                      title_es: "",
                      file_url: null,
                      file_name: null,
                      file_url_es: null,
                      file_name_es: null,
                      duration_seconds: null,
                      ...lastChapterSection(prev),
                    },
                  ])
                }
                className={actionButtonClassName("secondary", "flex-1 border-dashed")}
              >
                <Plus className="h-3 w-3" /> Add audio file
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
        </label>
        <div className="flex items-start justify-between mt-2">
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox checked={published} onCheckedChange={(v) => setPublished(Boolean(v))} />
              Published
            </label>
            <div className="inline-flex items-center gap-2 text-sm">
              <Checkbox checked={exemptFromProgress} onCheckedChange={(v) => setExemptFromProgress(Boolean(v))} />
              <span>Exempt from tracking</span>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[240px] text-center">
                    Exempt items (e.g. "How to take this course") show an "Acknowledged" button but don't count toward user progress, completion rates, or monthly summaries.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoGenerateDesc}
            disabled={generatingDesc || !title.trim()}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {generatingDesc ? "Generating…" : "Auto-generate description"}
          </button>
        </div>
      </div>

      <TranslationPanel
        open={showEs}
        onOpenChange={setShowEs}
        busy={addEsBusy}
        headingLevel="h4"
        headingClassName="font-display text-base font-semibold"
        description="Leave blank to fall back to the English version when Spanish is selected."
        onTranslate={() => {
          runAddEs(
            { title, description, source, section },
            (t) => {
              if (t.title) setTitleEs(t.title);
              if (t.description) setDescriptionEs(t.description);
              if (t.source) setSourceEs(t.source);
              if (t.section) setSectionEs(t.section);
            },
            "Content item metadata in a learning library",
          );
        }}
      >
        <LabeledInput label="Title (ES)" value={titleEs} onChange={setTitleEs} />
        <LabeledInput label="Source (ES)" value={sourceEs} onChange={setSourceEs} />
        <LabeledInput label="Section (ES)" value={sectionEs} onChange={setSectionEs} />
        <label className="block">
          <span className="text-sm font-medium">Description (ES)</span>
          <textarea
            rows={3}
            value={descriptionEs}
            onChange={(e) => setDescriptionEs(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
        </label>
        {!(isAudioType && chapters.length > 0) && (
          <label className="block">
            <span className="text-sm font-medium">URL (ES, optional)</span>
            {(() => {
              const urlInputEs = (
                <input
                  type="url"
                  placeholder="https://…"
                  value={fileUrlEs ?? ""}
                  onChange={(e) => setFileUrlEs(e.target.value.trim() ? e.target.value : null)}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
              );
              return isAudioType || isVideoType ? (
                <StreamUploader
                  className="mt-1"
                  existingFileUrl={fileUrlEs ?? undefined}
                  onPendingDelete={onPendingDelete}
                  itemTitle={`${title || "Untitled"} (ES)`}
                  collectionName={title || "Untitled"}
                  collectionId={streamCollectionId}
                  onCollectionCreated={setStreamCollectionId}
                  onUploaded={(playbackUrl, name) => {
                    setFileUrlEs(playbackUrl);
                    setFileNameEs(name ?? null);
                  }}
                >
                  {urlInputEs}
                </StreamUploader>
              ) : (
                <FileUploader
                  className="mt-1"
                  existingFileUrl={fileUrlEs ?? undefined}
                  onPendingDelete={onPendingDelete}
                  categorySlug={categorySlug}
                  itemFolder={itemFolder}
                  language="spanish"
                  onUploaded={(u, name) => {
                    setFileUrlEs(u);
                    setFileNameEs(name ?? null);
                  }}
                >
                  {urlInputEs}
                </FileUploader>
              );
            })()}
          </label>
        )}
      </TranslationPanel>

      <div className="flex justify-end gap-2">
        <LoadingButton variant="secondary" onClick={onCancel}>
          Cancel
        </LoadingButton>
        <LoadingButton
          type="submit"
          pending={busy}
          pendingText="Saving…"
          icon={<Save className="h-4 w-4" />}
        >
          Save
        </LoadingButton>
      </div>
    </form>
  );
}


function extOf(url: string, name: string | null): string {
  const src = (name ?? url).toLowerCase().split("?")[0].split("#")[0];
  const m = src.match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "";
}

const AUDIO_EXT = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "webm", "opus"]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v"]);

function mediaKindFor(type: string, url: string, name: string | null): "audio" | "video" | null {
  const ext = extOf(url, name);
  if (AUDIO_EXT.has(ext)) return "audio";
  if (VIDEO_EXT.has(ext)) return "video";
  const t = type.toLowerCase();
  if (t.includes("podcast") || t.includes("audio")) return "audio";
  if (t.includes("video")) return "video";
  return null;
}

function formatMediaDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function probeMediaDuration(url: string, kind: "audio" | "video"): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.src = url;
    const done = (v: number) => { el.src = ""; resolve(v); };
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    setTimeout(() => done(0), 15000);
  });
}

async function estimateDuration(url: string, name: string | null, type: string): Promise<string> {
  const ext = extOf(url, name);
  if (ext) {
    if (AUDIO_EXT.has(ext)) {
      const f = formatMediaDuration(await probeMediaDuration(url, "audio"));
      if (f) return withActionWord(f, type || "audio");
    } else if (VIDEO_EXT.has(ext)) {
      const f = formatMediaDuration(await probeMediaDuration(url, "video"));
      if (f) return withActionWord(f, type || "video");
    } else if (ext === "pdf") {
      const minutes = await estimatePdfReadMinutes(url);
      if (minutes > 0) {
        let base: string;
        if (minutes < 60) base = `${minutes} min`;
        else {
          const h = Math.floor(minutes / 60);
          const m = minutes % 60;
          base = m ? `${h} hr ${m} min` : `${h} hr`;
        }
        return withActionWord(base, type || "pdf");
      }
    }
  }
  return defaultDurationForType(type);
}

function defaultDurationForType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("image")) return "View image";
  if (t.includes("link")) return "Click for more";
  if (t.includes("video")) return "5 min watch";
  if (t.includes("podcast") || t.includes("audio")) return "20 min listen";
  if (t.includes("article")) return "Read article";
  if (t.includes("guide")) return "10 min read";
  if (t.includes("worksheet")) return "10 min complete";
  if (t.includes("meeting")) return "30 min meeting";
  return withActionWord("5 min", type);
}

/**
 * Estimates reading time for a PDF in minutes by delegating to a server
 * function. Server-side extraction via pdfjs-dist in Node.js avoids the
 * browser worker / Vite URL-transform issues that caused silent failures
 * when running pdfjs client-side inside a dynamic import.
 */
async function estimatePdfReadMinutes(url: string): Promise<number> {
  try {
    const result = await estimatePdfDuration({ data: { url } });
    return result.minutes;
  } catch {
    return 0;
  }
}

function filenameToTitle(name: string): string {
  const SMALL_WORDS = new Set([
    "a", "an", "the",
    "and", "but", "or", "nor", "for", "so", "yet",
    "at", "by", "in", "of", "on", "to", "up", "as", "via",
  ]);
  const words = name
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0 || i === words.length - 1 || !SMALL_WORDS.has(lower)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(" ");
}
