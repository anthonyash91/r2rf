import { createFileRoute, Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink, LayoutTemplate } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { isMutationPendingFor } from "@/hooks/use-row-pending";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton, TooltipWrap, iconButtonClassName } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { listFacilities } from "@/lib/facilities.functions";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { Badge } from "@/components/Badge";


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
  const confirmDelete = useConfirmDelete();
  
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

  const fetchFacilities = useServerFn(listFacilities);
  const { data: facilitiesData } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const facilities = facilitiesData?.facilities ?? [];
  const usedFacilityLabels = useMemo(
    () => new Set(pages.map((p) => p.name)),
    [pages],
  );

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
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          icon={LayoutTemplate}
          title="Custom Home Pages"
          description={
            <>
              Create alternate landing pages at custom URLs (e.g. <code>/cpc</code>) that show only the categories you choose.
            </>
          }
        />
        <LoadingButton
          onClick={() => setCreating(true)}
          disabled={creating}
          icon={<Plus className="h-4 w-4 shrink-0" />}
          className="whitespace-nowrap shrink-0"
        >
          New custom home page
        </LoadingButton>
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
              <span className="text-sm font-medium">Facility</span>
              <FacilityCombobox
                value={name}
                onChange={(label) => {
                  setName(label);
                  if (!slugTouched) setSlug(slugify(label));
                }}
                options={facilities.map((f) => {
                  const taken = usedFacilityLabels.has(f.label);
                  return {
                    value: f.label,
                    label: f.label,
                    disabled: taken,
                    suffix: taken ? "(in use)" : undefined,
                  };
                })}
                placeholder="Select a facility"
                triggerClassName="mt-1 h-[38px]"
                emptyMessage={facilities.length === 0 ? "No facilities" : "No facility found."}
              />
              <p className="mt-1 text-xs text-muted-foreground">This custom home page is for the selected facility.</p>
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
                  className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
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
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
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
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
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
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) => {
                      if (v) setSelected(new Set(categories.map((c) => c.id)));
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
                      <label className="flex items-center gap-4 py-2.5 px-5 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            });
                          }}
                        />

                        <CategoryIcon name={c.icon_name} color={c.icon_color} className="h-8 w-8" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{c.name}</span>
                            {!c.published && (
                              <Badge variant="draft">Draft</Badge>
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
                      <summary className="flex items-center justify-between gap-2 px-5 py-2 cursor-pointer select-none text-sm font-medium hover:bg-muted/50">
                        <span>
                          {title}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({selectedInGroup}/{items.length} selected)
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground group-open:rotate-90 transition-transform">▶</span>
                      </summary>
                      {items.length === 0 ? (
                        <p className="px-5 py-2 text-xs text-muted-foreground italic border-t border-border">None</p>
                      ) : (
                        <ul className="divide-y divide-border border-t border-border">{items.map(renderRow)}</ul>
                      )}
                    </details>
                  );
                };
                return (
                  <div className="space-y-2">
                    <Group title="Custom categories" items={customCats} />
                    <Group title="Default categories" items={defaultCats} />
                  </div>
                );
              })()
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Only published categories appear publicly, even if drafts are selected.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <LoadingButton
              variant="secondary"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
            >
              Cancel
            </LoadingButton>
            <LoadingButton
              type="submit"
              pending={createMut.isPending}
              pendingText="Creating…"
            >
              Create
            </LoadingButton>
          </div>
        </form>
      )}

      <SectionCard as="div" padded={false} className="mt-8 overflow-hidden">
        {isLoading ? (
          <EmptyState>Loading…</EmptyState>
        ) : pages.length === 0 ? (
          <EmptyState>No custom home pages yet.</EmptyState>
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
                    <Badge
                      key={c.id}
                      variant={excluded ? "draft" : "category"}
                      className={excluded ? "[text-decoration:line-through_dotted]" : ""}
                    >
                      {c.name}
                    </Badge>
                  ))}
                </>
              );

              return (
              <li key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-6">
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
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <TooltipWrap tooltip="Open">
                      <a
                        href={`/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open"
                        className={iconButtonClassName()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TooltipWrap>
                    <TooltipWrap tooltip="Edit">
                      <Link
                        to="/admin/custom-home-pages/$id"
                        params={{ id: p.id }}
                        aria-label="Edit"
                        className={iconButtonClassName()}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </TooltipWrap>
                    <div className="mx-1 h-6 w-px bg-border" aria-hidden />
                    <IconButton
                      aria-label="Delete"
                      tooltip="Delete"
                      pendingTooltip="Deleting…"
                      variant="destructive"
                      icon={Trash2}
                      pending={isMutationPendingFor(deleteMut, p.id)}
                      onClick={async () => {
                        await confirmDelete({
                          title: `Delete "${p.name || p.slug}"?`,
                          description: `This permanently deletes the /${p.slug} page. Underlying categories are not affected.`,
                          onConfirm: () => deleteMut.mutateAsync(p.id),
                        });
                      }}
                    />
                  </div>
                </TooltipProvider>
              </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
