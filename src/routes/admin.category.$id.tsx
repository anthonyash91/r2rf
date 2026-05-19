import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_TYPES, slugify, type Category, type ContentItem } from "@/lib/categories";
import { typeBadgeClass } from "@/lib/type-badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Save, X, Languages, Sparkles, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateCategoryCopy, generateContentDescription } from "@/lib/category-ai.functions";

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
import { FileUploader } from "@/components/FileUploader";
import { useTranslateToSpanish, TranslatingIndicator } from "@/components/TranslateButton";
import { SortableList } from "@/components/SortableList";
import { useConfirm } from "@/components/ConfirmDialog";

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
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      {isLoading || !data ? (
        <p className="mt-6 text-muted-foreground">Loading…</p>
      ) : (
        <>
          <CategoryEditor category={data.category} onSave={(v) => saveCategory.mutate(v)} busy={saveCategory.isPending} />
          <ContentManager categoryId={id} categoryName={data.category.name} items={data.items} initialEditId={edit} />
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
    <section className="mt-6 rounded-2xl border border-border bg-card p-6">
      <h1 className="font-display text-2xl font-semibold">Edit category</h1>
      <form
        className="mt-4 space-y-4"
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
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={generating || !name.trim()}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Generating…" : "Auto-generate tagline & description"}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">Uses the Name to draft copy. You can edit the result.</p>
        </div>
        <LabeledInput label="Tagline" value={tagline} onChange={setTagline} />
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                <button
                  type="button"
                  onClick={() => setIconUrl(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Home Page</span>
          <select
            value={homePageMode}
            onChange={(e) => setHomePageMode(e.target.value as "default" | "custom")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="default">Default (main home page + all custom home pages)</option>
            <option value="custom">Custom (only on selected custom home pages)</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (visible to the public)
        </label>


        {showEs ? (
          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold">Spanish translation</h3>
                <p className="text-xs text-muted-foreground">Leave blank to fall back to English when Spanish is selected.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={addEsBusy}
                  onClick={() => {
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-60"
                >
                  <RefreshCw className={`h-3 w-3 ${addEsBusy ? "animate-spin" : ""}`} />
                  {addEsBusy ? "Translating…" : "Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEs(false)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Hide
                </button>
              </div>
            </div>
            {addEsBusy && <TranslatingIndicator />}
            <LabeledInput label="Name (ES)" value={nameEs} onChange={setNameEs} />
            <LabeledInput label="Tagline (ES)" value={taglineEs} onChange={setTaglineEs} />
            <label className="block">
              <span className="text-sm font-medium">Description (ES)</span>
              <textarea
                rows={3}
                value={descriptionEs}
                onChange={(e) => setDescriptionEs(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              disabled={addEsBusy}
              onClick={() => {
                setShowEs(true);
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
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
            >
              {addEsBusy ? "Translating…" : "+ Add Spanish translation"}
            </button>
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </form>
    </section>
  );
}

function ContentManager({ categoryId, categoryName, items, initialEditId }: { categoryId: string; categoryName: string; items: ContentItem[]; initialEditId?: string }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
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
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-semibold">Content</h2>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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

      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        {order.length === 0 ? (
          <p className="p-6 text-muted-foreground">No items yet.</p>
        ) : (
          <SortableList
            className="divide-y divide-border"
            items={order}
            onReorder={(next) => { setOrder(next); reorderMut.mutate(next); }}
            renderItem={(item) => {
              const isEditingThis = editing !== null && editing !== "new" && editing.id === item.id;
              const isDimmed = editing !== null && !isEditingThis;
              return (
              <div className={`flex items-center gap-3 p-4 transition-opacity pl-[6px] ${isDimmed ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${typeBadgeClass(item.type)}`}>{item.type}</span>
                    {!item.published && (
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Draft</span>
                    )}
                    <h3 className="font-medium truncate">{item.title}</h3>
                    {(() => {
                      const s = itemTranslationStatus(item);
                      if (s === "complete") return null;
                      const label = s === "missing" ? "Needs ES" : "Partially translated";
                      const title = s === "missing" ? "Missing Spanish translation" : "Some Spanish fields are missing";
                      return (
                        <span
                          title={title}
                          className="inline-flex items-center gap-1 text-xs rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[var(--color-gold)] border border-[var(--color-gold)]/30"
                        >
                          <Languages className="h-3 w-3" /> {label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-[8px]">{item.source} · {item.duration}</p>
                </div>
                <button
                  title={item.published ? "Unpublish" : "Publish"}
                  onClick={() => togglePublish.mutate(item)}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  {item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setEditing(item)}
                  className="rounded-md px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete "${item.title}"?`,
                      description: "This content will be permanently removed.",
                      confirmLabel: "Delete",
                      destructive: true,
                    });
                    if (ok) deleteMut.mutate(item.id);
                  }}
                  className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              );
            }}
          />
        )}
      </div>
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
  const confirm = useConfirm();
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
    const ok = await confirm({
      title: `Delete type "${t}"?`,
      description: `Any items using this type will be changed to "Article".`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("content_items")
      .update({ type: "Article" })
      .eq("type", t);
    if (error) { toast.error(error.message); return; }
    if (type === t) setType("Article");
    toast.success(`Deleted type "${t}"`);
    qc.invalidateQueries({ queryKey: ["content-types"] });
    qc.invalidateQueries({ queryKey: ["admin", "category"] });
    qc.invalidateQueries({ queryKey: ["category"] });
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
      className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-4"
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
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={commitNewType}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add
              </button>
              <button
                type="button"
                onClick={cancelNewType}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <select
              value={type}
              onChange={(e) => {
                if (e.target.value === "__new__") setAddingType(true);
                else setType(e.target.value);
              }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__new__">+ Add new type…</option>
            </select>
          )}
          {!addingType && typeOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {typeOptions.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t}
                  <button
                    type="button"
                    onClick={() => deleteType(t)}
                    title={`Delete type "${t}"`}
                    className="rounded-full hover:bg-destructive/10 hover:text-destructive p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </label>
        <LabeledInput label="Source" value={source} onChange={setSource} />
        <LabeledInput label="Duration" value={duration} onChange={setDuration} placeholder="8 min read" />
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
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
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
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Published
      </label>

      {showEs ? (
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-display text-base font-semibold">Spanish translation</h4>
              <p className="text-xs text-muted-foreground">Leave blank to fall back to the English version when Spanish is selected.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={addEsBusy}
                onClick={() => {
                  runAddEs(
                    { title, description },
                    (t) => {
                      if (t.title) setTitleEs(t.title);
                      if (t.description) setDescriptionEs(t.description);
                    },
                    "Content item metadata in a learning library",
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${addEsBusy ? "animate-spin" : ""}`} />
                {addEsBusy ? "Translating…" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={() => setShowEs(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Hide
              </button>
            </div>
          </div>
          {addEsBusy && <TranslatingIndicator />}
          <LabeledInput label="Title (ES)" value={titleEs} onChange={setTitleEs} />
          <label className="block">
            <span className="text-sm font-medium">Description (ES)</span>
            <textarea
              rows={3}
              value={descriptionEs}
              onChange={(e) => setDescriptionEs(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
        </div>
      ) : (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            disabled={addEsBusy}
            onClick={() => {
              setShowEs(true);
              runAddEs(
                { title, description },
                (t) => {
                  if (t.title) setTitleEs(t.title);
                  if (t.description) setDescriptionEs(t.description);
                },
                "Content item metadata in a learning library",
              );
            }}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            {addEsBusy ? "Translating…" : "+ Add Spanish translation"}
          </button>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> Save
        </button>
      </div>
    </form>
  );
}

function LabeledInput({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
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
      if (f) return f;
    } else if (VIDEO_EXT.has(ext)) {
      const f = formatMediaDuration(await probeMediaDuration(url, "video"));
      if (f) return f;
    } else if (ext === "pdf") {
      const minutes = await estimatePdfReadMinutes(url);
      if (minutes > 0) {
        if (minutes < 60) return `${minutes} min read`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m ? `${h} hr ${m} min read` : `${h} hr read`;
      }
    }
  }
  return defaultDurationForType(type);
}

function defaultDurationForType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("link")) return "Click for more";
  if (t.includes("video")) return "5 min watch";
  if (t.includes("podcast") || t.includes("audio")) return "20 min listen";
  if (t.includes("article")) return "5 min read";
  if (t.includes("guide")) return "10 min read";
  if (t.includes("worksheet")) return "10 min";
  if (t.includes("meeting")) return "30 min";
  return "5 min";
}

async function estimatePdfReadMinutes(url: string): Promise<number> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const buf = await res.arrayBuffer();
    const bytes = buf.byteLength;
    // Count PDF pages by scanning for "/Type /Page" objects (excluding "/Pages").
    const text = new TextDecoder("latin1").decode(new Uint8Array(buf));
    const matches = text.match(/\/Type\s*\/Page(?![s\w])/g);
    const pages = matches?.length ?? 0;
    // Reading time: ~2 min/page. Add a small bump for dense/image-heavy PDFs
    // by ensuring at least ~1 min per 250 KB of file size.
    const byPages = pages * 2;
    const bySize = Math.round(bytes / (250 * 1024));
    const minutes = Math.max(byPages, bySize);
    return Math.max(1, minutes);
  } catch {
    return 0;
  }
}
