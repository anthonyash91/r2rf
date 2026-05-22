import { createFileRoute, Link } from "@tanstack/react-router";

import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Building2, Plus, Pencil, Trash2, Users, Home, Loader2 } from "lucide-react";
import {
  listFacilitiesWithStats,
  addFacilities,
  updateFacility,
  deleteFacility,
  deleteFacilities,
} from "@/lib/facilities.functions";

import { useConfirm } from "@/components/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton } from "@/components/IconButton";
import { Badge } from "@/components/Badge";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { BulkActionBar } from "@/components/BulkActionBar";



export const Route = createFileRoute("/admin/facilities")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminFacilitiesPage,
});

function AdminFacilitiesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const fetchFacilities = useServerFn(listFacilitiesWithStats);
  const addFacilitiesFn = useServerFn(addFacilities);
  const updateFacilityFn = useServerFn(updateFacility);
  const deleteFacilityFn = useServerFn(deleteFacility);
  const deleteFacilitiesFn = useServerFn(deleteFacilities);

  const [showAdd, setShowAdd] = useState(false);
  const [newLabels, setNewLabels] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const bulk = useBulkSelect();
  const [searchQuery, setSearchQuery] = useState("");


  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const allFacilities = facilitiesQuery.data?.facilities ?? [];
  const q = searchQuery.trim().toLowerCase();
  const facilities = q
    ? allFacilities.filter((f) =>
        [f.label, f.value].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      )
    : allFacilities;
  const visibleFacilities = facilities.slice(0, visibleCount);
  const remaining = Math.max(0, facilities.length - visibleFacilities.length);


  const invalidate = () => qc.invalidateQueries({ queryKey: ["facilities"] });

  const addMut = useMutation({
    mutationFn: (input: { facilities: { label: string }[] }) => addFacilitiesFn({ data: input }),
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
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (input: { id: string; label: string }) => updateFacilityFn({ data: input }),
    onSuccess: () => { toast.success("Facility updated"); setEditingId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (input: { id: string }) => deleteFacilityFn({ data: input }),
    onSuccess: () => { toast.success("Facility deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteManyMut = useMutation({
    mutationFn: (input: { ids: string[] }) => deleteFacilitiesFn({ data: input }),
    onSuccess: async (res) => {
      toast.success(`Deleted ${res.deleted} ${res.deleted === 1 ? "facility" : "facilities"}`);
      await invalidate();
      bulk.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>
      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-[var(--color-accent)]" /> Facilities
            {!facilitiesQuery.isLoading && (
              <span className="text-muted-foreground font-normal">({facilities.length}{q ? ` of ${allFacilities.length}` : ""})</span>
            )}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage facilities available in the signup form's facility dropdown.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          disabled={showAdd}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
        >
          <Plus className="h-4 w-4" /> Add facilities
        </button>
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
            className="mt-3 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2"
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
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewLabels(""); }}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMut.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {addMut.isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}

        {allFacilities.length > 0 && (
          <div className="mt-3 flex min-h-[56px] items-center justify-between gap-3 flex-wrap rounded-t-md border border-b-0 border-border bg-muted/40 px-4 sm:px-5 py-2 text-sm">
            <span className="text-muted-foreground">
              {editMode
                ? selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : "Click facilities to select for deletion"
                : `${facilities.length}${q ? ` of ${allFacilities.length}` : ""} ${facilities.length === 1 ? "facility" : "facilities"}`}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(10); }}
                  placeholder="Search facilities…"
                  className="rounded-md border border-input bg-background pl-8 pr-8 py-2 text-sm w-full sm:w-56"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!editMode ? (
                <button
                  type="button"
                  onClick={() => { setEditMode(true); setEditingId(null); }}
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => { setEditMode(false); setSelectedIds(new Set()); }}
                    className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
                  >
                    {selectedIds.size > 0 ? "Cancel" : "Done"}
                  </button>
                  {(selectedIds.size > 0 || isDeleting) && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={async () => {
                        const ids = Array.from(selectedIds);
                        setIsDeleting(true);
                        try {
                          const ok = await confirm({
                            title: `Delete ${ids.length} ${ids.length === 1 ? "facility" : "facilities"}?`,
                            description: `Permanently delete ${ids.length} selected ${ids.length === 1 ? "facility" : "facilities"}? Existing users assigned to ${ids.length === 1 ? "it" : "them"} will keep their value but ${ids.length === 1 ? "it" : "they"} will no longer appear in the signup dropdown.`,
                            confirmLabel: "Delete",
                            destructive: true,
                            onConfirm: () => deleteManyMut.mutateAsync({ ids }),
                          });
                          if (ok) setEditMode(false);
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {isDeleting ? "Deleting…" : `Delete selected (${selectedIds.size})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${allFacilities.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
          {facilitiesQuery.isLoading ? (
            <div className="p-6 text-muted-foreground text-sm">Loading…</div>
          ) : facilities.length ? (
            <ul className="divide-y divide-border">
              {visibleFacilities.map((f) => {
                const isEditing = editingId === f.id;
                const selected = selectedIds.has(f.id);
                const editable = editMode && !isEditing;
                return (
                  <li
                    key={f.value}
                    onClick={editable ? () => toggleOne(f.id) : undefined}
                    className={`p-4 sm:p-5 transition-colors ${
                      editable
                        ? `cursor-pointer ${selected ? "bg-destructive/10 hover:bg-destructive/15" : "hover:bg-muted/50"}`
                        : ""
                    }`}
                  >
                    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${editable ? "pointer-events-none" : ""}`}>
                      {isEditing ? (
                        <>
                          <input
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
                            autoFocus
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const label = editingLabel.trim();
                                if (!label) { toast.error("Label required"); return; }
                                updateMut.mutate({ id: f.id, label });
                              }}
                              disabled={updateMut.isPending}
                              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                            >
                              {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                              {updateMut.isPending ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </>
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
                              {f.customHomePage ? (
                                <Link
                                  to="/$customHome"
                                  params={{ customHome: f.customHomePage.slug }}
                                  className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                                >
                                  <Home className="h-3.5 w-3.5" />
                                  Custom home: /{f.customHomePage.slug}
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 italic">
                                  <Home className="h-3.5 w-3.5" />
                                  No custom home page
                                </span>
                              )}
                            </div>
                            {f.customHomePage && (
                              <div className="flex flex-wrap gap-1.5">
                                {f.customHomePage.categories.length ? (
                                  f.customHomePage.categories.map((c) => (
                                    <Badge key={c.id} variant="category">
                                      {c.name}
                                    </Badge>
                                  ))

                                ) : (
                                  <span className="text-xs italic text-muted-foreground">No categories assigned</span>
                                )}
                              </div>
                            )}
                          </div>
                          <TooltipProvider delayDuration={150}>
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              <IconButton
                                aria-label="Edit"
                                tooltip="Edit"
                                icon={Pencil}
                                onClick={() => { setEditingId(f.id); setEditingLabel(f.label); }}
                              />
                              <div className="mx-1 h-6 w-px bg-border" aria-hidden />
                              <IconButton
                                aria-label="Delete"
                                tooltip="Delete"
                                pendingTooltip="Deleting…"
                                variant="destructive"
                                icon={Trash2}
                                pending={deleteMut.isPending && deleteMut.variables?.id === f.id}
                                onClick={async () => {
                                  await confirm({
                                    title: "Delete facility?",
                                    description: `Delete "${f.label}"? Existing users assigned to this facility will keep the value but it will no longer appear in the signup dropdown.`,
                                    confirmLabel: "Delete",
                                    destructive: true,
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
            <div className="p-6 text-muted-foreground text-sm">{q ? "No facilities match your search." : "No facilities yet."}</div>
          )}
        </div>
        {facilities.length > 10 && (
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap text-sm">
            <span className="text-muted-foreground">
              Showing {visibleFacilities.length} of {facilities.length}
            </span>
            <div className="flex items-center gap-2">
              {remaining > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setVisibleCount((n) => n + 10)}
                    className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                  >
                    Show 10 more
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(facilities.length)}
                    className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                  >
                    Show all
                  </button>
                </>
              )}
              {visibleFacilities.length > 10 && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(10)}
                  className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                >
                  Collapse
                </button>
              )}
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
