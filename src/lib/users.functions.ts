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

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const ids = usersData.users.map((u) => u.id);
    const idsForQuery = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", idsForQuery);

    const { data: profileRows } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, username, facility, first_name, last_name")
      .in("user_id", idsForQuery);

    const rolesByUser = new Map<string, Role[]>();
    for (const r of roleRows ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      rolesByUser.set(r.user_id, arr);
    }

    const profileByUser = new Map<string, { username: string; facility: string; first_name: string; last_name: string }>();
    for (const p of profileRows ?? []) {
      profileByUser.set(p.user_id, { username: p.username, facility: p.facility, first_name: (p as any).first_name ?? "", last_name: (p as any).last_name ?? "" });
    }

    return {
      users: usersData.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: (u as any).email_confirmed_at ?? null,
        roles: rolesByUser.get(u.id) ?? [],

        profile: profileByUser.get(u.id) ?? null,
      })),
    };
  });

export const countNewUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ since: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // Exclude admin/contributor/tester accounts — only count self-signed-up users.
    const { data: privilegedRoles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "contributor", "tester"]);
    if (rolesErr) throw new Error(rolesErr.message);
    const excludeIds = Array.from(new Set((privilegedRoles ?? []).map((r) => r.user_id)));
    let q = supabaseAdmin
      .from("user_profiles")
      .select("user_id", { count: "exact", head: true })
      .gt("created_at", data.since);
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

export const clearMustResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: userRes, error: getErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (getErr) throw new Error(getErr.message);
    const meta = { ...((userRes?.user?.user_metadata ?? {}) as Record<string, unknown>) };
    meta.must_reset_password = false;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: meta,
    });
    if (error) throw new Error(error.message);
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
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "contributor", "tester"]),
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

