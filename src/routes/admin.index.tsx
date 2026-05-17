import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { SortableList } from "@/components/SortableList";

export const Route = createFileRoute("/admin/")({
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  const qc = useQueryClient();
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

  const createMut = useMutation({
    mutationFn: async (input: { name: string; slug: string; tagline: string }) => {
      const { error } = await supabase.from("categories").insert({
        name: input.name,
        slug: input.slug,
        tagline: input.tagline,
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the library structure.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/home"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Edit home header
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold truncate">{c.name}</h3>
                    {!c.published && (
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">/{c.slug} · {c.tagline}</p>
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
                  onClick={() => {
                    if (confirm(`Delete "${c.name}" and all its content?`)) deleteMut.mutate(c.id);
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
  onSubmit: (v: { name: string; slug: string; tagline: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), slug: slug.trim() || slugify(name), tagline: tagline.trim() });
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
      <Field label="Tagline">
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm hover:bg-muted">
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
