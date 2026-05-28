import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordAdminAudit } from "@/lib/admin-audit.server";



type Role = "admin" | "contributor" | "tester" | "user";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

type ListedUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: Role[];
  profile: { username: string; facility: string; first_name: string; last_name: string } | null;
};

async function hydrateAuthFields(userIds: string[]): Promise<
  Map<string, { email: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null }>
> {
  const map = new Map<
    string,
    { email: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null }
  >();
  await Promise.all(
    userIds.map(async (id) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
      if (error || !data?.user) return;
      const u = data.user as any;
      map.set(id, {
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
      });
    }),
  );
  return map;
}

async function fetchRolesAndProfiles(userIds: string[]) {
  if (userIds.length === 0) return { rolesByUser: new Map<string, Role[]>(), profileByUser: new Map<string, ListedUser["profile"]>() };
  const [{ data: roleRows }, { data: profileRows }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", userIds),
    supabaseAdmin
      .from("user_profiles")
      .select("user_id, username, facility, first_name, last_name")
      .in("user_id", userIds),
  ]);
  const rolesByUser = new Map<string, Role[]>();
  for (const r of roleRows ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role as Role);
    rolesByUser.set(r.user_id, arr);
  }
  const profileByUser = new Map<string, ListedUser["profile"]>();
  for (const p of profileRows ?? []) {
    profileByUser.set(p.user_id, {
      username: p.username,
      facility: p.facility,
      first_name: (p as any).first_name ?? "",
      last_name: (p as any).last_name ?? "",
    });
  }
  return { rolesByUser, profileByUser };
}

async function buildListedUsers(userIds: string[]): Promise<ListedUser[]> {
  if (userIds.length === 0) return [];
  const [authMap, { rolesByUser, profileByUser }] = await Promise.all([
    hydrateAuthFields(userIds),
    fetchRolesAndProfiles(userIds),
  ]);
  return userIds
    .map((id) => {
      const auth = authMap.get(id);
      if (!auth) return null;
      return {
        id,
        email: auth.email,
        created_at: auth.created_at,
        last_sign_in_at: auth.last_sign_in_at,
        email_confirmed_at: auth.email_confirmed_at,
        roles: rolesByUser.get(id) ?? [],
        profile: profileByUser.get(id) ?? null,
      } as ListedUser;
    })
    .filter((x): x is ListedUser => x !== null);
}

/**
 * Admin + contributor users. Small set; returns all.
 */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "contributor"]);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    const users = await buildListedUsers(ids);
    users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { users };
  });

/**
 * Tester users. Bounded set; returns all.
 */
export const listTesterUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "tester");
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    const users = await buildListedUsers(ids);
    users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { users };
  });

/**
 * Facility admin users (role = facilityUser). Optionally filtered by facilityValue.
 */
export const listFacilityAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ facilityValue: z.string().optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "facilityUser");
    if (error) throw new Error(error.message);
    let ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id as string)));
    // If scoped to a facility, filter by profile
    if (data.facilityValue && ids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("facility", data.facilityValue)
        .in("user_id", ids);
      ids = (profs ?? []).map((p: any) => p.user_id as string);
    }
    const users = await buildListedUsers(ids);
    users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { users };
  });

/**
 * Regular users with server-side pagination, search and facility filter.
 */
export const listRegularUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        limit: z.number().int().min(1).max(10000).default(10),
        offset: z.number().int().min(0).default(0),
        search: z.string().trim().max(100).optional().default(""),
        facility: z.string().trim().max(100).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    // Exclude any user with a privileged or tester role.
    const { data: privilegedRows, error: privErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "contributor", "tester"]);
    if (privErr) throw new Error(privErr.message);
    const excludeIds = Array.from(new Set((privilegedRows ?? []).map((r) => r.user_id)));

    let q = supabaseAdmin
      .from("user_profiles")
      .select("user_id, username, facility, first_name, last_name, created_at", { count: "exact" });

    if (excludeIds.length) {
      q = q.not("user_id", "in", `(${excludeIds.join(",")})`);
    }
    if (data.facility) {
      q = q.eq("facility", data.facility);
    }
    if (data.search) {
      const term = data.search.replace(/[%,()]/g, "").toLowerCase();
      if (term) {
        const pat = `%${term}%`;
        q = q.or(
          `username.ilike.${pat},first_name.ilike.${pat},last_name.ilike.${pat}`,
        );
      }
    }

    q = q.order("created_at", { ascending: false }).range(data.offset, data.offset + data.limit - 1);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.user_id);
    const authMap = await hydrateAuthFields(ids);

    const users: ListedUser[] = (rows ?? []).map((p) => {
      const auth = authMap.get(p.user_id);
      return {
        id: p.user_id,
        email: auth?.email ?? "",
        created_at: auth?.created_at ?? p.created_at,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        email_confirmed_at: auth?.email_confirmed_at ?? null,
        roles: ["user"],
        profile: {
          username: p.username,
          facility: p.facility,
          first_name: (p as any).first_name ?? "",
          last_name: (p as any).last_name ?? "",
        },
      };
    });

    return { users, total: count ?? 0 };
  });

