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
  const [published, setPublished] = useState(category.published);

  useEffect(() => {
    setName(category.name);
    setSlug(category.slug);
    setTagline(category.tagline);
    setDescription(category.description);
    setPublished(category.published);
  }, [category]);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6">
      <h1 className="font-display text-2xl font-semibold">Edit category</h1>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, slug: slugify(slug), tagline, description, published });
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
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (visible to the public)
        </label>
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

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
        {items.length === 0 && <li className="p-6 text-muted-foreground">No items yet.</li>}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 p-4">
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
          </li>
        ))}
      </ul>
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
                  if (e.key === "Escape") { setAddingType(false); setNewType(""); }
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
        </label>
        <LabeledInput label="Source" value={source} onChange={setSource} />
        <LabeledInput label="Duration" value={duration} onChange={setDuration} placeholder="8 min read" />
      </div>
      <div>
        <LabeledInput label="URL (optional)" value={url} onChange={setUrl} placeholder="https://…" type="url" />
        <div className="mt-2">
          <FileUploader onUploaded={(u) => setUrl(u)} />
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
