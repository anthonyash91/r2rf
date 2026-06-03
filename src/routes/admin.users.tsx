import { createFileRoute } from "@tanstack/react-router";

import { requireUserManagementAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Mail, KeyRound, Shield, ShieldOff, Send, Pencil, Check, X, Trash2, UserPlus, HelpCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { UserSectionHeader } from "@/components/UserSectionHeader";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { UserStatusBadges } from "@/components/UserStatusBadges";
import { Pager } from "@/components/LoadMorePager";
import { useToastMutation } from "@/hooks/use-toast-mutation";
import { rowPending } from "@/hooks/use-row-pending";
import { getLastSeenUsersAt, setLastSeenUsersAt } from "@/lib/new-users-tracker";

import {
  listAdminUsers,
  listTesterUsers,
  listRegularUsers,
  listFacilityAdminUsers,
  updateUserEmail,
  setUserPassword,
  sendPasswordResetEmail,
  resendVerificationEmail,
  setUserRole,
  createUser,
  createTesterUser,
  createFacilityUser,
  deleteUser,
  deleteUsers,
  clearUserSecurityAnswers,
} from "@/lib/users.functions";
import { listAllFacilities } from "@/lib/facilities.functions";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { useConfirm } from "@/components/ConfirmDialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton } from "@/components/IconButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/FormDialog";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { BulkActionBar } from "@/components/BulkActionBar";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: requireUserManagementAdminBeforeLoad,
  component: AdminUsersPage,
});

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: string[];
  profile: { username: string; facility: string; first_name: string; last_name: string; inmatePin: string | null } | null;
};



