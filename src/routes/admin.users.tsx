import { createFileRoute, Link } from "@tanstack/react-router";

import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Users, Mail, KeyRound, Shield, ShieldOff, Send, Pencil, Check, X, Trash2, UserPlus, Globe, HelpCircle, Loader2, Download, Search } from "lucide-react";
import { Badge } from "@/components/Badge";

import {
  listUsers,
  updateUserEmail,
  setUserPassword,
  sendPasswordResetEmail,
  setUserRole,
  createUser,
  deleteUser,
  deleteUsers,
  clearUserSecurityAnswers,
} from "@/lib/users.functions";
import { listFacilities } from "@/lib/facilities.functions";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { useConfirm } from "@/components/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminUsersPage,
});

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: string[];
  signup_ip: string | null;
  profile: { username: string; facility: string; first_name: string; last_name: string } | null;
};


function AdminUsersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const list = useServerFn(listUsers);
  const updateEmail = useServerFn(updateUserEmail);
  const setPassword = useServerFn(setUserPassword);
  const sendReset = useServerFn(sendPasswordResetEmail);
  const setRole = useServerFn(setUserRole);
  const createFn = useServerFn(createUser);
  const deleteFn = useServerFn(deleteUser);
  const deleteManyFn = useServerFn(deleteUsers);
  const clearSecFn = useServerFn(clearUserSecurityAnswers);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "contributor">("admin");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [regularVisible, setRegularVisible] = useState<number>(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list(),
  });

  const fetchFacilities = useServerFn(listFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const facilities = facilitiesQuery.data?.facilities ?? [];
  const facilityLabelMap: Record<string, string> = Object.fromEntries(
    facilities.map((f) => [f.value, f.label]),
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const emailMut = useMutation({
    mutationFn: (input: { userId: string; email: string }) => updateEmail({ data: input }),
    onSuccess: () => { toast.success("Email updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const pwMut = useMutation({
    mutationFn: (input: { userId: string; password: string }) => setPassword({ data: input }),
    onSuccess: () => toast.success("Password updated"),
    onError: (e: any) => toast.error(e.message),
  });
  const resetMut = useMutation({
    mutationFn: (input: { email: string }) => sendReset({ data: input }),
    onSuccess: () => toast.success("Password reset email sent"),
    onError: (e: any) => toast.error(e.message),
  });
  const roleMut = useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "contributor"; enabled: boolean }) => setRole({ data: input }),
    onSuccess: () => { toast.success("Role updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const createMut = useMutation({
    mutationFn: (input: { email: string; password: string; role: "admin" | "contributor" }) => createFn({ data: input }),
    onSuccess: () => {
      toast.success("User created");
      setNewEmail(""); setNewPassword(""); setNewRole("admin"); setShowCreate(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (input: { userId: string }) => deleteFn({ data: input }),
    onSuccess: () => { toast.success("User deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteManyMut = useMutation({
    mutationFn: (input: { userIds: string[] }) => deleteManyFn({ data: input }),
    onSuccess: async (res) => {
      const parts: string[] = [];
      parts.push(`Deleted ${res.deleted} ${res.deleted === 1 ? "user" : "users"}`);
      if (res.failed.length) parts.push(`${res.failed.length} failed`);
      if (res.skippedSelf) parts.push("skipped your own account");
      toast.success(parts.join(" • "));
      await invalidate();
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const clearSecMut = useMutation({
    mutationFn: (input: { userId: string }) => clearSecFn({ data: input }),
    onSuccess: () => toast.success("Security questions reset. User must set new ones on next sign-in."),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>
      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Users className="h-7 w-7 text-[var(--color-accent)]" /> Users
          {!isLoading && data?.users && (
            <span className="text-muted-foreground font-normal">({data.users.length})</span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add users, edit emails, reset passwords, and manage access.
        </p>
      </div>

      {(() => {
        if (isLoading) {
          return (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
              Loading…
            </div>
          );
        }
        if (!data?.users.length) {
          return (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
              No users yet.
            </div>
          );
        }
        const adminUsers = data.users.filter(
          (u) => u.roles.includes("admin") || u.roles.includes("contributor"),
        );
        const regularUsers = data.users.filter(
          (u) => !u.roles.includes("admin") && !u.roles.includes("contributor"),
        );

        const renderItem = (u: UserRow) => (
          <UserItem
            key={u.id}
            user={u}
            facilityLabel={u.profile ? (facilityLabelMap[u.profile.facility] ?? u.profile.facility) : ""}
            onChangeEmail={(email) => emailMut.mutate({ userId: u.id, email })}
            onSetPassword={(password) => pwMut.mutate({ userId: u.id, password })}
            onSendReset={() => resetMut.mutate({ email: u.email })}
            onToggleAdmin={async (enabled) => {
              const ok = await confirm({
                title: enabled ? "Make admin?" : "Revoke admin?",
                description: enabled
                  ? `Grant admin role to ${u.email}? This will replace any existing role.`
                  : `Remove admin role from ${u.email}?`,
                confirmLabel: enabled ? "Make admin" : "Revoke",
                destructive: !enabled,
              });
              if (ok) roleMut.mutate({ userId: u.id, role: "admin", enabled });
            }}
            onToggleContributor={async (enabled) => {
              const ok = await confirm({
                title: enabled ? "Make contributor?" : "Revoke contributor?",
                description: enabled
                  ? `Grant contributor role to ${u.email}? This will replace any existing role.`
                  : `Remove contributor role from ${u.email}?`,
                confirmLabel: enabled ? "Make contributor" : "Revoke",
                destructive: !enabled,
              });
              if (ok) roleMut.mutate({ userId: u.id, role: "contributor", enabled });
            }}
            onDelete={async () => {
              const ok = await confirm({
                title: "Delete user?",
                description: `Permanently delete ${u.profile?.username || u.email}? This cannot be undone.`,
                confirmLabel: "Delete",
                destructive: true,
              });
              if (ok) deleteMut.mutate({ userId: u.id });
            }}
            onResetSecurity={async () => {
              const ok = await confirm({
                title: "Reset security questions?",
                description: `Clear ${u.profile?.username || u.email}'s security questions? They'll be required to choose new ones the next time they sign in.`,
                confirmLabel: "Reset",
                destructive: true,
              });
              if (ok) clearSecMut.mutate({ userId: u.id });
            }}
          />
        );

        return (
          <>



            <section className="mt-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">Admin Users <span className="text-muted-foreground font-normal">({adminUsers.length})</span></h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accounts with admin or contributor access.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  disabled={showCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary w-full sm:w-auto"
                >
                  <UserPlus className="h-4 w-4" /> Add admin user
                </button>
              </div>

              {showCreate && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
                    createMut.mutate({ email: newEmail.trim(), password: newPassword, role: newRole });
                  }}
                  className="mt-3 rounded-2xl border border-border bg-card p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto_auto] gap-2"
                >
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
                  />
                  <input
                    type="text"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password (min 8 chars)"
                    className="w-full min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
                  />
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "contributor")}>
                    <SelectTrigger className="h-[38px] w-full sm:col-span-2 lg:col-span-1">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="contributor">Contributor</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewEmail(""); setNewPassword(""); setNewRole("admin"); }}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {createMut.isPending ? "Creating…" : "Create"}
                  </button>
                </form>
              )}
              <div className="mt-3 rounded-2xl border border-border bg-card overflow-hidden">
                {adminUsers.length ? (
                  <ul className="divide-y divide-border">{adminUsers.map(renderItem)}</ul>
                ) : (
                  <div className="p-6 text-muted-foreground text-sm">No admin users.</div>
                )}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:flex-wrap">
                <div>
                  {(() => {
                    const q = searchQuery.trim().toLowerCase();
                    const facilityScoped = facilityFilter === "all"
                      ? regularUsers
                      : regularUsers.filter((u) => u.profile?.facility === facilityFilter);
                    const filteredCount = q
                      ? facilityScoped.filter((u) => {
                          const facLabel = u.profile ? (facilityLabelMap[u.profile.facility] ?? u.profile.facility) : "";
                          return [u.email, u.profile?.username, u.profile?.first_name, u.profile?.last_name, facLabel]
                            .filter(Boolean)
                            .some((v) => String(v).toLowerCase().includes(q));
                        }).length
                      : facilityScoped.length;
                    const isFiltered = facilityFilter !== "all" || q.length > 0;
                    return (
                      <h2 className="font-display text-xl font-semibold">Users <span className="text-muted-foreground font-normal">({filteredCount}{isFiltered ? ` of ${regularUsers.length}` : ""})</span></h2>
                    );
                  })()}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Regular user accounts that signed up from the public form.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:flex-nowrap gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-md">
                  <div className="w-full sm:flex-1 sm:min-w-0">
                    <FacilityCombobox
                      value={facilityFilter === "all" ? "" : facilityFilter}
                      onChange={(v) => { setFacilityFilter(v || "all"); setRegularVisible(10); }}
                      options={facilities.map((f) => ({ value: f.value, label: f.label }))}
                      placeholder="Filter by facility"
                      allowClear
                      clearLabel="All facilities"
                      triggerClassName="h-10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const rows = (facilityFilter === "all"
                        ? regularUsers
                        : regularUsers.filter((u) => u.profile?.facility === facilityFilter));
                      if (!rows.length) { toast.error("No users to export"); return; }
                      const headers = ["Username","First name","Last name","Email","Facility","Signup IP","Created","Last sign in"];
                      const esc = (v: string | null | undefined) => {
                        const s = (v ?? "").toString();
                        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                      };
                      const lines = [headers.join(",")];
                      for (const u of rows) {
                        lines.push([
                          esc(u.profile?.username),
                          esc(u.profile?.first_name),
                          esc(u.profile?.last_name),
                          esc(u.email),
                          esc(u.profile ? (facilityLabelMap[u.profile.facility] ?? u.profile.facility) : ""),
                          esc(u.signup_ip),
                          esc(u.created_at),
                          esc(u.last_sign_in_at),
                        ].join(","));
                      }
                      const csv = lines.join("\n");
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      const stamp = new Date().toISOString().slice(0, 10);
                      const scope = facilityFilter === "all" ? "all" : facilityFilter;
                      a.href = url;
                      a.download = `users-${scope}-${stamp}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted w-full sm:w-auto"
                  >
                    <Download className="h-4 w-4" /> Export CSV
                  </button>
                </div>
              </div>
              {(() => {
                const q = searchQuery.trim().toLowerCase();
                const facilityScoped = facilityFilter === "all"
                  ? regularUsers
                  : regularUsers.filter((u) => u.profile?.facility === facilityFilter);
                const filtered = q
                  ? facilityScoped.filter((u) => {
                      const facLabel = u.profile ? (facilityLabelMap[u.profile.facility] ?? u.profile.facility) : "";
                      return [u.email, u.profile?.username, u.profile?.first_name, u.profile?.last_name, facLabel]
                        .filter(Boolean)
                        .some((v) => String(v).toLowerCase().includes(q));
                    })
                  : facilityScoped;
                const visible = filtered.slice(0, regularVisible);
                const remaining = filtered.length - visible.length;

                const toggleOne = (id: string) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  });
                };
                return (
                  <>
                    {filtered.length > 0 && (
                      <div className="mt-3 flex min-h-[56px] items-center justify-between gap-3 flex-wrap rounded-t-md border border-b-0 border-border bg-muted/40 px-4 sm:px-5 py-2 text-sm">
                        <span className="text-muted-foreground">
                          {editMode
                            ? selectedIds.size > 0
                              ? `${selectedIds.size} selected`
                              : "Click users to select for deletion"
                            : `${filtered.length} ${filtered.length === 1 ? "user" : "users"}`}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => { setSearchQuery(e.target.value); setRegularVisible(10); }}
                              placeholder="Search users…"
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
                              onClick={() => setEditMode(true)}
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
                                    const ok = await confirm({
                                      title: `Delete ${ids.length} ${ids.length === 1 ? "user" : "users"}?`,
                                      description: `Permanently delete ${ids.length} selected ${ids.length === 1 ? "user" : "users"}? This cannot be undone.`,
                                      confirmLabel: "Delete",
                                      destructive: true,
                                    });
                                    if (ok) {
                                      setIsDeleting(true);
                                      try {
                                        await deleteManyMut.mutateAsync({ userIds: ids });
                                      } finally {
                                        setIsDeleting(false);
                                        setEditMode(false);
                                      }
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
                    <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${filtered.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
                      {filtered.length ? (
                        <ul className="divide-y divide-border">
                          {visible.map((u) => {
                            const selected = selectedIds.has(u.id);
                            if (editMode) {
                              return (
                                <li
                                  key={u.id}
                                  onClick={() => toggleOne(u.id)}
                                  className={`cursor-pointer transition-colors ${
                                    selected
                                      ? "bg-destructive/10 hover:bg-destructive/15"
                                      : "hover:bg-muted/50"
                                  }`}
                                >
                                  <div className="pointer-events-none">{renderItem(u)}</div>
                                </li>
                              );
                            }
                            return (
                              <li key={u.id}>{renderItem(u)}</li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="p-6 text-muted-foreground text-sm">No users for this facility.</div>
                      )}
                    </div>
                    {filtered.length > 10 && (
                      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap text-sm">
                        <span className="text-muted-foreground">
                          Showing {visible.length} of {filtered.length}
                        </span>
                        <div className="flex items-center gap-2">
                          {remaining > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setRegularVisible((n) => n + 10)}
                                className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                              >
                                Show 10 more
                              </button>
                              <button
                                type="button"
                                onClick={() => setRegularVisible(filtered.length)}
                                className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                              >
                                Show all
                              </button>
                            </>
                          )}
                          {visible.length > 10 && (
                            <button
                              type="button"
                              onClick={() => setRegularVisible(10)}
                              className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                            >
                              Collapse
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          </>
        );
      })()}
    </div>
  );
}


function UserItem({
  user,
  facilityLabel,
  onChangeEmail,
  onSetPassword,
  onSendReset,
  onToggleAdmin,
  onToggleContributor,
  onDelete,
  onResetSecurity,
}: {
  user: UserRow;
  facilityLabel: string;
  onChangeEmail: (email: string) => void;
  onSetPassword: (password: string) => void;
  onSendReset: () => void;
  onToggleAdmin: (enabled: boolean) => void;
  onToggleContributor: (enabled: boolean) => void;
  onDelete: () => void;
  onResetSecurity: () => void;
}) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user.email);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");

  const isAdmin = user.roles.includes("admin");
  const isContributor = user.roles.includes("contributor");

  const isRegularUser = !!user.profile;

  return (
    <li className="p-4 sm:p-5 pr-[22px] pl-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isRegularUser ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm truncate">{user.profile!.username}</span>
              {(user.profile!.first_name || user.profile!.last_name) && (
                <span className="text-sm text-muted-foreground truncate">
                  {`${user.profile!.first_name} ${user.profile!.last_name}`.trim()}
                </span>
              )}
              <Badge variant="facility">
                {facilityLabel || user.profile!.facility}
              </Badge>
              {user.roles.includes("user") && (
                <Badge variant="user">User</Badge>
              )}

            </div>
          ) : editingEmail ? (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
              />
              <button
                title="Save"
                onClick={() => {
                  const next = emailDraft.trim();
                  if (!next || next === user.email) { setEditingEmail(false); return; }
                  onChangeEmail(next);
                  setEditingEmail(false);
                }}
                className="p-1.5 rounded-md hover:bg-muted text-foreground"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                title="Cancel"
                onClick={() => { setEmailDraft(user.email); setEditingEmail(false); }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm truncate">{user.email || "(no email)"}</span>
              <button
                title="Edit email"
                onClick={() => setEditingEmail(true)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {isAdmin && (
                <Badge variant="admin" className="ml-1 gap-1">
                  <Shield className="h-3 w-3" /> Admin
                </Badge>
              )}
              {isContributor && (
                <Badge variant="contributor" className="ml-1 gap-1">
                  <Shield className="h-3 w-3" /> Contributor
                </Badge>
              )}
              {user.email_confirmed_at ? (
                <Badge variant="verified" className="ml-1">Verified</Badge>
              ) : (
                <Badge variant="unverified" className="ml-1">Unverified</Badge>
              )}

            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
            <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
            {user.last_sign_in_at && <span>· Last sign-in {new Date(user.last_sign_in_at).toLocaleDateString()}</span>}
            {user.signup_ip && (
              <span className="inline-flex items-center gap-1">
                · <Globe className="h-3 w-3" /> Signup IP: <code className="font-mono">{user.signup_ip}</code>
              </span>
            )}
          </p>
        </div>



        <TooltipProvider delayDuration={150}>
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            {!isRegularUser && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onSendReset}
                    aria-label="Send password reset email"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-input bg-background hover:bg-muted"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Send reset email</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPwOpen((v) => !v)}
                  aria-label="Set password"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-input bg-background hover:bg-muted"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Set password</TooltipContent>
            </Tooltip>

            {isRegularUser && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onResetSecurity}
                    aria-label="Reset security questions"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-input bg-background hover:bg-muted"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Reset security questions</TooltipContent>
              </Tooltip>
            )}

            {!isRegularUser && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        onToggleAdmin(!isAdmin);
                      }}
                      aria-label={isAdmin ? "Revoke admin" : "Make admin"}
                      className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border ${
                        isAdmin
                          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                          : "border-input bg-background hover:bg-muted"
                      }`}
                    >
                      {isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isAdmin ? "Revoke admin" : "Make admin"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onToggleContributor(!isContributor)}
                      aria-label={isContributor ? "Revoke contributor" : "Make contributor"}
                      className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border ${
                        isContributor
                          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                          : "border-input bg-background hover:bg-muted"
                      }`}
                    >
                      {isContributor ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isContributor ? "Revoke contributor" : "Make contributor"}</TooltipContent>
                </Tooltip>
              </>
            )}

            <div className="mx-1 h-6 w-px bg-border" aria-hidden />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onDelete}
                  aria-label="Delete user"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete user</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {pwOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
            onSetPassword(pw);
            setPw("");
            setPwOpen(false);
          }}
          className="mt-3 flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              onClick={() => { setPw(""); setPwOpen(false); }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Update
            </button>

          </div>
        </form>
      )}
    </li>
  );
}

