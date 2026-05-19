import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Eye, EyeOff, Languages, Sparkles, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateCategoryCopy } from "@/lib/category-ai.functions";

function categoryTranslationStatus(c: Category): "complete" | "partial" | "missing" {
  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [c.name, c.name_es],
    [c.tagline?.trim() ? c.tagline : null, c.tagline_es],
    [c.description?.trim() ? c.description : null, c.description_es],
  ];
  const required = pairs.filter(([en]) => !!en?.toString().trim());
  if (required.length === 0) return "complete";
  const translated = required.filter(([, es]) => !!es?.toString().trim()).length;
  if (translated === 0) return "missing";
  if (translated < required.length) return "partial";
  return "complete";
}
import { SortableList } from "@/components/SortableList";
import { FileUploader } from "@/components/FileUploader";
import { useConfirm } from "@/components/ConfirmDialog";
import { useTranslateToSpanish, TranslatingIndicator } from "@/components/TranslateButton";

export const Route = createFileRoute("/admin/")({
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  const qc = useQueryClient();
  useAuth();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: customHomePagesByCategory = {} } = useQuery({
    queryKey: ["admin", "category-custom-home-pages"],
    queryFn: async (): Promise<Record<string, { id: string; name: string; slug: string }[]>> => {
      const { data, error } = await supabase
        .from("custom_home_page_categories")
        .select("category_id, custom_home_pages:custom_home_page_id(id, name, slug)");
      if (error) throw error;
      const map: Record<string, { id: string; name: string; slug: string }[]> = {};
      for (const row of (data ?? []) as any[]) {
        const page = row.custom_home_pages;
        if (!page) continue;
        (map[row.category_id] ??= []).push({ id: page.id, name: page.name || page.slug, slug: page.slug });
      }
      for (const k of Object.keys(map)) map[k].sort((a, b) => a.name.localeCompare(b.name));
      return map;
    },
  });

  const { data: itemCountsByCategory = {} } = useQuery({
    queryKey: ["admin", "category-item-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("content_items")
        .select("category_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { category_id: string }[]) {
        counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: {
      name: string;
      slug: string;
      tagline: string;
      description: string;
      icon_url: string | null;
      published: boolean;
      home_page_mode: "default" | "custom";
      name_es: string | null;
      tagline_es: string | null;
      description_es: string | null;
    }) => {
      const { error } = await supabase.from("categories").insert({
        name: input.name,
        slug: input.slug,
        tagline: input.tagline,
        description: input.description,
        icon_url: input.icon_url,
        published: input.published,
        home_page_mode: input.home_page_mode,
        name_es: input.name_es,
        tagline_es: input.tagline_es,
        description_es: input.description_es,
        sort_order: (categories.at(-1)?.sort_order ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category created");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const togglePublish = useMutation({
    mutationFn: async (cat: Category) => {
      const { error } = await supabase
        .from("categories")
        .update({ published: !cat.published })
        .eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "categories"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [order, setOrder] = useState<Category[]>([]);
  useEffect(() => { setOrder(categories); }, [categories]);

  const reorderMut = useMutation({
    mutationFn: async (next: Category[]) => {
      await Promise.all(
        next.map((c, i) =>
          supabase.from("categories").update({ sort_order: i + 1 }).eq("id", c.id),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the library structure.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New category
          </button>
        </div>
      </div>

      {creating && (
        <NewCategoryForm
          onCancel={() => setCreating(false)}
          onSubmit={(values) => createMut.mutate(values)}
          busy={createMut.isPending}
        />
      )}

      <div className="mt-8 rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-muted-foreground">No categories yet.</div>
        ) : (
          <SortableList
            className="divide-y divide-border"
            items={order}
            onReorder={(next) => { setOrder(next); reorderMut.mutate(next); }}
            renderItem={(c) => (
              <div className="flex items-center gap-4 p-4 pl-[10px]">
                {c.icon_url ? (
                  <img
                    src={c.icon_url}
                    alt={`${c.name} icon`}
                    className="h-12 w-12 rounded-lg object-cover border border-border bg-muted shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg border border-dashed border-border bg-muted/40 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg font-semibold truncate">{c.name}</h3>
                    {c.home_page_mode === "custom" && (
                      <span
                        title="Only shown on selected custom home pages"
                        className="text-xs rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[var(--color-accent)] border border-[var(--color-accent)]/30"
                      >
                        Custom
                      </span>
                    )}
                    {!c.published && (
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground border border-border">
                        Draft
                      </span>
                    )}
                    {(() => {
                      const s = categoryTranslationStatus(c);
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
                  <p className="text-xs text-muted-foreground truncate">/{c.slug} · {c.tagline}</p>
                  {c.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  )}
                  {c.home_page_mode === "custom" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Custom home page:</span>
                      {(customHomePagesByCategory[c.id] ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">No custom home pages</span>
                      ) : (
                        (customHomePagesByCategory[c.id] ?? []).map((p) => (
                          <Link
                            key={p.id}
                            to="/admin/custom-home-pages/$id"
                            params={{ id: p.id }}
                            className="text-xs rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/20"
                          >
                            {p.name}
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button
                  title={c.published ? "Unpublish" : "Publish"}
                  onClick={() => togglePublish.mutate(c)}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  {c.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <Link
                  to="/admin/category/$id"
                  params={{ id: c.id }}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  title="Delete"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete "${c.name}"?`,
                      description: "This will permanently delete the category and all its content.",
                      confirmLabel: "Delete",
                      destructive: true,
                    });
                    if (ok) deleteMut.mutate(c.id);
                  }}
                  className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          />

        )}
      </div>
    </div>
  );
}

function NewCategoryForm({
  onCancel,
  onSubmit,
  busy,
}: {
  onCancel: () => void;
  onSubmit: (v: {
    name: string;
    slug: string;
    tagline: string;
    description: string;
    icon_url: string | null;
    published: boolean;
    home_page_mode: "default" | "custom";
    name_es: string | null;
    tagline_es: string | null;
    description_es: string | null;
  }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [published, setPublished] = useState(true);
  const [homePageMode, setHomePageMode] = useState<"default" | "custom">("default");
  const [nameEs, setNameEs] = useState("");
  const [taglineEs, setTaglineEs] = useState("");
  const [descriptionEs, setDescriptionEs] = useState("");
  const [showEs, setShowEs] = useState(false);
  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: name.trim(),
          slug: slug.trim() || slugify(name),
          tagline: tagline.trim(),
          description: description.trim(),
          icon_url: iconUrl,
          published,
          home_page_mode: homePageMode,
          name_es: nameEs.trim() || null,
          tagline_es: taglineEs.trim() || null,
          description_es: descriptionEs.trim() || null,
        });
      }}
      className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-4"
    >
      <h2 className="font-display text-lg font-semibold">New category</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Slug">
          <input
            required
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
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
      <Field label="Tagline">
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>
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

      <Field label="Home Page">
        <select
          value={homePageMode}
          onChange={(e) => setHomePageMode(e.target.value as "default" | "custom")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="default">Default (main home page + all custom home pages)</option>
          <option value="custom">Custom (only on selected custom home pages)</option>
        </select>
      </Field>

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Published (visible to the public)
      </label>

      {showEs ? (
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold">Spanish translation</h3>
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
          <Field label="Name (ES)">
            <input
              value={nameEs}
              onChange={(e) => setNameEs(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Tagline (ES)">
            <input
              value={taglineEs}
              onChange={(e) => setTaglineEs(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
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

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
