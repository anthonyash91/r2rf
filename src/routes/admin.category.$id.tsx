import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { requireContentAdminBeforeLoad } from "@/lib/admin-guards";
import { Checkbox } from "@/components/ui/checkbox";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category, type ContentItem } from "@/lib/categories";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { withActionWord } from "@/lib/duration";
import { useI18n, translateDuration } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Save, X, Sparkles, RefreshCw, ExternalLink, Pencil, FolderOpen, GripVertical, Info, Tag, ChevronDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateCategoryCopy, generateContentDescription } from "@/lib/category-ai.functions";
import { listFacilities } from "@/lib/facilities.functions";
import { generateUniqueCategoryIcon, resolveCategoryIcon } from "@/lib/category-icons";
import { FileUploader } from "@/components/FileUploader";
import { deleteStorageFile, estimatePdfDuration } from "@/lib/storage.functions";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LabeledInput } from "@/components/FormField";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { FacilityBadge } from "@/components/FacilityBadge";
import { isMutationPendingFor } from "@/hooks/use-row-pending";
import { PageHeader } from "@/components/PageHeader";
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
      const { error } = await supabase.from("categories").update(categoryFields).eq("id", id);
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
          <ContentManager categoryId={id} categoryName={data.category.name} categorySlug={data.category.slug} items={data.items} initialEditId={edit} categoryFacilities={data.category.facilities ?? []} />
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

