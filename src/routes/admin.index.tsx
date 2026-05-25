import { createFileRoute, Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Eye, EyeOff, Sparkles, RefreshCw, ExternalLink, LayoutGrid, Loader2, GripVertical } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { isMutationPendingFor } from "@/hooks/use-row-pending";
import { useServerFn } from "@tanstack/react-start";
import { generateCategoryCopy } from "@/lib/category-ai.functions";
import { generateUniqueCategoryIcon, resolveCategoryIcon } from "@/lib/category-icons";

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

import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useTranslateToSpanish, TranslatingIndicator } from "@/components/TranslateButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { BulkActionBar } from "@/components/BulkActionBar";
import { IconButton, TooltipWrap, iconButtonClassName } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";


export const Route = createFileRoute("/admin/")({
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  const qc = useQueryClient();
  useAuth();
  const confirmDelete = useConfirmDelete();
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

  const { data: itemsByCategory = {} } = useQuery({
    queryKey: ["admin", "category-items"],
    queryFn: async (): Promise<Record<string, { id: string; title: string; published: boolean; sort_order: number }[]>> => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, category_id, title, published, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const map: Record<string, { id: string; title: string; published: boolean; sort_order: number }[]> = {};
      for (const row of (data ?? []) as { id: string; category_id: string; title: string; published: boolean; sort_order: number }[]) {
        (map[row.category_id] ??= []).push({ id: row.id, title: row.title, published: row.published, sort_order: row.sort_order });
      }
      return map;
    },
  });
  const itemCountsByCategory: Record<string, number> = Object.fromEntries(
    Object.entries(itemsByCategory).map(([k, v]) => [k, v.length])
  );

  const createMut = useMutation({
    mutationFn: async (input: {
      name: string;
      slug: string;
      tagline: string;
      description: string;
      published: boolean;
      home_page_mode: "default" | "custom";
      name_es: string | null;
      tagline_es: string | null;
      description_es: string | null;
      icon_name: string | null;
      icon_color: string | null;
    }) => {
      let iconName = input.icon_name;
      let iconColor = input.icon_color;
      if (!iconName || !iconColor) {
        const generated = generateUniqueCategoryIcon({
          usedNames: categories.map((c) => c.icon_name),
          usedColors: categories.map((c) => c.icon_color),
          title: input.name,
        });
        iconName = generated.icon_name;
        iconColor = generated.icon_color;
      }
      const { error } = await supabase.from("categories").insert({
        name: input.name,
        slug: input.slug,
        tagline: input.tagline,
        description: input.description,
        icon_url: null,
        icon_name: iconName,
        icon_color: iconColor,
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

  const bulk = useBulkSelect();
  const deleteManyMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("categories").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: async (deleted) => {
      toast.success(`Deleted ${deleted} ${deleted === 1 ? "category" : "categories"}`);
      await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      bulk.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const [searchQuery, setSearchQuery] = useState("");

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
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          icon={LayoutGrid}
          title="Categories"
          count={!isLoading ? categories.length : undefined}
          description="Manage the library structure."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <LoadingButton
            onClick={() => setCreating(true)}
            disabled={creating}
            icon={<Plus className="h-4 w-4" />}
          >
            New category
          </LoadingButton>
        </div>
      </div>

      <section className="mt-8">
      {creating && (
        <NewCategoryForm
          onCancel={() => setCreating(false)}
          onSubmit={(values) => createMut.mutate(values)}
          busy={createMut.isPending}
          usedIconNames={categories.map((c) => c.icon_name)}
          usedIconColors={categories.map((c) => c.icon_color)}
        />
      )}

      {(() => {
        const q = searchQuery.trim().toLowerCase();
        const filteredOrder = q
          ? order.filter((c) =>
              [c.name, c.slug, c.tagline, c.description]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q)),
            )
          : order;
        return (
          <>
      {categories.length > 0 && (
        <BulkActionBar
          bulk={bulk}
          filteredCount={filteredOrder.length}
          totalCount={categories.length}
          isFiltered={Boolean(q)}
          noun={{ singular: "category", plural: "categories" }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search categories…"
          onDeleteSelected={async (ids) =>
            confirmDelete({
              title: `Delete ${ids.length} ${ids.length === 1 ? "category" : "categories"}?`,
              description: `This will permanently delete ${ids.length === 1 ? "the selected category" : `${ids.length} selected categories`} and all their content.`,
              onConfirm: () => deleteManyMut.mutateAsync(ids),
            })
          }
        />
      )}
          </>
        );
      })()}

      {(() => {
        const renderCategoryRow = (c: Category) => (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 pt-[17px] pr-6 pb-[24px] sm:pb-[19px] pl-3">
            <div className="flex items-stretch sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
              {(() => {
                const Icon = resolveCategoryIcon(c.icon_name);
                const color = c.icon_color || "var(--color-accent)";
                return (
                  <div
                    className="flex w-12 self-stretch sm:self-auto sm:h-12 items-center justify-center rounded-lg border shrink-0"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
                      borderColor: `color-mix(in oklab, ${color} 25%, transparent)`,
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.75} />
                  </div>
                );
              })()}
              <div className="@container flex-1 min-w-0">
                <div className="flex flex-col-reverse gap-y-1 pt-[7px] @lg:pt-0 @lg:flex-row @lg:flex-nowrap @lg:items-center @lg:gap-x-2">
                  <h3 className="font-display text-lg font-semibold break-words min-w-0">{c.name}</h3>
                  {(() => {
                    const s = categoryTranslationStatus(c);
                    const trLabel = s === "missing" ? "Needs ES" : "Partially translated";
                    const trTitle = s === "missing" ? "Missing Spanish translation" : "Some Spanish fields are missing";
                    return (
                      <BadgeGroup>
                        <Badge variant="count" title="Content items in this category" className="tabular-nums">
                          {itemCountsByCategory[c.id] ?? 0} {((itemCountsByCategory[c.id] ?? 0) === 1) ? "item" : "items"}
                        </Badge>
                        {c.home_page_mode === "custom" && (
                          <Badge variant="custom" title="Only shown on selected custom home pages">Custom</Badge>
                        )}
                        {!c.published && <Badge variant="draft">Draft</Badge>}
                        {s !== "complete" && (
                          <Badge variant="translation" title={trTitle}>
                            {trLabel}
                          </Badge>
                        )}
                      </BadgeGroup>
                    );
                  })()}
                </div>
                <p className="mt-1 text-xs text-muted-foreground break-words">/{c.slug} · {c.tagline}</p>
                {c.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                )}
                {(itemsByCategory[c.id]?.length ?? 0) > 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Courses:</span>{" "}
                    {(itemsByCategory[c.id] ?? []).map((item, i) => (
                      <span key={item.id}>
                        {i > 0 && ", "}
                        {c.published && item.published ? (
                          <Link
                            to="/category/$slug"
                            params={{ slug: c.slug }}
                            hash={`item-${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          <span>
                            {item.title}
                            {!item.published && <span className="ml-1 text-xs italic">(draft)</span>}
                          </span>
                        )}
                      </span>
                    ))}
                  </p>
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
                          className="rounded-full hover:opacity-80 transition-opacity"
                        >
                          <Badge variant="facility">{p.name}</Badge>
                        </Link>
                      ))
                    )}
                  </div>
                )}

              </div>
            </div>
            <TooltipProvider delayDuration={150}>
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                <IconButton
                  aria-label={c.published ? "Unpublish" : "Publish"}
                  tooltip={c.published ? "Unpublish" : "Publish"}
                  icon={
                    togglePublish.isPending && (togglePublish.variables as any)?.id === c.id
                      ? Eye // ignored, spinner shown
                      : c.published
                      ? Eye
                      : EyeOff
                  }
                  pending={togglePublish.isPending && (togglePublish.variables as any)?.id === c.id}
                  onClick={() => togglePublish.mutate(c)}
                />
                {c.published ? (
                  <TooltipWrap tooltip="View on site">
                    <Link
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View on site"
                      className={iconButtonClassName()}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </TooltipWrap>
                ) : (
                  <TooltipWrap tooltip="Unavailable while draft">
                    <span
                      aria-label="View on site (unavailable for drafts)"
                      aria-disabled="true"
                      className={iconButtonClassName("default", "opacity-50 cursor-not-allowed")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  </TooltipWrap>
                )}
                <TooltipWrap tooltip="Edit">
                  <Link
                    to="/admin/category/$id"
                    params={{ id: c.id }}
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
                  pending={isMutationPendingFor(deleteMut, c.id)}
                  onClick={async () => {
                    await confirmDelete({
                      title: `Delete "${c.name}"?`,
                      description: "This will permanently delete the category and all its content.",
                      onConfirm: () => deleteMut.mutateAsync(c.id),
                    });
                  }}
                />
              </div>
            </TooltipProvider>
          </div>
        );

        const q = searchQuery.trim().toLowerCase();
        const filteredOrder = q
          ? order.filter((c) =>
              [c.name, c.slug, c.tagline, c.description]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q)),
            )
          : order;
        return (
          <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${categories.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
            {isLoading ? (
              <EmptyState>Loading…</EmptyState>
            ) : categories.length === 0 ? (
              <EmptyState>No categories yet.</EmptyState>
            ) : filteredOrder.length === 0 ? (
              <EmptyState>No categories match your search.</EmptyState>
            ) : bulk.editMode || q ? (
              <ul className="divide-y divide-border">
                {filteredOrder.map((c) => {
                  const selected = bulk.has(c.id);
                  const isInteractive = bulk.editMode;
                  return (
                    <li
                      key={c.id}
                      onClick={isInteractive ? () => bulk.toggle(c.id) : undefined}
                      className={`flex items-stretch transition-colors ${
                        isInteractive ? "cursor-pointer " : ""
                      }${
                        selected ? "bg-destructive/10 hover:bg-destructive/15" : isInteractive ? "hover:bg-muted/50" : ""
                      }`}
                    >
                      {(bulk.editMode || q) && (
                        <div
                          className={`flex items-center pl-5 pr-0 ${bulk.editMode ? "text-muted-foreground/50" : "text-muted-foreground/30 cursor-not-allowed"}`}
                          aria-disabled={!bulk.editMode}
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      )}

                      <div className={`flex-1 min-w-0 ${bulk.editMode ? "pointer-events-none" : ""}`}>{renderCategoryRow(c)}</div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <SortableList
                className="divide-y divide-border"
                items={order}
                onReorder={(next) => { setOrder(next); reorderMut.mutate(next); }}
                renderItem={(c) => renderCategoryRow(c)}
              />
            )}
          </div>
        );
      })()}
      </section>
    </div>
  );
}

function NewCategoryForm({
  onCancel,
  onSubmit,
  busy,
  usedIconNames,
  usedIconColors,
}: {
  onCancel: () => void;
  onSubmit: (v: {
    name: string;
    slug: string;
    tagline: string;
    description: string;
    published: boolean;
    home_page_mode: "default" | "custom";
    name_es: string | null;
    tagline_es: string | null;
    description_es: string | null;
    icon_name: string | null;
    icon_color: string | null;
  }) => void;
  busy: boolean;
  usedIconNames: (string | null)[];
  usedIconColors: (string | null)[];
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [published, setPublished] = useState(true);
  const [homePageMode, setHomePageMode] = useState<"default" | "custom">("default");
  const [nameEs, setNameEs] = useState("");
  const [taglineEs, setTaglineEs] = useState("");
  const [descriptionEs, setDescriptionEs] = useState("");
  const [showEs, setShowEs] = useState(false);
  const [iconName, setIconName] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState<string | null>(null);
  const [iconKeywords, setIconKeywords] = useState("");
  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();
  const generate = useServerFn(generateCategoryCopy);
  const [generating, setGenerating] = useState(false);

  function handleGenerateIcon() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a name first");
      return;
    }
    const kw = iconKeywords.trim();
    const next = generateUniqueCategoryIcon({
      usedNames: usedIconNames,
      usedColors: usedIconColors,
      title: kw ? `${trimmed} ${kw}` : trimmed,
    });
    setIconName(next.icon_name);
    setIconColor(next.icon_color);
  }


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
          published,
          home_page_mode: homePageMode,
          name_es: nameEs.trim() || null,
          tagline_es: taglineEs.trim() || null,
          description_es: descriptionEs.trim() || null,
          icon_name: iconName,
          icon_color: iconColor,
        });
      }}
      className="mt-6 mb-8 rounded-2xl border border-border bg-card p-6 pt-[18px] space-y-4"
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
            className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
        </Field>
        <Field label="Slug">
          <input
            required
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
        </Field>
      </div>
      <div>
        <LoadingButton
          variant="secondary"
          onClick={handleAutoGenerate}
          disabled={generating || !name.trim()}
          pending={generating}
          pendingText="Generating…"
          icon={<Sparkles className="h-4 w-4" />}
        >
          Auto-generate tagline & description
        </LoadingButton>
        <p className="mt-1 text-xs text-muted-foreground">Uses the Name to draft copy. You can edit the result.</p>
      </div>
      <Field label="Tagline">
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
        />
      </Field>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
        />
      </label>

      <div>
        <span className="text-sm font-medium">Icon</span>
        <div className="mt-2 flex items-start gap-4">
          {(() => {
            const Icon = resolveCategoryIcon(iconName);
            const color = iconColor || "var(--color-accent)";
            const hasIcon = !!iconName;
            return (
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  backgroundColor: hasIcon
                    ? `color-mix(in oklab, ${color} 12%, transparent)`
                    : "transparent",
                  borderColor: hasIcon
                    ? `color-mix(in oklab, ${color} 25%, transparent)`
                    : "var(--border)",
                  borderStyle: hasIcon ? "solid" : "dashed",
                }}
              >
                {hasIcon ? (
                  <Icon className="h-7 w-7" style={{ color }} strokeWidth={1.75} />
                ) : (
                  <span className="text-[10px] text-muted-foreground text-center px-1">No icon yet</span>
                )}
              </div>
            );
          })()}



          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={iconKeywords}
              onChange={(e) => setIconKeywords(e.target.value)}
              placeholder="Optional keywords for a better result (e.g. coffee, gym, books)"
              className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <LoadingButton
                variant="secondary"
                onClick={handleGenerateIcon}
                disabled={!name.trim()}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                {iconName ? "Regenerate icon" : "Generate icon"}
              </LoadingButton>
              <p className="text-xs text-muted-foreground">
                Generate an icon preview.
              </p>

            </div>
          </div>
        </div>
      </div>




      <Field label="Home Page">
        <Select value={homePageMode} onValueChange={(v) => setHomePageMode(v as "default" | "custom")}>
          <SelectTrigger className="w-full shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default (main home page + all custom home pages)</SelectItem>
            <SelectItem value="custom">Custom (only on selected custom home pages)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <label className="inline-flex items-center gap-2 text-sm">
        <Checkbox checked={published} onCheckedChange={(v) => setPublished(Boolean(v))} />
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
              <LoadingButton
                variant="secondary"
                disabled={addEsBusy}
                pending={addEsBusy}
                pendingText="Translating…"
                icon={<RefreshCw className="h-3 w-3" />}
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
              >
                Regenerate
              </LoadingButton>
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
              className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
          </Field>
          <Field label="Tagline (ES)">
            <input
              value={taglineEs}
              onChange={(e) => setTaglineEs(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
          </Field>
          <label className="block">
            <span className="text-sm font-medium">Description (ES)</span>
            <textarea
              rows={3}
              value={descriptionEs}
              onChange={(e) => setDescriptionEs(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
          </label>
        </div>
      ) : (
        <div className="border-t border-border pt-4">
          <LoadingButton
            variant="secondary"
            disabled={addEsBusy}
            pending={addEsBusy}
            pendingText="Translating…"
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
          >
            + Add Spanish translation
          </LoadingButton>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <LoadingButton
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </LoadingButton>
        <LoadingButton
          type="submit"
          pending={busy}
          pendingText="Creating…"
        >
          Create
        </LoadingButton>
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
