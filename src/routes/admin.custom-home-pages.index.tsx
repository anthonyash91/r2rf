import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

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
  description: string;
  created_at: string;
};

export const Route = createFileRoute("/admin/custom-home-pages/")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminCustomHomePagesList,
});

function AdminCustomHomePagesList() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [allowedIpsText, setAllowedIpsText] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const IP_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  const parseIps = (text: string): string[] => {
    const parts = text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    return Array.from(new Set(parts));
  };

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin", "custom_home_pages"],
    queryFn: async (): Promise<CustomHomePage[]> => {
      const { data, error } = await supabase
        .from("custom_home_pages")
        .select("id, slug, name, description, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustomHomePage[];
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

  const { data: pageCategoryIds = {} } = useQuery({
    queryKey: ["admin", "custom_home_pages", "categories"],
    queryFn: async (): Promise<Record<string, Set<string>>> => {
      const { data, error } = await supabase
        .from("custom_home_page_categories")
        .select("custom_home_page_id, category_id");
      if (error) throw error;
      const map: Record<string, Set<string>> = {};
      for (const row of (data ?? []) as { custom_home_page_id: string; category_id: string }[]) {
        (map[row.custom_home_page_id] ??= new Set()).add(row.category_id);
      }
      return map;
    },
  });

  const allChecked = useMemo(
    () => categories.length > 0 && categories.every((c) => selected.has(c.id)),
    [categories, selected],
  );

  const defaultIds = useMemo(
    () => categories.filter((c) => c.home_page_mode === "default").map((c) => c.id),
    [categories],
  );

  // Pre-check default-mode categories whenever the form opens or categories load.
  useEffect(() => {
    if (creating) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of defaultIds) next.add(id);
        return next;
      });
    }
  }, [creating, defaultIds]);

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setAllowedIpsText("");
    setSlugTouched(false);
    setSelected(new Set(defaultIds));
  };

  const createMut = useMutation({
    mutationFn: async (input: {
      name: string;
      slug: string;
      description: string;
      allowedIps: string[];
      selectedIds: string[];
    }) => {
      const finalSlug = slugify(input.slug || input.name);
      if (!finalSlug) throw new Error("Slug is required");
      if (RESERVED_SLUGS.has(finalSlug)) {
        throw new Error(`"/${finalSlug}" is reserved. Choose a different slug.`);
      }
      const invalidIps = input.allowedIps.filter((ip) => !IP_REGEX.test(ip));
      if (invalidIps.length > 0) {
        throw new Error(`Invalid IPv4 address(es): ${invalidIps.join(", ")}`);
      }

      const { data, error } = await supabase
        .from("custom_home_pages")
        .insert({
          name: input.name.trim(),
          slug: finalSlug,
          description: input.description.trim(),
          allowed_ips: input.allowedIps,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (input.selectedIds.length > 0) {
        const rows = input.selectedIds.map((cid, idx) => ({
          custom_home_page_id: data.id,
          category_id: cid,
          sort_order: idx,
        }));
        const { error: e2 } = await supabase
          .from("custom_home_page_categories")
          .insert(rows);
        if (e2) throw e2;
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Custom home page created");
      setCreating(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["admin", "custom_home_pages"] });
      qc.invalidateQueries({ queryKey: ["admin", "custom_home_pages", "categories"] });
      qc.invalidateQueries({ queryKey: ["admin", "categories", "all"] });
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["custom-home"] });
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

  // Order selected by category sort_order
  const orderedSelectedIds = useMemo(
    () => categories.filter((c) => selected.has(c.id)).map((c) => c.id),
    [categories, selected],
  );

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
          onClick={() => setCreating(true)}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
        >
          <Plus className="h-4 w-4 shrink-0" /> New custom home page
        </button>
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({
              name,
              slug,
              description,
              allowedIps: parseIps(allowedIpsText),
              selectedIds: orderedSelectedIds,
            });
          }}
          className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-6"
        >
          <div>
            <h2 className="font-display text-lg font-semibold">New custom home page</h2>
            <p className="text-sm text-muted-foreground">
              Set the name, URL, optional description, and pick which categories appear on this page.
            </p>
          </div>

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

          <label className="block">
            <span className="text-sm font-medium">Whitelist IPs</span>
            <textarea
              value={allowedIpsText}
              onChange={(e) => setAllowedIpsText(e.target.value)}
              placeholder="Leave blank for public access. One IPv4 per line, or comma-separated."
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If empty, anyone with the link can access this page. If one or more IPs are listed, only those IPs can access it.
            </p>
          </label>


          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-medium">Categories shown on this page</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.size} selected · order follows the default category order.
                </p>
              </div>
              {categories.length > 0 && (
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
              )}
            </div>

            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories exist yet.</p>
            ) : (
              (() => {
                const defaultCats = categories.filter((c) => c.home_page_mode === "default");
                const customCats = categories.filter((c) => c.home_page_mode === "custom");
                const renderRow = (c: Category) => {
                  const checked = selected.has(c.id);
                  return (
                    <li key={c.id}>
                      <label className="flex items-center gap-4 py-2.5 px-3 cursor-pointer">
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
                            className="h-8 w-8 rounded-lg object-cover border border-border bg-muted shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg border border-dashed border-border bg-muted/40 shrink-0" />
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
                };
                const Group = ({ title, items }: { title: string; items: Category[] }) => {
                  const selectedInGroup = items.filter((c) => selected.has(c.id)).length;
                  return (
                    <details open className="rounded-md border border-border group mt-[15px]">
                      <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none text-sm font-medium hover:bg-muted/50">
                        <span>
                          {title}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({selectedInGroup}/{items.length} selected)
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground group-open:rotate-90 transition-transform">▶</span>
                      </summary>
                      {items.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground italic border-t border-border">None</p>
                      ) : (
                        <ul className="divide-y divide-border border-t border-border">{items.map(renderRow)}</ul>
                      )}
                    </details>
                  );
                };
                return (
                  <div className="space-y-2">
                    <Group title="Default categories" items={defaultCats} />
                    <Group title="Custom categories" items={customCats} />
                  </div>
                );
              })()
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Only published categories appear publicly, even if drafts are selected.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {createMut.isPending ? "Creating…" : "Create"}
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
            {pages.map((p) => {
              const linked = pageCategoryIds[p.id] ?? new Set<string>();
              const excludedDefaults = categories.filter(
                (c) => c.home_page_mode === "default" && !linked.has(c.id),
              );
              const includedCustoms = categories.filter(
                (c) => c.home_page_mode === "custom" && linked.has(c.id),
              );
              const hasSections = excludedDefaults.length > 0 || includedCustoms.length > 0;
              const Chips = ({ items, excluded = false }: { items: Category[]; excluded?: boolean }) => (
                <>
                  {items.map((c) => (
                    <span
                      key={c.id}
                      className={
                        excluded
                          ? "text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground border border-border [text-decoration:line-through_dotted]"
                          : "text-xs rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[var(--color-accent)] border border-[var(--color-accent)]/30"
                      }
                    >
                      {c.name}
                    </span>
                  ))}
                </>
              );
              return (
              <li key={p.id} className={`flex items-center gap-4 p-4 pl-[24px]${hasSections ? " pb-[24px]" : ""}`}>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-semibold truncate">{p.name || p.slug}</h3>
                  <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                  {excludedDefaults.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Excluded default categories:</span>
                      <Chips items={excludedDefaults} excluded />
                    </div>
                  )}
                  {includedCustoms.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Included custom categories:</span>
                      <Chips items={includedCustoms} />
                    </div>
                  )}
                </div>
                <TooltipProvider delayDuration={150}>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open"
                          className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-input bg-background hover:bg-muted"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Open</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to="/admin/custom-home-pages/$id"
                          params={{ id: p.id }}
                          aria-label="Edit"
                          className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-input bg-background hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <div className="mx-1 h-6 w-px bg-border" aria-hidden />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          aria-label="Delete"
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Delete "${p.name || p.slug}"?`,
                              description: `This permanently deletes the /${p.slug} page. Underlying categories are not affected.`,
                              confirmLabel: "Delete",
                              destructive: true,
                            });
                            if (ok) deleteMut.mutate(p.id);
                          }}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
