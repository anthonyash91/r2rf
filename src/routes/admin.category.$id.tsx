import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_TYPES, slugify, type Category, type ContentItem } from "@/lib/categories";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Save, X } from "lucide-react";
import { FileUploader } from "@/components/FileUploader";
import { SortableList } from "@/components/SortableList";

export const Route = createFileRoute("/admin/category/$id")({
  component: AdminCategoryPage,
});

function AdminCategoryPage() {
  const { id } = Route.useParams();
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
        <ArrowLeft className="h-4 w-4" /> All categories
      </Link>

      {isLoading || !data ? (
        <p className="mt-6 text-muted-foreground">Loading…</p>
      ) : (
        <>
          <CategoryEditor category={data.category} onSave={(v) => saveCategory.mutate(v)} busy={saveCategory.isPending} />
          <ContentManager categoryId={id} items={data.items} />
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
  const [nameEs, setNameEs] = useState(category.name_es ?? "");
  const [taglineEs, setTaglineEs] = useState(category.tagline_es ?? "");
  const [descriptionEs, setDescriptionEs] = useState(category.description_es ?? "");

  useEffect(() => {
    setName(category.name);
    setSlug(category.slug);
    setTagline(category.tagline);
    setDescription(category.description);
    setIconUrl(category.icon_url);
    setPublished(category.published);
    setNameEs(category.name_es ?? "");
    setTaglineEs(category.tagline_es ?? "");
    setDescriptionEs(category.description_es ?? "");
  }, [category]);

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
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (visible to the public)
        </label>

        <div className="border-t border-border pt-4 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Spanish translation</h3>
            <p className="text-xs text-muted-foreground">Leave blank to fall back to English when Spanish is selected.</p>
          </div>
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

function ContentManager({ categoryId, items }: { categoryId: string; items: ContentItem[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const [order, setOrder] = useState<ContentItem[]>([]);
  useEffect(() => { setOrder(items); }, [items]);

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
        <ItemEditor
          item={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(v) => saveMut.mutate(v)}
          busy={saveMut.isPending}
        />
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        {order.length === 0 ? (
          <p className="p-6 text-muted-foreground">No items yet.</p>
        ) : (
          <SortableList
            className="divide-y divide-border"
            items={order}
            onReorder={(next) => { setOrder(next); reorderMut.mutate(next); }}
            renderItem={(item) => (
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{item.type}</span>
                    {!item.published && (
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Draft</span>
                    )}
                    <h3 className="font-medium truncate">{item.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.source} · {item.duration}</p>
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
                  onClick={() => { if (confirm(`Delete "${item.title}"?`)) deleteMut.mutate(item.id); }}
                  className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          />
        )}
      </div>
    </section>
  );
}

function ItemEditor({
  item,
  onCancel,
  onSave,
  busy,
}: {
  item: ContentItem | null;
  onCancel: () => void;
  onSave: (v: Partial<ContentItem> & { id?: string }) => void;
  busy: boolean;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState(item?.type ?? "Article");
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState("");
  const [source, setSource] = useState(item?.source ?? "");
  const [duration, setDuration] = useState(item?.duration ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [published, setPublished] = useState(item?.published ?? true);

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
    if (!confirm(`Delete type "${t}"? Any items using it will be changed to "Article".`)) return;
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
                className="rounded-md px-3 py-2 text-sm hover:bg-muted"
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
        <LabeledInput label="URL (optional)" value={url} onChange={setUrl} placeholder="https://…" type="url" />
        <div className="mt-2">
          <FileUploader
            onUploaded={async (u, name) => {
              setUrl(u);
              const estimated = await estimateDuration(u, name);
              if (estimated) setDuration(estimated);
            }}
          />
        </div>
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
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm hover:bg-muted">
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

async function estimateDuration(url: string, name: string | null): Promise<string> {
  const ext = extOf(url, name);
  if (!ext) return "";
  if (AUDIO_EXT.has(ext)) return formatMediaDuration(await probeMediaDuration(url, "audio"));
  if (VIDEO_EXT.has(ext)) return formatMediaDuration(await probeMediaDuration(url, "video"));
  if (ext === "pdf") {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > 0) {
        // ~80 KB per page, ~2 min per page reading time
        const pages = Math.max(1, Math.round(len / 80_000));
        const minutes = Math.max(1, pages * 2);
        if (minutes < 60) return `${minutes} min read`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m ? `${h} hr ${m} min read` : `${h} hr read`;
      }
    } catch {}
  }
  return "";
}