export const countNewUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ since: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // Exclude admin/contributor accounts and any synthetic test users.
    const { data: privilegedRoles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "contributor", "tester"]);
    if (rolesErr) throw new Error(rolesErr.message);
    let q = supabaseAdmin
      .from("user_profiles")
      .select("user_id", { count: "exact", head: true })
      .gt("created_at", data.since)
      .eq("is_synthetic", false);
    const excludeIds = Array.from(new Set((privilegedRoles ?? []).map((r) => r.user_id)));
    if (excludeIds.length) {
      q = q.not("user_id", "in", `(${excludeIds.join(",")})`);
    }
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        role: z.enum(["admin", "contributor"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // Create with email_confirm:false so the user must verify via email.
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: false,
    });
    if (error) throw new Error(error.message);
    if (created.user) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: data.role });
      if (roleErr) throw new Error(roleErr.message);
    }
    // Trigger the verification email.
    const { error: resendErr } = await supabaseAdmin.auth.resend({
      type: "signup",
      email: data.email,
    });
    if (resendErr) {
      // Non-fatal: user is created. Surface the message so the admin knows.
      console.error("createUser: resend signup failed", resendErr.message);
    }
    await recordAdminAudit({
      actorUserId: context.userId,
      action: "user.create",
      targetUserId: created.user?.id ?? null,
      details: { email: data.email, role: data.role },
    });
    return { ok: true };
  });

/**
 * Create a facility admin user. Sends a verification email; forces password
 * reset on first login via the must_reset_password metadata flag.
 */
export const createFacilityUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        facilityValue: z.string().min(1).max(64),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: false,
      user_metadata: { must_reset_password: true },
    });
    if (error) throw new Error(error.message);
    const userId = created.user.id;
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "facilityUser" });
    // Store facility in user_profiles so facility-scoped queries work
    await supabaseAdmin.from("user_profiles").insert({
      user_id: userId,
      username: data.email.split("@")[0].slice(0, 32).replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      facility: data.facilityValue,
      first_name: "",
      last_name: "",
    });
    // Send verification email
    const { error: resendErr } = await supabaseAdmin.auth.resend({ type: "signup", email: data.email });
    if (resendErr) console.warn("createFacilityUser: resend failed", resendErr.message);
    await recordAdminAudit({
      actorUserId: context.userId,
      action: "user.create",
      targetUserId: userId,
      details: { email: data.email, role: "facilityUser", facility: data.facilityValue },
    });
    return { ok: true };
  });

import { syntheticEmail as userSyntheticEmail } from "@/lib/user-signup";

export const createTesterUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9_]{3,32}$/, "Username must be 3–32 chars, letters/numbers/underscore"),
        password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: exists } = await supabaseAdmin.rpc("username_exists", { _username: data.username });
    if (exists) throw new Error("That username is already taken.");

    const email = userSyntheticEmail(data.username);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, must_reset_password: true },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Failed to create tester");
    const userId = created.user.id;

    const { error: profErr } = await supabaseAdmin.from("user_profiles").insert({
      user_id: userId,
      username: data.username,
      facility: "test_facility",
      first_name: "",
      last_name: "",
      is_synthetic: true,
    });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert([
        { user_id: userId, role: "tester" },
        { user_id: userId, role: "user" },
      ]);
    if (roleErr) {
      await supabaseAdmin.from("user_profiles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(roleErr.message);
    }

    return { ok: true };
  });

/**
 * Atomically rotates the caller's password AND clears the
 * `must_reset_password` metadata flag. The flag can only be cleared as a
 * side effect of an actual password change — this prevents authenticated
 * users from skipping the forced reset by calling the endpoint directly.
 */
export const clearMustResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ newPassword: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: userRes, error: getErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (getErr) {
      console.error("[clearMustResetPassword] getUserById failed:", getErr.message);
      throw new Error("Unable to update password. Please try again.");
    }
    const meta = { ...((userRes?.user?.user_metadata ?? {}) as Record<string, unknown>) };
    meta.must_reset_password = false;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
      user_metadata: meta,
    });
    if (error) {
      console.error("[clearMustResetPassword] updateUserById failed:", error.message);
      throw new Error("Unable to update password. Please try again.");
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await recordAdminAudit({
      actorUserId: context.userId,
      action: "user.delete",
      targetUserId: data.userId,
    });
    return { ok: true };
  });

export const deleteUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userIds: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const targets = data.userIds.filter((id) => id !== context.userId);
    let deleted = 0;
    const failed: { userId: string; message: string }[] = [];
    for (const userId of targets) {
      try {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw new Error(error.message);
        deleted++;
        await recordAdminAudit({
          actorUserId: context.userId,
          action: "user.delete",
          targetUserId: userId,
          details: { bulk: true },
        });
      } catch (e: any) {
        failed.push({ userId, message: e?.message ?? "unknown error" });
      }
    }
    return { deleted, failed, skippedSelf: data.userIds.length - targets.length };
  });





export const updateUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        email: z.string().trim().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await recordAdminAudit({
      actorUserId: context.userId,
      action: "user.password_reset",
      targetUserId: data.userId,
      details: { method: "admin_set" },
    });
    return { ok: true };
  });

export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email);
    if (error) throw new Error(error.message);
    await recordAdminAudit({
      actorUserId: context.userId,
      action: "user.password_reset",
      targetUserId: null,
      details: { method: "email_link", email: data.email },
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "contributor", "tester", "facilityUser"]),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    // Prevent self-demotion to avoid lockout
    if (data.userId === context.userId && !data.enabled) {
      throw new Error("You cannot remove the admin role from your own account.");
    }

    if (data.enabled) {
      // Enforce single-role: remove any other roles before assigning the new one
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .neq("role", data.role);
      if (delErr) throw new Error(delErr.message);

      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.userId, role: data.role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    await recordAdminAudit({
      actorUserId: context.userId,
      action: data.enabled ? "user.role_grant" : "user.role_revoke",
      targetUserId: data.userId,
      details: { role: data.role },
    });

    return { ok: true };
  });

export const clearUserSecurityAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("user_security_answers")
      .delete()
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await recordAdminAudit({
      actorUserId: context.userId,
      action: "user.security_answers_clear",
      targetUserId: data.userId,
    });
    return { ok: true };
  });

