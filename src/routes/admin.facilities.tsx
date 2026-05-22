import { createFileRoute, Link } from "@tanstack/react-router";

import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Building2, Plus, Pencil, Trash2, Users, Home } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { PageHeader } from "@/components/PageHeader";
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
            onSearchChange={(v) => { setSearchQuery(v); setVisibleCount(10); }}
            searchPlaceholder="Search facilities…"
            onEnterEditMode={() => setEditingId(null)}
            onDeleteSelected={async (ids) =>
              confirm({
                title: `Delete ${ids.length} ${ids.length === 1 ? "facility" : "facilities"}?`,
                description: `Permanently delete ${ids.length} selected ${ids.length === 1 ? "facility" : "facilities"}? Existing users assigned to ${ids.length === 1 ? "it" : "them"} will keep their value but ${ids.length === 1 ? "it" : "they"} will no longer appear in the signup dropdown.`,
                confirmLabel: "Delete",
                destructive: true,
                onConfirm: () => deleteManyMut.mutateAsync({ ids }),
              })
            }
          />
        )}

        <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${allFacilities.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
          {facilitiesQuery.isLoading ? (
            <div className="p-6 text-muted-foreground text-sm">Loading…</div>
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
                            <LoadingButton
                              variant="secondary"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </LoadingButton>
                            <LoadingButton
                              onClick={() => {
                                const label = editingLabel.trim();
                                if (!label) { toast.error("Label required"); return; }
                                updateMut.mutate({ id: f.id, label });
                              }}
                              pending={updateMut.isPending}
                              pendingText="Saving…"
                            >
                              Save
                            </LoadingButton>
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
                  <LoadingButton
                    variant="secondary"
                    onClick={() => setVisibleCount((n) => n + 10)}
                  >
                    Show 10 more
                  </LoadingButton>
                  <LoadingButton
                    variant="secondary"
                    onClick={() => setVisibleCount(facilities.length)}
                  >
                    Show all
                  </LoadingButton>
                </>
              )}
              {visibleFacilities.length > 10 && (
                <LoadingButton
                  variant="secondary"
                  onClick={() => setVisibleCount(10)}
                >
                  Collapse
                </LoadingButton>
              )}
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
