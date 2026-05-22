import { createFileRoute } from "@tanstack/react-router";

import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Mail, KeyRound, Shield, ShieldOff, Send, Pencil, Check, X, Trash2, UserPlus, Globe, HelpCircle, Loader2, Download } from "lucide-react";
import { Badge } from "@/components/Badge";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { rowPending } from "@/hooks/use-row-pending";
import { getLastSeenUsersAt, setLastSeenUsersAt } from "@/lib/new-users-tracker";

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
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { BulkActionBar } from "@/components/BulkActionBar";

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
  const confirmDelete = useConfirmDelete();
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
  const bulk = useBulkSelect();
  const [searchQuery, setSearchQuery] = useState("");

  // Snapshot the "last seen" timestamp at mount so newly-signed-up users stay
  // highlighted for the duration of this visit. On unmount (or now), bump
  // lastSeen so the AdminNav badge clears and these won't highlight next time.
  const newUsersSinceRef = useRef<string>(getLastSeenUsersAt());
  const isNewUser = (u: UserRow) => u.created_at > newUsersSinceRef.current;
  useEffect(() => {
    setLastSeenUsersAt(new Date().toISOString());
  }, []);

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
      bulk.clear();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const clearSecMut = useMutation({
    mutationFn: (input: { userId: string }) => clearSecFn({ data: input }),
    onSuccess: () => toast.success("Security questions reset. User must set new ones on next sign-in."),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        className="mt-6"
        icon={Users}
        title="Users"
        count={!isLoading && data?.users ? data.users.length : undefined}
        description="Add users, edit emails, reset passwords, and manage access."
      />

      {(() => {
        if (isLoading) {
          return (
            <SectionCard as="div" className="mt-6 text-muted-foreground">
              Loading…
            </SectionCard>
          );
        }
        if (!data?.users.length) {
          return (
            <SectionCard as="div" className="mt-6 text-muted-foreground">
              No users yet.
            </SectionCard>
          );
        }
        const adminUsers = data.users.filter(
          (u) => u.roles.includes("admin") || u.roles.includes("contributor"),
        );
        const regularUsers = data.users.filter(
          (u) => !u.roles.includes("admin") && !u.roles.includes("contributor"),
        );

        const isPendingEmail = rowPending<string>(emailMut, "userId");
        const isPendingPw = rowPending<string>(pwMut, "userId");
        const isPendingResetEmail = rowPending<string>(resetMut, "email");
        const isPendingRole = rowPending<string>(roleMut, "userId");
        const isPendingDelete = rowPending<string>(deleteMut, "userId");
        const isPendingClearSec = rowPending<string>(clearSecMut, "userId");

        const renderItem = (u: UserRow) => (
          <UserItem
            key={u.id}
            user={u}
            isNew={isNewUser(u)}
            facilityLabel={u.profile ? (facilityLabelMap[u.profile.facility] ?? u.profile.facility) : ""}
            pendingEmail={isPendingEmail(u.id)}
            pendingPassword={isPendingPw(u.id)}
            pendingReset={isPendingResetEmail(u.email)}
            pendingRole={isPendingRole(u.id)}
            pendingDelete={isPendingDelete(u.id)}
            pendingClearSec={isPendingClearSec(u.id)}
            onChangeEmail={(email) => emailMut.mutate({ userId: u.id, email })}
            onSetPassword={(password) => pwMut.mutate({ userId: u.id, password })}
            onSendReset={() => resetMut.mutate({ email: u.email })}
            onToggleAdmin={async (enabled) => {
              await confirm({
                title: enabled ? "Make admin?" : "Revoke admin?",
                description: enabled
                  ? `Grant admin role to ${u.email}? This will replace any existing role.`
                  : `Remove admin role from ${u.email}?`,
                confirmLabel: enabled ? "Make admin" : "Revoke",
                destructive: !enabled,
                pendingLabel: "Saving",
                onConfirm: () => roleMut.mutateAsync({ userId: u.id, role: "admin", enabled }),
              });
            }}
            onToggleContributor={async (enabled) => {
              await confirm({
                title: enabled ? "Make contributor?" : "Revoke contributor?",
                description: enabled
                  ? `Grant contributor role to ${u.email}? This will replace any existing role.`
                  : `Remove contributor role from ${u.email}?`,
                confirmLabel: enabled ? "Make contributor" : "Revoke",
                destructive: !enabled,
                pendingLabel: "Saving",
                onConfirm: () => roleMut.mutateAsync({ userId: u.id, role: "contributor", enabled }),
              });
            }}
            onDelete={async () => {
              await confirmDelete({
                title: "Delete user?",
                description: `Permanently delete ${u.profile?.username || u.email}? This cannot be undone.`,
                onConfirm: () => deleteMut.mutateAsync({ userId: u.id }),
              });
            }}
            onResetSecurity={async () => {
              await confirmDelete({
                title: "Reset security questions?",
                description: `Clear ${u.profile?.username || u.email}'s security questions? They'll be required to choose new ones the next time they sign in.`,
                confirmLabel: "Reset",
                pendingLabel: "Resetting",
                onConfirm: () => clearSecMut.mutateAsync({ userId: u.id }),
              });
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
                <LoadingButton
                  onClick={() => setShowCreate(true)}
                  disabled={showCreate}
                  icon={<UserPlus className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  Add admin user
                </LoadingButton>
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
                  <LoadingButton
                    variant="secondary"
                    onClick={() => { setShowCreate(false); setNewEmail(""); setNewPassword(""); setNewRole("admin"); }}
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
                </form>
              )}
              <SectionCard as="div" padded={false} className="mt-3 overflow-hidden">
                {adminUsers.length ? (
                  <ul className="divide-y divide-border">{adminUsers.map(renderItem)}</ul>
                ) : (
                  <EmptyState size="sm">No admin users.</EmptyState>
                )}
              </SectionCard>
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
                const filteredBase = q
                  ? facilityScoped.filter((u) =>
                      [u.profile?.username, u.profile?.first_name, u.profile?.last_name]
                        .filter(Boolean)
                        .some((v) => String(v).toLowerCase().includes(q)),
                    )
                  : facilityScoped;

                // Sort: newly signed-up users (since this visit started) first,
                // newest first; everyone else preserves the existing order.
                const newOnes = filteredBase
                  .filter(isNewUser)
                  .slice()
                  .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                const rest = filteredBase.filter((u) => !isNewUser(u));
                const filtered = [...newOnes, ...rest];

                const visible = filtered.slice(0, regularVisible);
                const remaining = filtered.length - visible.length;

                return (
                  <>
                    {filtered.length > 0 && (
                      <BulkActionBar
                        bulk={bulk}
                        filteredCount={filtered.length}
                        noun={{ singular: "user", plural: "users" }}
                        searchQuery={searchQuery}
                        onSearchChange={(v) => { setSearchQuery(v); setRegularVisible(10); }}
                        searchPlaceholder="Search users…"
                        onDeleteSelected={async (ids) =>
                          confirmDelete({
                            title: `Delete ${ids.length} ${ids.length === 1 ? "user" : "users"}?`,
                            description: `Permanently delete ${ids.length} selected ${ids.length === 1 ? "user" : "users"}? This cannot be undone.`,
                            onConfirm: () => deleteManyMut.mutateAsync({ userIds: ids }),
                          })
                        }
                      />
                    )}
                    <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${filtered.length > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
                      {filtered.length ? (
                        <ul className="divide-y divide-border">
                          {visible.map((u) => {
                            const selected = bulk.has(u.id);
                            const isNew = isNewUser(u);
                            const newHighlight = isNew
                              ? "bg-[var(--color-accent)]/10"
                              : "";
                            if (bulk.editMode) {
                              return (
                                <li
                                  key={u.id}
                                  onClick={() => bulk.toggle(u.id)}
                                  className={`relative cursor-pointer transition-colors ${
                                    selected
                                      ? "bg-destructive/10 hover:bg-destructive/15"
                                      : `${newHighlight} hover:bg-muted/50`
                                  }`}
                                >
                                  <div className="pointer-events-none">{renderItem(u)}</div>
                                </li>
                              );
                            }
                            return (
                              <li key={u.id} className={`relative ${newHighlight}`}>
                                {renderItem(u)}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <EmptyState size="sm">{q ? "No users match your search." : "No users for this facility."}</EmptyState>
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
                              <LoadingButton
                                variant="secondary"
                                onClick={() => setRegularVisible((n) => n + 10)}
                              >
                                Show 10 more
                              </LoadingButton>
                              <LoadingButton
                                variant="secondary"
                                onClick={() => setRegularVisible(filtered.length)}
                              >
                                Show all
                              </LoadingButton>
                            </>
                          )}
                          {visible.length > 10 && (
                            <LoadingButton
                              variant="secondary"
                              onClick={() => setRegularVisible(10)}
                            >
                              Collapse
                            </LoadingButton>
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
  isNew = false,
  facilityLabel,
  pendingEmail = false,
  pendingPassword = false,
  pendingReset = false,
  pendingRole = false,
  pendingDelete = false,
  pendingClearSec = false,
  onChangeEmail,
  onSetPassword,
  onSendReset,
  onToggleAdmin,
  onToggleContributor,
  onDelete,
  onResetSecurity,
}: {
  user: UserRow;
  isNew?: boolean;
  facilityLabel: string;
  pendingEmail?: boolean;
  pendingPassword?: boolean;
  pendingReset?: boolean;
  pendingRole?: boolean;
  pendingDelete?: boolean;
  pendingClearSec?: boolean;
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
            <>
              <div className="flex sm:hidden items-center gap-2 flex-wrap mb-2">
                <Badge variant="facility">
                  {facilityLabel || user.profile!.facility}
                </Badge>
                {user.roles.includes("user") && (
                  <Badge variant="user">User</Badge>
                )}
                {isNew && <Badge variant="new">New</Badge>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm truncate">{user.profile!.username}</span>
                {(user.profile!.first_name || user.profile!.last_name) && (
                  <span className="text-sm text-muted-foreground truncate">
                    {`${user.profile!.first_name} ${user.profile!.last_name}`.trim()}
                  </span>
                )}
                <Badge variant="facility" className="hidden sm:inline-flex">
                  {facilityLabel || user.profile!.facility}
                </Badge>
                {user.roles.includes("user") && (
                  <Badge variant="user" className="hidden sm:inline-flex">User</Badge>
                )}
                {isNew && (
                  <Badge variant="new" className="hidden sm:inline-flex">New</Badge>
                )}
              </div>
            </>
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
                title={pendingEmail ? "Saving…" : "Save"}
                disabled={pendingEmail}
                onClick={() => {
                  const next = emailDraft.trim();
                  if (!next || next === user.email) { setEditingEmail(false); return; }
                  onChangeEmail(next);
                  setEditingEmail(false);
                }}
                className="p-1.5 rounded-md hover:bg-muted text-foreground disabled:opacity-60"
              >
                {pendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
            <>
              <div className="flex sm:hidden items-center gap-2 flex-wrap mb-2">
                {isAdmin && (
                  <Badge variant="admin" className="gap-1">
                    <Shield className="h-3 w-3" /> Admin
                  </Badge>
                )}
                {isContributor && (
                  <Badge variant="contributor" className="gap-1">
                    <Shield className="h-3 w-3" /> Contributor
                  </Badge>
                )}
                {user.email_confirmed_at ? (
                  <Badge variant="verified">Verified</Badge>
                ) : (
                  <Badge variant="unverified">Unverified</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                  <Badge variant="admin" className="ml-1 gap-1 hidden sm:inline-flex">
                    <Shield className="h-3 w-3" /> Admin
                  </Badge>
                )}
                {isContributor && (
                  <Badge variant="contributor" className="ml-1 gap-1 hidden sm:inline-flex">
                    <Shield className="h-3 w-3" /> Contributor
                  </Badge>
                )}
                {user.email_confirmed_at ? (
                  <Badge variant="verified" className="ml-1 hidden sm:inline-flex">Verified</Badge>
                ) : (
                  <Badge variant="unverified" className="ml-1 hidden sm:inline-flex">Unverified</Badge>
                )}
              </div>
            </>
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
              <IconButton
                aria-label="Send password reset email"
                tooltip="Send reset email"
                icon={Send}
                pending={pendingReset}
                onClick={onSendReset}
              />
            )}

            <IconButton
              aria-label="Set password"
              tooltip="Set password"
              icon={KeyRound}
              pending={pendingPassword}
              onClick={() => setPwOpen((v) => !v)}
            />

            {isRegularUser && (
              <IconButton
                aria-label="Reset security questions"
                tooltip="Reset security questions"
                icon={HelpCircle}
                pending={pendingClearSec}
                onClick={onResetSecurity}
              />
            )}

            {!isRegularUser && (
              <>
                <IconButton
                  aria-label={isAdmin ? "Revoke admin" : "Make admin"}
                  tooltip={isAdmin ? "Revoke admin" : "Make admin"}
                  variant={isAdmin ? "destructive" : "default"}
                  icon={isAdmin ? ShieldOff : Shield}
                  pending={pendingRole}
                  onClick={() => onToggleAdmin(!isAdmin)}
                />

                <IconButton
                  aria-label={isContributor ? "Revoke contributor" : "Make contributor"}
                  tooltip={isContributor ? "Revoke contributor" : "Make contributor"}
                  variant={isContributor ? "destructive" : "default"}
                  icon={isContributor ? ShieldOff : Shield}
                  pending={pendingRole}
                  onClick={() => onToggleContributor(!isContributor)}
                />
              </>
            )}

            <div className="mx-1 h-6 w-px bg-border" aria-hidden />

            <IconButton
              aria-label="Delete user"
              tooltip="Delete user"
              pendingTooltip="Deleting…"
              variant="destructive"
              icon={Trash2}
              pending={pendingDelete}
              onClick={onDelete}
            />
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
            <LoadingButton
              variant="secondary"
              onClick={() => { setPw(""); setPwOpen(false); }}
            >
              Cancel
            </LoadingButton>
            <LoadingButton type="submit">
              Update
            </LoadingButton>

          </div>
        </form>
      )}
    </li>
  );
}

