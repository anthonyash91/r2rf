import { createFileRoute, Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { ArrowLeft, Save, ExternalLink, LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/Badge";
import { LabeledInput, LabeledTextarea } from "@/components/FormField";
import { LoadingButton, actionButtonClassName } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";


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

const IP_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const parseIps = (text: string): string[] => {
  const parts = text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(parts));
};

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
        .select("id, slug, name, description, allowed_ips")
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
  const [allowedIpsText, setAllowedIpsText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data?.page) {
      setName(data.page.name ?? "");
      setSlug(data.page.slug ?? "");
      setDescription((data.page as any).description ?? "");
      const ips = ((data.page as any).allowed_ips ?? []) as string[];
      setAllowedIpsText(ips.join("\n"));
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
      const allowedIps = parseIps(allowedIpsText);
      const invalidIps = allowedIps.filter((ip) => !IP_REGEX.test(ip));
      if (invalidIps.length > 0) {
        throw new Error(`Invalid IPv4 address(es): ${invalidIps.join(", ")}`);
      }

      const { error: e1 } = await supabase
        .from("custom_home_pages")
        .update({ name: name.trim(), slug: finalSlug, description: description.trim(), allowed_ips: allowedIps })
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
        <SectionCard className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <PageHeader
              size="md"
              icon={LayoutTemplate}
              title="Edit custom home page"
              description="The header and certificate sections match the default home page. Choose which categories are visible here."
            />
            <a
              href={`/${data.page.slug}`}
              target="_blank"
              rel="noreferrer"
              className={actionButtonClassName("secondary", "shrink-0")}
            >
              <ExternalLink className="h-4 w-4" /> View
            </a>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <LabeledInput
              label="Name"
              required
              value={name}
              onChange={setName}
            />
            <label className="block">
              <span className="text-sm font-medium">URL slug</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/</span>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
              </div>
            </label>
          </div>

          <LabeledTextarea
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="What is this custom home page for? (admin note)"
            description="Optional, admin-only note."
          />

          <LabeledTextarea
            label="Whitelist IPs"
            value={allowedIpsText}
            onChange={setAllowedIpsText}
            placeholder="Leave blank for public access. One IPv4 per line, or comma-separated."
            inputClassName="font-mono"
            description="If empty, anyone with the link can access this page. If one or more IPs are listed, only those IPs can access it."
          />
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Categories shown on this page</h2>
              <p className="text-sm text-muted-foreground">
                {selectedCount} selected · order follows the default category order.
              </p>
            </div>
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
          </div>

          {categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">No categories exist yet.</p>
          ) : (
            (() => {
              const defaultCats = categories.filter((c) => c.home_page_mode === "default");
              const customCats = categories.filter((c) => c.home_page_mode === "custom");
              const renderRow = (c: Category) => {
                const checked = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-4 py-3 px-5 cursor-pointer">
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
                            <Badge variant="draft">Draft</Badge>
                          )}

                        </div>
                        <p className="text-xs text-muted-foreground truncate">/{c.slug}</p>
                      </div>
                    </label>
                  </li>
                );
              };
              const renderGroup = (title: string, items: Category[]) => {
                const selectedInGroup = items.filter((c) => selected.has(c.id)).length;
                return (
                  <details key={title} open className="rounded-md border border-border group mt-[15px]">
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
                  {renderGroup("Custom categories", customCats)}
                  {renderGroup("Default categories", defaultCats)}
                </div>
              );
            })()
          )}
          <p className="text-xs text-muted-foreground my-[8px] mt-[8px]">
            Only published categories appear publicly on the custom home page, even if drafts are selected here.
          </p>
        </SectionCard>

        <div className="flex justify-end">
          <LoadingButton
            type="submit"
            pending={saveMut.isPending}
            pendingText="Saving…"
            icon={<Save className="h-4 w-4" />}
          >
            Save
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
