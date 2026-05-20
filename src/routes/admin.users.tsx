import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Users, Mail, KeyRound, Shield, ShieldOff, Send, Pencil, Check, X, Trash2, UserPlus, Globe, HelpCircle } from "lucide-react";
import {
  listUsers,
  updateUserEmail,
  setUserPassword,
  sendPasswordResetEmail,
  setUserRole,
  createUser,
  deleteUser,
  clearUserSecurityAnswers,
} from "@/lib/users.functions";
import { listFacilities, addFacilities, updateFacility, deleteFacility } from "@/lib/facilities.functions";
import { useConfirm } from "@/components/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus } from "lucide-react";

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
  profile: { username: string; facility: string } | null;
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
  const clearSecFn = useServerFn(clearUserSecurityAnswers);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "contributor">("admin");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [showAddFacilities, setShowAddFacilities] = useState(false);
  const [newFacilityLabels, setNewFacilityLabels] = useState("");
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [editingFacilityLabel, setEditingFacilityLabel] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list(),
  });

  const fetchFacilities = useServerFn(listFacilities);
  const addFacilitiesFn = useServerFn(addFacilities);
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
  const clearSecMut = useMutation({
    mutationFn: (input: { userId: string }) => clearSecFn({ data: input }),
    onSuccess: () => toast.success("Security questions reset. User must set new ones on next sign-in."),
    onError: (e: any) => toast.error(e.message),
  });
  const addFacilitiesMut = useMutation({
    mutationFn: (input: { facilities: { label: string }[] }) => addFacilitiesFn({ data: input }),
    onSuccess: (res) => {
      toast.success(`Added ${res.inserted} facility${res.inserted === 1 ? "" : "s"}`);
      setNewFacilityLabels("");
      setShowAddFacilities(false);
      qc.invalidateQueries({ queryKey: ["facilities"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const updateFacilityFn = useServerFn(updateFacility);
  const deleteFacilityFn = useServerFn(deleteFacility);
  const updateFacilityMut = useMutation({
    mutationFn: (input: { id: string; label: string }) => updateFacilityFn({ data: input }),
    onSuccess: () => {
      toast.success("Facility updated");
      setEditingFacilityId(null);
      qc.invalidateQueries({ queryKey: ["facilities"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteFacilityMut = useMutation({
    mutationFn: (input: { id: string }) => deleteFacilityFn({ data: input }),
    onSuccess: () => {
      toast.success("Facility deleted");
      qc.invalidateQueries({ queryKey: ["facilities"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>
      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Users className="h-7 w-7" /> Users
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
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Facilities
                </h2>
                <button
                  onClick={() => setShowAddFacilities(true)}
                  disabled={showAddFacilities}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
                >
                  <Plus className="h-4 w-4" /> Add facilities
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Facilities available in the signup form's facility dropdown.
              </p>
              {showAddFacilities && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const labels = newFacilityLabels
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);
                    if (!labels.length) { toast.error("Enter at least one facility"); return; }
                    addFacilitiesMut.mutate({ facilities: labels.map((label) => ({ label })) });
                  }}
                  className="mt-3 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2"
                >
                  <label className="text-sm font-medium">New facilities (one per line)</label>
                  <textarea
                    value={newFacilityLabels}
                    onChange={(e) => setNewFacilityLabels(e.target.value)}
                    rows={4}
                    placeholder={"e.g.\nSpringfield, IL\nAustin, TX"}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowAddFacilities(false); setNewFacilityLabels(""); }}
                      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addFacilitiesMut.isPending}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}
              <div className="mt-3 rounded-2xl border border-border bg-card overflow-hidden">
                {facilities.length ? (
                  <ul className="divide-y divide-border">
                    {facilities.map((f) => (
                      <li key={f.value} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{f.label}</span>
                        <code className="text-xs text-muted-foreground font-mono">{f.value}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-muted-foreground text-sm">No facilities yet.</div>
                )}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-display text-xl font-semibold">Admin Users</h2>
                <button
                  onClick={() => setShowCreate(true)}
                  disabled={showCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
                >
                  <UserPlus className="h-4 w-4" /> Add admin user
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Accounts with admin or contributor access.
              </p>
              {showCreate && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
                    createMut.mutate({ email: newEmail.trim(), password: newPassword, role: newRole });
                  }}
                  className="mt-3 rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  />
                  <input
                    type="text"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password (min 8 chars)"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  />
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "contributor")}>
                    <SelectTrigger className="h-[38px] w-full sm:w-[180px]">
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
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    Create
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
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-display text-xl font-semibold">Users</h2>
                <Select value={facilityFilter} onValueChange={setFacilityFilter}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filter by facility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All facilities</SelectItem>
                    {facilities.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Regular user accounts that signed up from the public form.
              </p>
              {(() => {
                const filtered = facilityFilter === "all"
                  ? regularUsers
                  : regularUsers.filter((u) => u.profile?.facility === facilityFilter);
                return (
                  <div className="mt-3 rounded-2xl border border-border bg-card overflow-hidden">
                    {filtered.length ? (
                      <ul className="divide-y divide-border">{filtered.map(renderItem)}</ul>
                    ) : (
                      <div className="p-6 text-muted-foreground text-sm">No users for this facility.</div>
                    )}
                  </div>
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
    <li className="p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isRegularUser ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm truncate">{user.profile!.username}</span>
              <span className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-2 py-0.5 text-foreground border border-border">
                {facilityLabel || user.profile!.facility}
              </span>
              {user.roles.includes("user") && (
                <span className="inline-flex items-center gap-1 text-xs rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground border border-border">
                  User
                </span>
              )}
            </div>
          ) : editingEmail ? (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
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
                <span className="ml-1 inline-flex items-center gap-1 text-xs rounded-full bg-primary/10 px-2 py-0.5 text-primary border border-primary/30">
                  <Shield className="h-3 w-3" /> Admin
                </span>
              )}
              {isContributor && (
                <span className="ml-1 inline-flex items-center gap-1 text-xs rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-600 border border-sky-500/30">
                  <Shield className="h-3 w-3" /> Contributor
                </span>
              )}
              {user.email_confirmed_at ? (
                <span className="ml-1 inline-flex items-center gap-1 text-xs rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 border border-emerald-500/30">
                  Verified
                </span>
              ) : (
                <span className="ml-1 inline-flex items-center gap-1 text-xs rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600 border border-amber-500/30">
                  Unverified
                </span>
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
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
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