function ContentManager({ categoryId, categoryName, categorySlug, items, initialEditId, categoryFacilities }: { categoryId: string; categoryName: string; categorySlug: string; items: ContentItem[]; initialEditId?: string; categoryFacilities: string[] }) {
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
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        el.scrollIntoView({ behavior: "smooth", block: "center" });
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
  };

  const saveMut = useMutation({
    mutationFn: async (values: Partial<ContentItem> & { id?: string }) => {
      const { facilities, ...itemValues } = values;
      let savedId: string;
      if (itemValues.id) {
        const { id: itemId, ...rest } = itemValues;
        const { error } = await (supabase as any).from("content_items").update(rest).eq("id", itemId!);
        if (error) throw error;
        savedId = itemId!;
      } else {
        const { data, error } = await supabase.from("content_items").insert({
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
      return savedId;
    },
    onSuccess: (savedId) => {
      toast.success("Saved");
      setEditing(null);
      if (savedId) setPendingScrollId(savedId);
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
        Promise.all(toDelete.map((path) => deleteOldFile({ data: { path } }))).catch(() => {});
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

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl font-semibold">Content <span className="text-muted-foreground font-normal">({order.length})</span></h2>
        <button
          onClick={() => setEditing("new")}
          disabled={editing === "new"}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
        >
          <Plus className="h-4 w-4" /> New item
        </button>
      </div>

      {editing && (
        <div ref={editorRef} className="scroll-mt-24">
          <ItemEditor
            item={editing === "new" ? null : editing}
            categoryId={categoryId}
            categoryName={categoryName}
            onCancel={() => setEditing(null)}
            onSave={(v) => saveMut.mutate(v)}
            busy={saveMut.isPending}
            categoryFacilities={categoryFacilities}
            onPendingDelete={(path) => { pendingDeletesRef.current.push(path); }}
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
          onEnterEditMode={() => setEditing(null)}
          onDeleteSelected={async (ids) =>
            confirmDelete({
              title: `Delete ${ids.length} ${ids.length === 1 ? "item" : "items"}?`,
              description: `Permanently delete ${ids.length === 1 ? "the selected item" : `${ids.length} selected items`}?`,
              onConfirm: () => deleteManyMut.mutateAsync(ids),
            })
          }
          extraSelectionActions={(ids) => (
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
                onReorder={(next) => { setOrder(next); reorderMut.mutate(next); }}
                renderItem={(item) => renderItemRow(item)}
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

function ItemEditor({
  item,
  categoryId,
  categoryName,
  onCancel,
  onSave,
  busy,
  categoryFacilities,
  onPendingDelete,
  onNewTypeBadgeStyle,
}: {
  item: ContentItem | null;
  categoryId: string;
  categoryName: string;
  onCancel: () => void;
  onSave: (v: Partial<ContentItem> & { id?: string }) => void;
  busy: boolean;
  categoryFacilities: string[];
  onPendingDelete: (path: string) => void;
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
  const [type, setType] = useState(item?.type ?? "Article");
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState("");
  const [source, setSource] = useState(item?.source ?? "");
  const [duration, setDuration] = useState(item?.duration ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [published, setPublished] = useState(item?.published ?? true);
  const [exemptFromProgress, setExemptFromProgress] = useState(item?.exempt_from_progress ?? false);
  const [facilities, setFacilities] = useState<string[]>(item?.facilities ?? []);
  const [titleEs, setTitleEs] = useState(item?.title_es ?? "");
  const [descriptionEs, setDescriptionEs] = useState(item?.description_es ?? "");
  
  const [fileUrlEs, setFileUrlEs] = useState<string | null>(item?.file_url_es ?? null);
  const [fileNameEs, setFileNameEs] = useState<string | null>(item?.file_name_es ?? null);
  const [showEs, setShowEs] = useState(
    !!(item?.title_es || item?.description_es || item?.source_es || item?.file_url_es),
  );
  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();

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
    return () => { cancelled = true; };
  }, [type, url]);


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
          source_es: null,
          file_url_es: fileUrlEs,
          file_name_es: fileNameEs,
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
                {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                <SelectItem value="__new__">+ Add new type…</SelectItem>
              </SelectContent>
            </Select>
          )}
          {!addingType && typeOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {typeOptions.map((t) => (
                <Badge key={t} variant="type" type={t} className="gap-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => deleteType(t)}
                    title={`Delete type "${t}"`}
                    className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </label>
        <LabeledInput label="Source" value={source} onChange={setSource} suggestions={sourceSuggestions} />
        <div>
          <LabeledInput label="Duration" value={duration} onChange={setDuration} placeholder="8 min read" />
          {extOf(url, null) === "pdf" && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
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
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${pdfEstimating ? "animate-spin" : ""}`} />
                {pdfEstimating ? "Calculating PDF duration…" : "Recalculate PDF duration"}
              </button>
              {pdfEstimating && (
                <span className="text-xs text-muted-foreground">Reading PDF to estimate reading time…</span>
              )}
            </div>
          )}
        </div>
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
      </div>
      <div>
        <span className="text-sm font-medium">URL (optional)</span>
        <div className="mt-1 flex items-center gap-2">
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
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
          <FileUploader
            existingFileUrl={url || undefined}
            onPendingDelete={onPendingDelete}
            contentType={type}
            onUploaded={async (u, name) => {
              setUrl(u);
              const estimated = await estimateDuration(u, name, type);
              if (estimated) setDuration(estimated);
            }}
          />
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={handleAutoGenerateDesc}
          disabled={generatingDesc || !title.trim()}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {generatingDesc ? "Generating…" : "Auto-generate description"}
        </button>
        <p className="mt-1 text-xs text-muted-foreground">Uses the Title to draft copy. You can edit the result.</p>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
        />
      </label>
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

      <TranslationPanel
        open={showEs}
        onOpenChange={setShowEs}
        busy={addEsBusy}
        headingLevel="h4"
        headingClassName="font-display text-base font-semibold"
        description="Leave blank to fall back to the English version when Spanish is selected."
        onTranslate={() => {
          runAddEs(
            { title, description },
            (t) => {
              if (t.title) setTitleEs(t.title);
              if (t.description) setDescriptionEs(t.description);
            },
            "Content item metadata in a learning library",
          );
        }}
      >
        <LabeledInput label="Title (ES)" value={titleEs} onChange={setTitleEs} />
        <label className="block">
          <span className="text-sm font-medium">Description (ES)</span>
          <textarea
            rows={3}
            value={descriptionEs}
            onChange={(e) => setDescriptionEs(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
        </label>
        <div>
          <LabeledInput
            label="URL (ES, optional)"
            value={fileUrlEs ?? ""}
            onChange={(v) => setFileUrlEs(v.trim() ? v : null)}
            placeholder="https://…"
            type="url"
          />
          <p className="mt-1 text-xs text-muted-foreground">Shown to visitors viewing the site in Spanish. Falls back to the English link if omitted.</p>
          <div className="mt-2">
            <FileUploader
              label={fileUrlEs ? "Replace Spanish file" : "Upload Spanish file"}
              existingFileUrl={fileUrlEs ?? undefined}
              onPendingDelete={onPendingDelete}
              contentType={type}
              onUploaded={(u, name) => { setFileUrlEs(u); setFileNameEs(name ?? null); }}
            />
          </div>
        </div>
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
