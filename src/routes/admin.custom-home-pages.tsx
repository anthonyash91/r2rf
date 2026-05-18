import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/categories";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

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

type CustomHomePage = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
};

export const Route = createFileRoute("/admin/custom-home-pages")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminCustomHomePagesList,
});

function AdminCustomHomePagesList() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin", "custom_home_pages"],
    queryFn: async (): Promise<CustomHomePage[]> => {
      const { data, error } = await supabase
        .from("custom_home_pages")
        .select("id, slug, name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustomHomePage[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: { name: string; slug: string }) => {
      const finalSlug = slugify(input.slug || input.name);
      if (!finalSlug) throw new Error("Slug is required");
      if (RESERVED_SLUGS.has(finalSlug)) {
        throw new Error(`"/${finalSlug}" is reserved. Choose a different slug.`);
      }
      const { data, error } = await supabase
        .from("custom_home_pages")
        .insert({ name: input.name.trim(), slug: finalSlug })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Custom home page created");
      setCreating(false);
      setName("");
      setSlug("");
      setSlugTouched(false);
      qc.invalidateQueries({ queryKey: ["admin", "custom_home_pages"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_home_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "custom_home_pages"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Custom home pages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create alternate landing pages at custom URLs (e.g. <code>/cpc</code>) that show only the categories you choose.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New custom home page
        </button>
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ name, slug });
          }}
          className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold">New custom home page</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g. CPC"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Internal label, only shown in admin.</p>
            </label>
            <label className="block">
              <span className="text-sm font-medium">URL slug</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/</span>
                <input
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    setSlugTouched(true);
                  }}
                  placeholder="cpc"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Visitors will reach this page at the URL above.</p>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {createMut.isPending ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : pages.length === 0 ? (
          <div className="p-6 text-muted-foreground">No custom home pages yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {pages.map((p) => (
              <li key={p.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-semibold truncate">{p.name || p.slug}</h3>
                  <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                </div>
                <a
                  href={`/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open"
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Link
                  to="/admin/custom-home-pages/$id"
                  params={{ id: p.id }}
                  title="Edit"
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  title="Delete"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete "${p.name || p.slug}"?`,
                      description: `This permanently deletes the /${p.slug} page. Underlying categories are not affected.`,
                      confirmLabel: "Delete",
                      destructive: true,
                    });
                    if (ok) deleteMut.mutate(p.id);
                  }}
                  className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
