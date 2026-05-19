import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";

const RESERVED_SLUGS = new Set([
  "admin",
  "auth",
  "spanish",
  "category",
  "api",
  "login",
  "signup",
  "logout",
]);

export const Route = createFileRoute("/admin/custom-home-pages/$id")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminCustomHomePageEdit,
});

function AdminCustomHomePageEdit() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "custom_home_page", id],
    queryFn: async () => {
      const { data: page, error: e1 } = await supabase
        .from("custom_home_pages")
        .select("id, slug, name, description")
        .eq("id", id)
        .maybeSingle();
      if (e1) throw e1;

      const { data: links, error: e2 } = await supabase
        .from("custom_home_page_categories")
        .select("category_id, sort_order")
        .eq("custom_home_page_id", id)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;

      return { page, selectedIds: (links ?? []).map((l) => l.category_id) };
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories", "all"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data?.page) {
      setName(data.page.name ?? "");
      setSlug(data.page.slug ?? "");
      setDescription((data.page as any).description ?? "");
    }
    if (data?.selectedIds && categories.length > 0) {
      setSelected(new Set<string>(data.selectedIds));
    }
  }, [data, categories]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const finalSlug = slugify(slug);
      if (!finalSlug) throw new Error("Slug is required");
      if (RESERVED_SLUGS.has(finalSlug)) {
        throw new Error(`"/${finalSlug}" is reserved. Choose a different slug.`);
      }

      const { error: e1 } = await supabase
        .from("custom_home_pages")
        .update({ name: name.trim(), slug: finalSlug, description: description.trim() })
        .eq("id", id);
      if (e1) throw e1;

      // Replace selections
      const { error: e2 } = await supabase
        .from("custom_home_page_categories")
        .delete()
        .eq("custom_home_page_id", id);
      if (e2) throw e2;

      const orderedIds = categories
        .filter((c) => selected.has(c.id))
        .map((c) => c.id);

      if (orderedIds.length > 0) {
        const rows = orderedIds.map((cid, idx) => ({
          custom_home_page_id: id,
          category_id: cid,
          sort_order: idx,
        }));
        const { error: e3 } = await supabase
          .from("custom_home_page_categories")
          .insert(rows);
        if (e3) throw e3;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "custom_home_page", id] });
      qc.invalidateQueries({ queryKey: ["admin", "custom_home_pages"] });
      qc.invalidateQueries({ queryKey: ["admin", "categories", "all"] });
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["custom-home"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedCount = selected.size;
  const allChecked = useMemo(
    () => categories.length > 0 && categories.every((c) => selected.has(c.id)),
    [categories, selected],
  );

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (!data?.page) {
    return (
      <div>
        <Link to="/admin/custom-home-pages" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="mt-6 text-muted-foreground">Custom home page not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/admin/custom-home-pages" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to custom home pages
      </Link>

      <form
        onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
        className="mt-6 space-y-6"
      >
        <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold">Edit custom home page</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                The header and certificate sections match the default home page. Choose which categories are visible here.
              </p>
            </div>
            <a
              href={`/${data.page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted shrink-0"
            >
              <ExternalLink className="h-4 w-4" /> View
            </a>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">URL slug</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/</span>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this custom home page for? (admin note)"
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">Optional, admin-only note.</p>
          </label>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Categories shown on this page</h2>
              <p className="text-sm text-muted-foreground">
                {selectedCount} selected · order follows the default category order.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => {
                  if (e.target.checked) setSelected(new Set(categories.map((c) => c.id)));
                  else setSelected(new Set());
                }}
              />
              Select all
            </label>
          </div>

          {categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">No categories exist yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {categories.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-4 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      {c.icon_url ? (
                        <img
                          src={c.icon_url}
                          alt=""
                          className="h-10 w-10 object-cover border border-border bg-muted shrink-0 rounded-md"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg border border-dashed border-border bg-muted/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{c.name}</span>
                          {!c.published && (
                            <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">/{c.slug}</p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Only published categories appear publicly on the custom home page, even if drafts are selected here.
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saveMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
