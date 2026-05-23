import { createFileRoute, Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_TYPES, slugify, type Category, type ContentItem } from "@/lib/categories";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { withActionWord } from "@/lib/duration";
import { useI18n, translateDuration } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Save, X, Languages, Sparkles, RefreshCw, ExternalLink, Pencil, Loader2, FolderOpen, GripVertical } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateCategoryCopy, generateContentDescription } from "@/lib/category-ai.functions";
import { generateUniqueCategoryIcon, resolveCategoryIcon } from "@/lib/category-icons";
import { FileUploader } from "@/components/FileUploader";
import { useTranslateToSpanish } from "@/components/TranslateButton";
import { TranslationPanel } from "@/components/TranslationPanel";
import { SortableList } from "@/components/SortableList";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton, TooltipWrap, iconButtonClassName } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { BulkActionBar } from "@/components/BulkActionBar";
import { LabeledInput } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { isMutationPendingFor } from "@/hooks/use-row-pending";
import { PageHeader } from "@/components/PageHeader";

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
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
  component: AdminCategoryPage,
});

function AdminCategoryPage() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "category", id],
    queryFn: async () => {
      const { data: cat, error: e1 } = await supabase.from("categories").select("*").eq("id", id).single();
      if (e1) throw e1;
      const { data: items, error: e2 } = await supabase
        .from("content_items")
        .select("*")
        .eq("category_id", id)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      return { category: cat as Category, items: (items ?? []) as ContentItem[] };
    },
  });

  const saveCategory = useMutation({
    mutationFn: async (input: Partial<Category>) => {
      const { error } = await supabase.from("categories").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "category", id] });
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["category"] });
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
          <ContentManager categoryId={id} categoryName={data.category.name} categorySlug={data.category.slug} items={data.items} initialEditId={edit} />
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
  const [iconUrl, setIconUrl] = useState<string | null>(category.icon_url);
  const [published, setPublished] = useState(category.published);
  const [homePageMode, setHomePageMode] = useState<"default" | "custom">(
    category.home_page_mode ?? "default",
  );
  const [nameEs, setNameEs] = useState(category.name_es ?? "");
  const [taglineEs, setTaglineEs] = useState(category.tagline_es ?? "");
  const [descriptionEs, setDescriptionEs] = useState(category.description_es ?? "");
  const [showEs, setShowEs] = useState(
    !!(category.name_es || category.tagline_es || category.description_es),
  );
  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();

  useEffect(() => {
    setName(category.name);
    setSlug(category.slug);
    setTagline(category.tagline);
    setDescription(category.description);
    setIconUrl(category.icon_url);
    setPublished(category.published);
    setHomePageMode(category.home_page_mode ?? "default");
    setNameEs(category.name_es ?? "");
    setTaglineEs(category.tagline_es ?? "");
    setDescriptionEs(category.description_es ?? "");
    if (category.name_es || category.tagline_es || category.description_es) setShowEs(true);
  }, [category]);

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

  return (
    <SectionCard className="mt-8">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            slug: slugify(slug),
            tagline,
            description,
            icon_url: iconUrl,
            published,
            home_page_mode: homePageMode,
            name_es: nameEs.trim() || null,
            tagline_es: taglineEs.trim() || null,
            description_es: descriptionEs.trim() || null,
          });
        }}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <LabeledInput label="Name" value={name} onChange={setName} />
          <LabeledInput label="Slug" value={slug} onChange={(v) => setSlug(slugify(v))} />
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
          <div className="mt-2 flex items-center gap-4">
            {iconUrl ? (
              <img
                src={iconUrl}
                alt="Category icon"
                className="h-16 w-16 rounded-lg object-cover border border-border bg-muted"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg border border-dashed border-border bg-muted/40 grid place-items-center text-xs text-muted-foreground">
                No icon
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <FileUploader
                label={iconUrl ? "Replace icon" : "Upload icon"}
                mimeTypes={["image/*"]}
                existingFileUrl={iconUrl}
                onUploaded={(u) => setIconUrl(u)}
              />
              {iconUrl && (
                <LoadingButton
                  variant="secondary"
                  onClick={() => setIconUrl(null)}
                  className="text-muted-foreground"
                >
                  Remove
                </LoadingButton>
              )}
            </div>
          </div>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Home Page</span>
          <Select value={homePageMode} onValueChange={(v) => setHomePageMode(v as "default" | "custom")}>
            <SelectTrigger className="mt-1 w-full shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (main home page + all custom home pages)</SelectItem>
              <SelectItem value="custom">Custom (only on selected custom home pages)</SelectItem>
            </SelectContent>
          </Select>
        </label>

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

        <div className="flex justify-end">
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

function ContentManager({ categoryId, categoryName, categorySlug, items, initialEditId }: { categoryId: string; categoryName: string; categorySlug: string; items: ContentItem[]; initialEditId?: string }) {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const { lang } = useI18n();
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const [order, setOrder] = useState<ContentItem[]>([]);
  const editorRef = useRef<HTMLDivElement | null>(null);
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "category", categoryId] });
    qc.invalidateQueries({ queryKey: ["category"] });
  };

  const saveMut = useMutation({
    mutationFn: async (values: Partial<ContentItem> & { id?: string }) => {
      if (values.id) {
        const { id: itemId, ...rest } = values;
        const { error } = await supabase.from("content_items").update(rest).eq("id", itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_items").insert({
          category_id: categoryId,
          title: values.title!,
          type: values.type ?? "Article",
          source: values.source ?? "",
          duration: values.duration ?? "",
          description: values.description ?? "",
          url: values.url ?? null,
          file_url: values.file_url ?? null,
          file_name: values.file_name ?? null,
          title_es: values.title_es ?? null,
          description_es: values.description_es ?? null,
          source_es: values.source_es ?? null,
          file_url_es: values.file_url_es ?? null,
          file_name_es: values.file_name_es ?? null,
          published: values.published ?? true,
          sort_order: (items.at(-1)?.sort_order ?? 0) + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      invalidate();
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
  const [searchQuery, setSearchQuery] = useState("");
  const deleteManyMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("content_items").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: async (deleted) => {
      toast.success(`Deleted ${deleted} ${deleted === 1 ? "item" : "items"}`);
      await invalidate();
      bulk.clear();
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
        <div ref={editorRef}>
          <ItemEditor
            item={editing === "new" ? null : editing}
            categoryName={categoryName}
            onCancel={() => setEditing(null)}
            onSave={(v) => saveMut.mutate(v)}
            busy={saveMut.isPending}
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
        />
      )}

      <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${order.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
        {(() => {
          const renderItemRow = (item: ContentItem) => {
            const isEditingThis = editing !== null && editing !== "new" && editing.id === item.id;
            const isDimmed = editing !== null && !isEditingThis;
            return (
              <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-6 pl-3 pb-6 sm:pb-5 transition-opacity ${isDimmed ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const s = itemTranslationStatus(item);
                      const trLabel = s === "missing" ? "Needs ES" : "Partially translated";
                      const trTitle = s === "missing" ? "Missing Spanish translation" : "Some Spanish fields are missing";
                      return (
                        <BadgeGroup>
                          <Badge variant="type" type={item.type}>{item.type}</Badge>
                          {!item.published && <Badge variant="draft">Draft</Badge>}
                          {s !== "complete" && (
                            <Badge variant="translation" title={trTitle} className="gap-1">
                              <Languages className="h-3 w-3" /> {trLabel}
                            </Badge>
                          )}
                        </BadgeGroup>
                      );
                    })()}
                    {item.duration && (
                      <span className="text-xs text-muted-foreground">
                        {translateDuration(lang, withActionWord(item.duration, item.type))}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-foreground leading-snug truncate">{item.title}</h3>
                    {item.description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>}
                    {item.source && <p className="mt-2 text-xs text-muted-foreground/80">Source · {item.source}</p>}
                  </div>
                </div>
                <TooltipProvider delayDuration={150}>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
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
            <SortableList
              className="divide-y divide-border"
              dragHandleClassName="pl-5"
              items={order}
              onReorder={(next) => { setOrder(next); reorderMut.mutate(next); }}
              renderItem={(item) => renderItemRow(item)}
            />

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
  categoryName,
  onCancel,
  onSave,
  busy,
}: {
  item: ContentItem | null;
  categoryName: string;
  onCancel: () => void;
  onSave: (v: Partial<ContentItem> & { id?: string }) => void;
  busy: boolean;
}) {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const { data: sourceSuggestions = [] } = useQuery({
    queryKey: ["admin", "content-sources"],
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
    queryKey: ["content-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_items").select("type");
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r: { type: string }) => r.type).filter(Boolean)));
    },
  });

  const typeOptions = Array.from(new Set([...CONTENT_TYPES, ...existingTypes, type].filter(Boolean)));

  const commitNewType = () => {
    const v = newType.trim();
    if (!v) return;
    setType(v);
    setAddingType(false);
    setNewType("");
  };

  const cancelNewType = () => {
    setAddingType(false);
    setNewType("");
  };

  const deleteType = async (t: string) => {
    await confirmDelete({
      title: `Delete type "${t}"?`,
      description: `Any items using this type will be changed to "Article".`,
      onConfirm: async () => {
        const { error } = await supabase
          .from("content_items")
          .update({ type: "Article" })
          .eq("type", t);
        if (error) {
          toast.error(error.message);
          throw error;
        }
        if (type === t) setType("Article");
        toast.success(`Deleted type "${t}"`);
        qc.invalidateQueries({ queryKey: ["content-types"] });
        qc.invalidateQueries({ queryKey: ["admin", "category"] });
        qc.invalidateQueries({ queryKey: ["category"] });
      },
    });
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
          title_es: titleEs.trim() || null,
          description_es: descriptionEs.trim() || null,
          source_es: null,
          file_url_es: fileUrlEs,
          file_name_es: fileNameEs,
        });
      }}
      className="mt-6 mb-8 rounded-2xl border border-border bg-card p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{item ? "Edit item" : "New item"}</h3>
        <button type="button" onClick={onCancel} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <LabeledInput label="Title" value={title} onChange={setTitle} required />
      <div className="grid sm:grid-cols-3 gap-4">
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
                placeholder="New type name"
                className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
              <button
                type="button"
                onClick={commitNewType}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                onClick={cancelNewType}
              >
                Cancel
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
              <SelectTrigger className="mt-1 w-full shadow-none">
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
      </div>
      <div>
        <label className="block">
          <span className="text-sm font-medium">URL (optional)</span>
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
            className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
        </label>
        <div className="mt-2">
          <FileUploader
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
      <label className="inline-flex items-center gap-2 text-sm">
        <Checkbox checked={published} onCheckedChange={(v) => setPublished(Boolean(v))} />
        Published
      </label>

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

async function estimatePdfReadMinutes(url: string): Promise<number> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const buf = await res.arrayBuffer();
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true, throwOnInvalidObject: false });
    const pages = doc.getPageCount();
    if (pages <= 0) return 0;
    // Assume ~1.5 minutes per page of typical reading material.
    return Math.max(1, Math.round(pages * 1.5));
  } catch {
    return 0;
  }
}
