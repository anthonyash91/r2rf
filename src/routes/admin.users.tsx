import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Users, Mail, KeyRound, Shield, ShieldOff, Send, Pencil, Check, X, Trash2, UserPlus, Globe } from "lucide-react";
import {
  listUsers,
  updateUserEmail,
  setUserPassword,
  sendPasswordResetEmail,
  setUserRole,
  createUser,
  deleteUser,
} from "@/lib/users.functions";

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
};

function AdminUsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const updateEmail = useServerFn(updateUserEmail);
  const setPassword = useServerFn(setUserPassword);
  const sendReset = useServerFn(sendPasswordResetEmail);
  const setRole = useServerFn(setUserRole);
  const createFn = useServerFn(createUser);
  const deleteFn = useServerFn(deleteUser);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list(),
  });

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
    mutationFn: (input: { email: string; password: string }) => createFn({ data: input }),
    onSuccess: () => {
      toast.success("User created");
      setNewEmail(""); setNewPassword(""); setShowCreate(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (input: { userId: string }) => deleteFn({ data: input }),
    onSuccess: () => { toast.success("User deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>
      <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Users className="h-7 w-7" /> Users
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add users, edit emails, reset passwords, and manage access.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" /> {showCreate ? "Cancel" : "Add user"}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
            createMut.mutate({ email: newEmail.trim(), password: newPassword });
          }}
          className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col sm:flex-row gap-2"
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
          <button
            type="submit"
            disabled={createMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            Create
          </button>
        </form>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : !data?.users.length ? (
          <div className="p-6 text-muted-foreground">No users yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {data.users.map((u) => (
              <UserItem
                key={u.id}
                user={u}
                onChangeEmail={(email) => emailMut.mutate({ userId: u.id, email })}
                onSetPassword={(password) => pwMut.mutate({ userId: u.id, password })}
                onSendReset={() => resetMut.mutate({ email: u.email })}
                onToggleAdmin={(enabled) => roleMut.mutate({ userId: u.id, role: "admin", enabled })}
                onToggleContributor={(enabled) => roleMut.mutate({ userId: u.id, role: "contributor", enabled })}
                onDelete={() => {
                  if (confirm(`Permanently delete ${u.email}? This cannot be undone.`)) {
                    deleteMut.mutate({ userId: u.id });
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


function UserItem({
  user,
  onChangeEmail,
  onSetPassword,
  onSendReset,
  onToggleAdmin,
  onToggleContributor,
  onDelete,
}: {
  user: UserRow;
  onChangeEmail: (email: string) => void;
  onSetPassword: (password: string) => void;
  onSendReset: () => void;
  onToggleAdmin: (enabled: boolean) => void;
  onToggleContributor: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user.email);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");

  const isAdmin = user.roles.includes("admin");
  const isContributor = user.roles.includes("contributor");

  return (
    <li className="p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingEmail ? (
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


        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSendReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Send className="h-3.5 w-3.5" /> Send reset email
          </button>
          <button
            onClick={() => setPwOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <KeyRound className="h-3.5 w-3.5" /> Set password
          </button>
          <button
            onClick={() => {
              if (isAdmin && !confirm(`Remove admin role from ${user.email}?`)) return;
              onToggleAdmin(!isAdmin);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
              isAdmin
                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                : "border-input bg-background hover:bg-muted"
            }`}
          >
            {isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
            {isAdmin ? "Revoke admin" : "Make admin"}
          </button>
          <button
            onClick={() => onToggleContributor(!isContributor)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
              isContributor
                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                : "border-input bg-background hover:bg-muted"
            }`}
          >
            {isContributor ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
            {isContributor ? "Revoke contributor" : "Make contributor"}
          </button>
          <button
            onClick={onDelete}
            title="Delete user"
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
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
              onClick={() => { setPw(""); setPwOpen(false); }}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Update password
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

