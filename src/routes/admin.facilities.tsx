import { createFileRoute, Link } from "@tanstack/react-router";

import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, Users, Blocks, Link2, LayoutGrid, MessageSquare } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Pager } from "@/components/LoadMorePager";
import { useToastMutation } from "@/hooks/use-toast-mutation";
import { isMutationPendingFor } from "@/hooks/use-row-pending";
import {
  listFacilitiesWithStats,
  addFacilities,
  updateFacility,
  deleteFacility,
  deleteFacilities,
} from "@/lib/facilities.functions";

import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton } from "@/components/IconButton";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { BulkActionBar } from "@/components/BulkActionBar";



export const Route = createFileRoute("/admin/facilities")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminFacilitiesPage,
});

function AdminFacilitiesPage() {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();

  const fetchFacilities = useServerFn(listFacilitiesWithStats);
  const addFacilitiesFn = useServerFn(addFacilities);
  const updateFacilityFn = useServerFn(updateFacility);
  const deleteFacilityFn = useServerFn(deleteFacility);
  const deleteFacilitiesFn = useServerFn(deleteFacilities);

  const [showAdd, setShowAdd] = useState(false);
  const [newLabels, setNewLabels] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingCustomSlug, setEditingCustomSlug] = useState("");
  const [page, setPage] = useState(0);
  const bulk = useBulkSelect();
  const [searchQuery, setSearchQuery] = useState("");


  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilities(),
  });
  const allFacilities = facilitiesQuery.data?.facilities ?? [];
  const q = searchQuery.trim().toLowerCase();
  const facilities = q
    ? allFacilities.filter((f) =>
        [f.label, f.value].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      )
    : allFacilities;
  const visibleFacilities = facilities.slice(page * 10, (page + 1) * 10);


  const facilitiesKey = ["facilities"] as const;
  const invalidate = () => qc.invalidateQueries({ queryKey: facilitiesKey });

  const addMut = useToastMutation({
    mutationFn: (input: { facilities: { label: string }[] }) => addFacilitiesFn({ data: input }),
    invalidate: facilitiesKey,
    successMessage: null,
    onSuccess: (res) => {
      const dupes = res.duplicates ?? [];
      const addedMsg = `Added ${res.inserted} ${res.inserted === 1 ? "facility" : "facilities"}`;
      if (dupes.length) {
        const dupMsg = `Skipped ${dupes.length} duplicate${dupes.length === 1 ? "" : "s"}: ${dupes.join(", ")}`;
        if (res.inserted === 0) {
          toast.warning(dupMsg);
        } else {
          toast.success(`${addedMsg}. ${dupMsg}`);
        }
      } else {
        toast.success(addedMsg);
      }
      setNewLabels("");
      setShowAdd(false);
    },
  });

  const updateMut = useToastMutation({
    mutationFn: (input: { id: string; label: string; customSlug?: string | null }) => updateFacilityFn({ data: input }),
    successMessage: "Facility updated",
    invalidate: facilitiesKey,
    onSuccess: () => setEditingId(null),
  });
  const deleteMut = useToastMutation({
    mutationFn: (input: { id: string }) => deleteFacilityFn({ data: input }),
    successMessage: "Facility deleted",
    invalidate: facilitiesKey,
  });
  const deleteManyMut = useToastMutation({
    mutationFn: (input: { ids: string[] }) => deleteFacilitiesFn({ data: input }),
    successMessage: (res) => `Deleted ${res.deleted} ${res.deleted === 1 ? "facility" : "facilities"}`,
    invalidate: facilitiesKey,
    onSuccess: () => bulk.clear(),
  });


  return (
    <div>
      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          icon={Building2}
          title="Facilities"
          count={
            !facilitiesQuery.isLoading
              ? `${facilities.length}${q ? ` of ${allFacilities.length}` : ""}`
              : undefined
          }
          description="Manage facilities available in the signup form's facility dropdown."
        />
        <LoadingButton
          onClick={() => setShowAdd(true)}
          disabled={showAdd}
          icon={<Plus className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          Add facilities
        </LoadingButton>
      </div>

      <section className="mt-8">



        {showAdd && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const labels = newLabels.split("\n").map((l) => l.trim()).filter(Boolean);
              if (!labels.length) { toast.error("Enter at least one facility"); return; }
              addMut.mutate({ facilities: labels.map((label) => ({ label })) });
            }}
            className="mt-3 mb-8 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4"
          >
            <label className="text-sm font-medium">New facilities (one per line)</label>
            <textarea
              value={newLabels}
              onChange={(e) => setNewLabels(e.target.value)}
              rows={4}
              placeholder={"e.g.\nSpringfield, IL\nAustin, TX"}
              className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <LoadingButton
                variant="secondary"
                onClick={() => { setShowAdd(false); setNewLabels(""); }}
              >
                Cancel
              </LoadingButton>
              <LoadingButton
                type="submit"
                pending={addMut.isPending}
                pendingText="Adding…"
              >
                Add
              </LoadingButton>
            </div>
          </form>
        )}

        {allFacilities.length > 0 && (
          <BulkActionBar
            bulk={bulk}
            filteredCount={facilities.length}
            totalCount={allFacilities.length}
            isFiltered={Boolean(q)}
            noun={{ singular: "facility", plural: "facilities" }}
            searchQuery={searchQuery}
            onSearchChange={(v) => { setSearchQuery(v); setPage(0); }}
            searchPlaceholder="Search facilities…"
            onEnterEditMode={() => setEditingId(null)}
            onDeleteSelected={async (ids) =>
              confirmDelete({
                title: `Delete ${ids.length} ${ids.length === 1 ? "facility" : "facilities"}?`,
                description: `Permanently delete ${ids.length} selected ${ids.length === 1 ? "facility" : "facilities"}? Existing users assigned to ${ids.length === 1 ? "it" : "them"} will keep their value but ${ids.length === 1 ? "it" : "they"} will no longer appear in the signup dropdown.`,
                onConfirm: () => deleteManyMut.mutateAsync({ ids }),
              })
            }
          />
        )}

        <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${allFacilities.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
          {facilitiesQuery.isLoading ? (
            <EmptyState size="sm">Loading…</EmptyState>
          ) : facilities.length ? (
            <ul className="divide-y divide-border">
              {visibleFacilities.map((f) => {
                const isEditing = editingId === f.id;
                const selected = bulk.has(f.id);
                const editable = bulk.editMode && !isEditing;
                return (
                  <li
                    key={f.value}
                    onClick={editable ? () => bulk.toggle(f.id) : undefined}
                    className={`py-5 pb-6 md:pb-5 pr-[24px] pl-[24px] transition-colors ${
                      editable
                        ? `cursor-pointer ${selected ? "bg-destructive/10 hover:bg-destructive/15" : "hover:bg-muted/50"}`
                        : ""
                    }`}
                  >
                    <div className={`flex flex-col gap-5 md:flex-row md:items-center md:justify-between ${editable ? "pointer-events-none" : ""}`}>
                      {isEditing ? (
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                          <input
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            placeholder="Facility name"
                            className="flex-1 min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm"
                            autoFocus
                          />
                          <input
                            value={editingCustomSlug}
                            onChange={(e) => setEditingCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
                            placeholder="Custom slug (optional)"
                            className="flex-1 min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <LoadingButton variant="secondary" onClick={() => setEditingId(null)}>
                              Cancel
                            </LoadingButton>
                            <LoadingButton
                              onClick={() => {
                                const label = editingLabel.trim();
                                if (!label) { toast.error("Label required"); return; }
                                const customSlug = editingCustomSlug.trim() || null;
                                updateMut.mutate({ id: f.id, label, customSlug });
                              }}
                              pending={updateMut.isPending}
                              pendingText="Saving…"
                            >
                              Save
                            </LoadingButton>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-3 min-w-0 flex-wrap">
                              <span className="text-sm font-medium truncate">{f.label}</span>
                              <code className="text-xs text-muted-foreground font-mono truncate">{f.value}</code>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                {f.userCount} {f.userCount === 1 ? "user" : "users"} signed up
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Link2 className="h-3.5 w-3.5 shrink-0" />
                                <Link
                                  to="/facility/$slug"
                                  params={{ slug: f.customSlug ?? f.value }}
                                  className="hover:text-foreground hover:underline"
                                >
                                  /facility/{f.customSlug ?? f.value}
                                </Link>
                              </span>
                            </div>
                            {(f.customCategories?.length ?? 0) > 0 && (
                              <div className="pt-1 space-y-1">
                                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                  <LayoutGrid className="h-3.5 w-3.5" />
                                  Custom Categories ({f.customCategories.length})
                                </p>
                                <ul className="space-y-0.5">
                                  {f.customCategories.map((cat) => (
                                    <li key={cat.id}>
                                      <Link
                                        to="/admin/category/$id"
                                        params={{ id: cat.id }}
                                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                      >
                                        {cat.name}
                                        <span className="ml-1 text-muted-foreground/60">— /{cat.slug}</span>
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(f.contentItems?.length ?? 0) > 0 && (
                              <div className="pt-1 space-y-1">
                                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                  <Blocks className="h-3.5 w-3.5" />
                                  Custom Content ({f.contentItems.length})
                                </p>
                                <ul className="space-y-0.5">
                                  {f.contentItems.map((item) => (
                                    <li key={item.id}>
                                      <Link
                                        to="/admin/category/$id"
                                        params={{ id: item.categoryId }}
                                        search={{ edit: item.id }}
                                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                      >
                                        {item.title}
                                        <span className="ml-1 text-muted-foreground/60">— {item.categoryName}</span>
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {f.facilityMessage && (
                              <div className="pt-1 space-y-1">
                                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Facility Message
                                </p>
                                <ul className="space-y-0.5">
                                  <li>
                                    <Link
                                      to="/admin/messages"
                                      className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate block max-w-xs"
                                    >
                                      {f.facilityMessage.length > 80
                                        ? `${f.facilityMessage.slice(0, 80)}…`
                                        : f.facilityMessage}
                                    </Link>
                                  </li>
                                </ul>
                              </div>
                            )}
                          </div>
                          <TooltipProvider delayDuration={150}>
                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                              <IconButton
                                aria-label="Edit"
                                tooltip="Edit"
                                icon={Pencil}
                                onClick={() => { setEditingId(f.id); setEditingLabel(f.label); setEditingCustomSlug(f.customSlug ?? ""); }}
                              />
                              <div className="mx-1 h-6 w-px bg-border" aria-hidden />
                              <IconButton
                                aria-label="Delete"
                                tooltip="Delete"
                                pendingTooltip="Deleting…"
                                variant="destructive"
                                icon={Trash2}
                                pending={isMutationPendingFor(deleteMut, f.id, "id")}
                                onClick={async () => {
                                  await confirmDelete({
                                    title: "Delete facility?",
                                    description: `Delete "${f.label}"? Existing users assigned to this facility will keep the value but it will no longer appear in the signup dropdown.`,
                                    onConfirm: () => deleteMut.mutateAsync({ id: f.id }),
                                  });
                                }}
                              />
                            </div>
                          </TooltipProvider>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState size="sm">{q ? "No facilities match your search." : "No facilities yet."}</EmptyState>
          )}
        </div>
        <Pager page={page} total={facilities.length} pageSize={10} onPage={setPage} itemLabel="facility" itemLabelPlural="facilities" />

      </section>
    </div>
  );
}