function AdminUsersPage() {
  const confirm = useConfirm();
  const confirmDelete = useConfirmDelete();
  const { isFacilityUser, user } = useAuth();
  const listAdminFn = useServerFn(listAdminUsers);
  const listTesterFn = useServerFn(listTesterUsers);
  const listRegularFn = useServerFn(listRegularUsers);
  const listFacilityAdminFn = useServerFn(listFacilityAdminUsers);
  const updateEmail = useServerFn(updateUserEmail);
  const setPassword = useServerFn(setUserPassword);
  const sendReset = useServerFn(sendPasswordResetEmail);
  const setRole = useServerFn(setUserRole);
  const fetchMyFacility = useServerFn(getMyFacilityValue);
  const { data: myFacilityData } = useQuery({
    queryKey: ["my-facility", user?.id],
    enabled: isFacilityUser && !!user?.id,
    staleTime: Infinity,
    queryFn: () => fetchMyFacility(),
  });
  const myFacilityValue = isFacilityUser ? (myFacilityData?.facility ?? null) : null;

  const createFn = useServerFn(createUser);
  const createTesterFn = useServerFn(createTesterUser);
  const createFacilityFn = useServerFn(createFacilityUser);
  const resendVerifyFn = useServerFn(resendVerificationEmail);
  const deleteFn = useServerFn(deleteUser);
  const deleteManyFn = useServerFn(deleteUsers);
  const clearSecFn = useServerFn(clearUserSecurityAnswers);

  // Add-user flow: picker dialog -> one of three inline forms.
  const [showKindPicker, setShowKindPicker] = useState(false);
  const [addKind, setAddKind] = useState<null | "adminContributor" | "tester" | "facilityUser">(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "contributor">("admin");
  const [newUsername, setNewUsername] = useState("");
  const [newTesterPassword, setNewTesterPassword] = useState("");
  const [newFacilityUserEmail, setNewFacilityUserEmail] = useState("");
  const [newFacilityUserPassword, setNewFacilityUserPassword] = useState("");
  const [newFacilityUserFacility, setNewFacilityUserFacility] = useState("");
  // facilityUser admins are locked to their facility; others default to "all"
  const [facilityFilter, setFacilityFilter] = useState<string>(() => "all");
  const [page, setPage] = useState(0);
  
  const bulk = useBulkSelect();
  const [searchQuery, setSearchQuery] = useState("");

  // Capture the threshold at mount so it's stable for the whole visit — any
  // user created after this instant will be highlighted as "New". The useEffect
  // then bumps the stored value so on the next visit these users are no longer
  // new and the AdminNav badge count resets.
  const newUsersSinceRef = useRef<string>(getLastSeenUsersAt());
  const isNewUser = (u: UserRow) =>
    u.created_at > newUsersSinceRef.current &&
    u.roles.includes("user") &&
    !u.roles.includes("tester") &&
    !u.roles.includes("admin") &&
    !u.roles.includes("contributor");
  useEffect(() => {
    setLastSeenUsersAt(new Date().toISOString());
  }, []);

  // Debounce search input so typing doesn't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // facilityUser admins are locked to their own facility for all user views
  const effectiveFacilityFilter = isFacilityUser && myFacilityValue
    ? myFacilityValue
    : facilityFilter === "all" ? "" : facilityFilter;

  const adminQuery = useQuery({
    queryKey: ["admin", "users", "admins"],
    enabled: !isFacilityUser,
    queryFn: () => listAdminFn(),
  });
  const testerQuery = useQuery({
    queryKey: ["admin", "users", "testers"],
    enabled: !isFacilityUser,
    queryFn: () => listTesterFn(),
  });
  const facilityAdminQuery = useQuery({
    queryKey: ["admin", "users", "facilityAdmins", myFacilityValue],
    queryFn: () => listFacilityAdminFn({ data: { facilityValue: myFacilityValue ?? undefined } }),
  });
  const regularQuery = useQuery({
    queryKey: [
      "admin",
      "users",
      "regular",
      { page, search: debouncedSearch, facility: effectiveFacilityFilter },
    ],
    // For facilityUsers, wait until their facility is loaded before querying so we
    // never fire with an empty filter and accidentally expose cross-facility data.
    enabled: !isFacilityUser || !!myFacilityValue,
    queryFn: () =>
      listRegularFn({
        data: {
          limit: 10,
          offset: page * 10,
          search: debouncedSearch,
          facility: effectiveFacilityFilter,
        },
      }),
    placeholderData: (prev) => prev,
  });

  const isLoading = (!isFacilityUser && (adminQuery.isLoading || testerQuery.isLoading)) || facilityAdminQuery.isLoading || regularQuery.isLoading;
  const adminUsers: UserRow[] = adminQuery.data?.users ?? [];
  const testerUsers: UserRow[] = testerQuery.data?.users ?? [];
  const facilityAdminUsers: UserRow[] = facilityAdminQuery.data?.users ?? [];
  const regularUsers: UserRow[] = regularQuery.data?.users ?? [];
  const regularTotal = regularQuery.data?.total ?? 0;
  const totalUsers = (isFacilityUser ? 0 : adminUsers.length + testerUsers.length) + facilityAdminUsers.length + regularTotal;


  const fetchFacilities = useServerFn(listAllFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilities(),
  });
  const facilities = facilitiesQuery.data?.facilities ?? [];
  const facilityLabelMap: Record<string, string> = Object.fromEntries(
    facilities.map((f) => [f.value, f.label]),
  );

  const usersKey = ["admin", "users"] as const;

  const emailMut = useToastMutation({
    mutationFn: (input: { userId: string; email: string }) => updateEmail({ data: input }),
    successMessage: "Email updated",
    invalidate: usersKey,
  });
  const pwMut = useToastMutation({
    mutationFn: (input: { userId: string; password: string }) => setPassword({ data: input }),
    successMessage: "Password updated",
  });
  const resetMut = useToastMutation({
    mutationFn: (input: { email: string; userId?: string }) => sendReset({ data: input }),
    successMessage: "Password reset email sent",
  });
  const resendVerifyMut = useToastMutation({
    mutationFn: (input: { email: string; userId?: string }) => resendVerifyFn({ data: input }),
    successMessage: "Verification email resent",
  });
  const roleMut = useToastMutation({
    mutationFn: (input: { userId: string; role: "admin" | "contributor" | "tester"; enabled: boolean }) => setRole({ data: input }),
    successMessage: "Role updated",
    invalidate: usersKey,
  });
  const closeAddForm = () => {
    setAddKind(null);
    setNewEmail(""); setNewPassword(""); setNewRole("admin");
    setNewUsername(""); setNewTesterPassword("");
    setNewFacilityUserEmail(""); setNewFacilityUserPassword(""); setNewFacilityUserFacility("");
  };
  const createMut = useToastMutation({
    mutationFn: (input: { email: string; password: string; role: "admin" | "contributor" }) => createFn({ data: input }),
    successMessage: "User created. A verification email has been sent.",
    invalidate: usersKey,
    onSuccess: () => { closeAddForm(); newUsersSinceRef.current = new Date().toISOString(); },
  });
  const createTesterMut = useToastMutation({
    mutationFn: (input: { username: string; password: string }) => createTesterFn({ data: input }),
    successMessage: "Test user created",
    invalidate: usersKey,
    onSuccess: () => { closeAddForm(); newUsersSinceRef.current = new Date().toISOString(); },
  });
  const createFacilityUserMut = useToastMutation({
    mutationFn: (input: { email: string; password: string; facilityValue: string }) => createFacilityFn({ data: input }),
    successMessage: "Facility user created. A verification email has been sent.",
    invalidate: usersKey,
    onSuccess: () => { closeAddForm(); newUsersSinceRef.current = new Date().toISOString(); },
  });
  const deleteMut = useToastMutation({
    mutationFn: (input: { userId: string }) => deleteFn({ data: input }),
    successMessage: "User deleted",
    invalidate: usersKey,
  });
  const deleteManyMut = useToastMutation({
    mutationFn: (input: { userIds: string[] }) => deleteManyFn({ data: input }),
    successMessage: (res) => {
      const parts: string[] = [];
      parts.push(`Deleted ${res.deleted} ${res.deleted === 1 ? "user" : "users"}`);
      if (res.failed.length) parts.push(`${res.failed.length} failed`);
      if (res.skippedSelf) parts.push("skipped your own account");
      return parts.join(" • ");
    },
    invalidate: usersKey,
    onSuccess: () => {
      bulk.clear();
    },
  });
  const clearSecMut = useToastMutation({
    mutationFn: (input: { userId: string }) => clearSecFn({ data: input }),
    successMessage: "Security questions reset. User must set new ones on next sign-in.",
  });

  return (
    <div>
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          icon={Users}
          title="Users"
          count={!isLoading ? totalUsers : undefined}
          description="Add users, edit emails, reset passwords, and manage access."
        />
        {!isFacilityUser && (
          <LoadingButton
            onClick={() => setShowKindPicker(true)}
            disabled={addKind !== null}
            icon={<UserPlus className="h-4 w-4" />}
            className="w-full sm:w-auto self-stretch sm:self-center"
          >
            Add User
          </LoadingButton>
        )}
      </div>

      <FormDialog
        open={showKindPicker}
        onOpenChange={setShowKindPicker}
        title="Add user"
        description="What type of user would you like to add?"
        size="sm"
      >
        <div className="grid gap-2 mt-[-4px]">
          <button
            type="button"
            onClick={() => { setShowKindPicker(false); setAddKind("adminContributor"); setNewRole("admin"); }}
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-left text-sm hover:bg-muted transition-colors"
          >
            <div className="font-medium">Admin</div>
            <div className="text-xs text-muted-foreground">Full access. Verification email sent.</div>
          </button>
          <button
            type="button"
            onClick={() => { setShowKindPicker(false); setAddKind("adminContributor"); setNewRole("contributor"); }}
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-left text-sm hover:bg-muted transition-colors"
          >
            <div className="font-medium">Contributor</div>
            <div className="text-xs text-muted-foreground">Can manage content. Verification email sent.</div>
          </button>
          <button
            type="button"
            onClick={() => { setShowKindPicker(false); setAddKind("facilityUser"); }}
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-left text-sm hover:bg-muted transition-colors"
          >
            <div className="font-medium">Facility User</div>
            <div className="text-xs text-muted-foreground">Facility staff with facility-scoped admin access. Verification email sent.</div>
          </button>
          <button
            type="button"
            onClick={() => { setShowKindPicker(false); setAddKind("tester"); }}
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-left text-sm hover:bg-muted transition-colors"
          >
            <div className="font-medium">Tester</div>
            <div className="text-xs text-muted-foreground">Behaves like a regular user. Username + password.</div>
          </button>
        </div>
      </FormDialog>

      {addKind === "adminContributor" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
            createMut.mutate({ email: newEmail.trim(), password: newPassword, role: newRole });
          }}
          className="mt-4 rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-accent)_12%,transparent)] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto_auto] gap-2"
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
          <LoadingButton variant="secondary" onClick={closeAddForm}>
            Cancel
          </LoadingButton>
          <LoadingButton type="submit" pending={createMut.isPending} pendingText="Creating…">
            Create
          </LoadingButton>
        </form>
      )}

      {addKind === "tester" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const uname = newUsername.trim().toLowerCase();
            if (!/^[a-z0-9_]{3,32}$/.test(uname)) {
              toast.error("Username must be 3–32 chars: letters, numbers, underscores");
              return;
            }
            if (newTesterPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
            createTesterMut.mutate({ username: uname, password: newTesterPassword });
          }}
          className="mt-4 rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-accent)_12%,transparent)] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] gap-2"
        >
          <input
            type="text"
            required
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="username"
            className="w-full min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
          />
          <input
            type="text"
            autoComplete="new-password"
            required
            value={newTesterPassword}
            onChange={(e) => setNewTesterPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            className="w-full min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
          />
          <LoadingButton variant="secondary" onClick={closeAddForm}>
            Cancel
          </LoadingButton>
          <LoadingButton type="submit" pending={createTesterMut.isPending} pendingText="Creating…">
            Create
          </LoadingButton>
        </form>
      )}

      {addKind === "facilityUser" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newFacilityUserFacility) { toast.error("Select a facility"); return; }
            if (newFacilityUserPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
            createFacilityUserMut.mutate({ email: newFacilityUserEmail.trim(), password: newFacilityUserPassword, facilityValue: newFacilityUserFacility });
          }}
          className="mt-4 rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-accent)_12%,transparent)] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_200px_auto_auto] gap-2"
        >
          <input
            type="email"
            required
            value={newFacilityUserEmail}
            onChange={(e) => setNewFacilityUserEmail(e.target.value)}
            placeholder="staff@facility.com"
            className="w-full min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
          />
          <input
            type="text"
            autoComplete="new-password"
            required
            value={newFacilityUserPassword}
            onChange={(e) => setNewFacilityUserPassword(e.target.value)}
            placeholder="Temp password (min 8 chars)"
            className="w-full min-w-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
          />
          <FacilityCombobox
            value={newFacilityUserFacility}
            onChange={(v) => setNewFacilityUserFacility(v ?? "")}
            options={facilities.map((f) => ({ value: f.value, label: f.label }))}
            placeholder="Select facility…"
            searchPlaceholder="Search facilities…"
            emptyMessage="No facilities found."
          />
          <LoadingButton variant="secondary" onClick={closeAddForm}>Cancel</LoadingButton>
          <LoadingButton type="submit" pending={createFacilityUserMut.isPending} pendingText="Creating…">
            Create
          </LoadingButton>
        </form>
      )}

      {(() => {
        if (isLoading) {
          return (
            <SectionCard as="div" className="mt-6 text-muted-foreground">
              Loading…
            </SectionCard>
          );
        }
        if (totalUsers === 0) {
          return (
            <SectionCard as="div" className="mt-6 text-muted-foreground">
              No users yet.
            </SectionCard>
          );
        }


        const isPendingEmail = rowPending<string>(emailMut, "userId");
        const isPendingPw = rowPending<string>(pwMut, "userId");
        const isPendingResetEmail = rowPending<string>(resetMut, "email");
        const isPendingResendVerify = rowPending<string>(resendVerifyMut, "email");
        const isPendingRole = rowPending<string>(roleMut, "userId");
        const isPendingDelete = rowPending<string>(deleteMut, "userId");
        const isPendingClearSec = rowPending<string>(clearSecMut, "userId");

        const renderItem = (u: UserRow) => (
          <UserItem
            key={u.id}
            user={u}
            isNew={isNewUser(u)}
            facilityLabel={u.profile ? (facilityLabelMap[u.profile.facility] ?? u.profile.facility) : ""}
            hideDelete={isFacilityUser}
            pendingEmail={isPendingEmail(u.id)}
            pendingPassword={isPendingPw(u.id)}
            pendingReset={isPendingResetEmail(u.email)}
            pendingResendVerify={isPendingResendVerify(u.email)}
            pendingRole={isPendingRole(u.id)}
            pendingDelete={isPendingDelete(u.id)}
            pendingClearSec={isPendingClearSec(u.id)}
            onChangeEmail={(email) => emailMut.mutate({ userId: u.id, email })}
            onSetPassword={(password) => pwMut.mutate({ userId: u.id, password })}
            onSendReset={() => resetMut.mutate({ email: u.email, userId: u.id })}
            onResendVerify={() => resendVerifyMut.mutate({ email: u.email, userId: u.id })}
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
          <div
            className={`transition-opacity ${addKind ? "opacity-40 pointer-events-none" : ""}`}
            aria-hidden={addKind ? true : undefined}
          >



            {!isFacilityUser && (
              <section className="mt-8">
                <div>
                  <UserSectionHeader title="Admin Users" count={adminUsers.length} description="Accounts with admin or contributor access." />
                </div>
                <SectionCard as="div" padded={false} className="mt-3 overflow-hidden">
                  {adminUsers.length ? (
                    <ul className="divide-y divide-border">{adminUsers.map(renderItem)}</ul>
                  ) : (
                    <EmptyState size="sm">No admin users.</EmptyState>
                  )}
                </SectionCard>
              </section>
            )}

            <section className="mt-8">
              <div>
                <UserSectionHeader title="Facility Users" count={facilityAdminUsers.length} description="Facility staff with facility-scoped admin access." />
              </div>
              <SectionCard as="div" padded={false} className="mt-3 overflow-hidden">
                {facilityAdminUsers.length ? (
                  <ul className="divide-y divide-border">{facilityAdminUsers.map((u) => (
                    <UserItem
                      key={u.id}
                      user={u}
                      isNew={false}
                      facilityLabel={u.profile ? (facilityLabelMap[u.profile.facility] ?? u.profile.facility) : ""}
                      showFacilityUserBadge
                      hideRoleToggles
                      hideDelete={isFacilityUser}
                      selfUserId={isFacilityUser ? user?.id : undefined}
                      pendingEmail={isPendingEmail(u.id)}
                      pendingPassword={isPendingPw(u.id)}
                      pendingReset={isPendingResetEmail(u.email)}
                      pendingResendVerify={isPendingResendVerify(u.email)}
                      pendingRole={isPendingRole(u.id)}
                      pendingDelete={isPendingDelete(u.id)}
                      pendingClearSec={isPendingClearSec(u.id)}
                      onChangeEmail={(email) => emailMut.mutate({ userId: u.id, email })}
                      onSetPassword={(password) => pwMut.mutate({ userId: u.id, password })}
                      onSendReset={() => resetMut.mutate({ email: u.email })}
                      onResendVerify={() => resendVerifyMut.mutate({ email: u.email })}
                      onToggleAdmin={async () => {}}
                      onToggleContributor={async () => {}}
                      onDelete={async () => {
                        await confirmDelete({
                          title: "Delete facility user?",
                          description: `Permanently delete ${u.email}?`,
                          onConfirm: () => deleteMut.mutateAsync({ userId: u.id }),
                        });
                      }}
                      onResetSecurity={async () => {
                        await confirmDelete({
                          title: "Reset security questions?",
                          description: `Clear ${u.email}'s security questions?`,
                          confirmLabel: "Reset",
                          pendingLabel: "Resetting",
                          onConfirm: () => clearSecMut.mutateAsync({ userId: u.id }),
                        });
                      }}
                    />
                  ))}</ul>
                ) : (
                  <EmptyState size="sm">No facility users.</EmptyState>
                )}
              </SectionCard>
            </section>

            {!isFacilityUser && (
              <section className="mt-8">
                <div>
                  <UserSectionHeader title="Test Users" count={testerUsers.length} description="Accounts used for internal testing. They behave like regular users." />
                </div>
                <SectionCard as="div" padded={false} className="mt-3 overflow-hidden">
                  {testerUsers.length ? (
                    <ul className="divide-y divide-border">{testerUsers.map(renderItem)}</ul>
                  ) : (
                    <EmptyState size="sm">No tester users.</EmptyState>
                  )}
                </SectionCard>
              </section>
            )}

            <section className="mt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:flex-wrap">
                <div>
                  {(() => {
                    const isFiltered = facilityFilter !== "all" || debouncedSearch.length > 0;
                    return (
                      <UserSectionHeader
                        title="Users"
                        count={`${regularTotal}${isFiltered ? " filtered" : ""}`}
                        description="Regular user accounts that signed up from the public form."
                      />
                    );
                  })()}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:flex-nowrap gap-2 w-full sm:w-64">
                  <div className="w-full sm:flex-1 sm:min-w-0">
                    <FacilityCombobox
                      value={facilityFilter === "all" ? "" : facilityFilter}
                      onChange={(v) => { setFacilityFilter(v || "all"); setPage(0); }}
                      options={facilities.map((f) => ({ value: f.value, label: f.label }))}
                      placeholder="Filter by facility"
                      allowClear
                      clearLabel="All facilities"
                      triggerClassName="h-10"
                    />
                  </div>
                </div>
              </div>
              {(() => {
                const visible = regularUsers;
                return (
                  <>
                    {regularTotal > 0 && (
                      <BulkActionBar
                        bulk={bulk}
                        filteredCount={regularTotal}
                        noun={{ singular: "user", plural: "users" }}
                        searchQuery={searchQuery}
                        onSearchChange={(v) => { setSearchQuery(v); setPage(0); }}
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
                    <div className={`rounded-b-2xl border border-border bg-card overflow-hidden ${regularTotal > 0 ? "" : "mt-3 rounded-t-2xl"}`}>
                      {visible.length ? (
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
                        <EmptyState size="sm">{debouncedSearch ? "No users match your search." : "No users for this facility."}</EmptyState>
                      )}
                    </div>
                    <Pager page={page} total={regularTotal} pageSize={10} onPage={setPage} itemLabel="user" />
                  </>
                );
              })()}
            </section>
          </div>
        );
      })()}
    </div>
  );
}


function UserItem({
  user,
  isNew = false,
  facilityLabel,

  showFacilityUserBadge = false,
  hideRoleToggles = false,
  hideDelete = false,
  selfUserId,
  pendingEmail = false,
  pendingPassword = false,
  pendingReset = false,
  pendingResendVerify = false,
  pendingRole = false,
  pendingDelete = false,
  pendingClearSec = false,
  onChangeEmail,
  onSetPassword,
  onSendReset,
  onResendVerify,
  onToggleAdmin,
  onToggleContributor,
  onDelete,
  onResetSecurity,
}: {
  user: UserRow;
  isNew?: boolean;
  facilityLabel: string;

  showFacilityUserBadge?: boolean;
  /** Hide the Make/Revoke admin+contributor buttons (for facility user rows). */
  hideRoleToggles?: boolean;
  /** Hide the delete button (when the logged-in user is a facilityUser). */
  hideDelete?: boolean;
  /** When set, only show the Set Password button for this user ID. */
  selfUserId?: string;
  pendingEmail?: boolean;
  pendingPassword?: boolean;
  pendingReset?: boolean;
  pendingResendVerify?: boolean;
  pendingRole?: boolean;
  pendingDelete?: boolean;
  pendingClearSec?: boolean;
  onChangeEmail: (email: string) => void;
  onSetPassword: (password: string) => void;
  onSendReset: () => void;
  onResendVerify: () => void;
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
  const isTester = user.roles.includes("tester");

  const isRegularUser = !!user.profile && !isAdmin && !isContributor && !isTester && !showFacilityUserBadge;
  const isUsernameUser = !!user.profile && (isRegularUser || isTester);

  return (
    <li className="pt-6 sm:pt-[19px] pb-6 md:py-5 pr-[24px] pl-[24px]">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-5">
        <div className="min-w-0 flex-1">
          {isUsernameUser ? (
            <>
              {isRegularUser ? (
                /* Regular users: name + status badges inline */
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">
                    {[user.profile!.first_name, user.profile!.last_name].filter(Boolean).join(" ") || user.profile!.username}
                  </span>
                  <UserStatusBadges user={user} facilityLabel={facilityLabel} isNew={isNew} hideFacilityBadge={isRegularUser} />
                </div>
              ) : (
                <>
                  <div className="flex sm:hidden items-center gap-2 flex-wrap mb-2">
                    <UserStatusBadges user={user} facilityLabel={facilityLabel} isNew={isNew} hideFacilityBadge={isRegularUser} />
                  </div>
                  <div className="flex items-center gap-2 flex-nowrap min-w-0">
                    <span className="font-mono text-sm truncate">
                      {showFacilityUserBadge ? user.email : user.profile!.username}
                    </span>
                    {(user.profile!.first_name || user.profile!.last_name) && (
                      <span className="text-sm text-muted-foreground truncate">
                        {`${user.profile!.first_name} ${user.profile!.last_name}`.trim()}
                      </span>
                    )}
                    <UserStatusBadges
                      user={user}
                      facilityLabel={facilityLabel}
                      isNew={isNew}
                      hideFacilityBadge={isRegularUser}
                      className="hidden sm:inline-flex"
                    >
                      {showFacilityUserBadge && <Badge variant="facility-user" size="sm">Facility User</Badge>}
                      {showFacilityUserBadge && (
                        user.email_confirmed_at
                          ? <Badge variant="verified" size="sm">Verified</Badge>
                          : <Badge variant="unverified" size="sm">Unverified</Badge>
                      )}
                    </UserStatusBadges>
                  </div>
                </>
              )}
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
                <BadgeGroup>
                  {isAdmin && <Badge variant="admin" size="sm">Admin</Badge>}
                  {isContributor && <Badge variant="contributor" size="sm">Contributor</Badge>}
                  {isTester && <Badge variant="tester" size="sm">Tester</Badge>}
                  {showFacilityUserBadge && <Badge variant="facility-user" size="sm">Facility User</Badge>}
                  {user.email_confirmed_at ? (
                    <Badge variant="verified" size="sm">Verified</Badge>
                  ) : (
                    <Badge variant="unverified" size="sm">Unverified</Badge>
                  )}
                </BadgeGroup>
              </div>
              <div className="flex items-center gap-2 flex-nowrap min-w-0">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-sm truncate">{user.email || "(no email)"}</span>
                <button
                  title="Edit email"
                  onClick={() => setEditingEmail(true)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <BadgeGroup className="ml-1 hidden sm:inline-flex">
                  {isAdmin && <Badge variant="admin" size="sm">Admin</Badge>}
                  {isContributor && <Badge variant="contributor" size="sm">Contributor</Badge>}
                  {isTester && <Badge variant="tester" size="sm">Tester</Badge>}
                  {showFacilityUserBadge && <Badge variant="facility-user" size="sm">Facility User</Badge>}
                  {user.email_confirmed_at ? (
                    <Badge variant="verified" size="sm">Verified</Badge>
                  ) : (
                    <Badge variant="unverified" size="sm">Unverified</Badge>
                  )}
                </BadgeGroup>
              </div>
            </>
          )}
          {isRegularUser ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                @{user.profile!.username}
                {user.profile?.inmatePin && <> · PIN: {user.profile.inmatePin}</>}
                {facilityLabel && <> · {facilityLabel}</>}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                Signed up {new Date(user.created_at).toLocaleDateString()}
                {user.last_sign_in_at && <> · Last login {new Date(user.last_sign_in_at).toLocaleDateString()}</>}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {(showFacilityUserBadge) && facilityLabel && (
                  <><span className="font-medium text-foreground">{facilityLabel}</span>{" · "}</>
                )}
                Joined {new Date(user.created_at).toLocaleDateString()}
                {user.last_sign_in_at && <>{" · "}Last sign-in {new Date(user.last_sign_in_at).toLocaleDateString()}</>}
              </p>
              {isUsernameUser && !showFacilityUserBadge && user.profile?.inmatePin && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  PIN <span className="font-mono font-medium text-foreground">{user.profile.inmatePin}</span>
                </p>
              )}
            </>
          )}

        </div>



        <TooltipProvider delayDuration={150}>
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 self-end md:self-auto">
            {!isUsernameUser && !user.email_confirmed_at && (
              <IconButton
                aria-label="Resend verification email"
                tooltip="Resend verification email"
                icon={Mail}
                pending={pendingResendVerify}
                onClick={onResendVerify}
              />
            )}
            {!isUsernameUser && user.email_confirmed_at && (
              <IconButton
                aria-label="Send password reset email"
                tooltip="Send reset email"
                icon={Send}
                pending={pendingReset}
                onClick={onSendReset}
              />
            )}

            {(!selfUserId || selfUserId === user.id) && (
              <IconButton
                aria-label="Set password"
                tooltip="Set password"
                icon={KeyRound}
                pending={pendingPassword}
                onClick={() => setPwOpen((v) => !v)}
              />
            )}

            {isUsernameUser && (
              <IconButton
                aria-label="Reset security questions"
                tooltip="Reset security questions"
                icon={HelpCircle}
                pending={pendingClearSec}
                onClick={onResetSecurity}
              />
            )}



            {!isUsernameUser && !hideRoleToggles && (
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

            {!hideDelete && <div className="mx-1 h-6 w-px bg-border" aria-hidden />}

            {!hideDelete && (
              <IconButton
                aria-label="Delete user"
                tooltip="Delete user"
                pendingTooltip="Deleting…"
                variant="destructive"
                icon={Trash2}
                pending={pendingDelete}
                onClick={onDelete}
              />
            )}
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

