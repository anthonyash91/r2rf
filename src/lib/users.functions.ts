import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";


type Role = "admin" | "contributor" | "user";

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
    const { count, error } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id", { count: "exact", head: true })
      .gt("created_at", data.since);
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
        emailConfirm: z.boolean().optional(),
        role: z.enum(["admin", "contributor"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: data.emailConfirm ?? true,
    });
    if (error) throw new Error(error.message);
    if (data.role && created.user) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: data.role });
      if (roleErr) throw new Error(roleErr.message);
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
    await supabaseAdmin.from("user_signup_ips").delete().eq("user_id", data.userId);
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
        await supabaseAdmin.from("user_signup_ips").delete().eq("user_id", userId);
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw new Error(error.message);
        deleted++;
      } catch (e: any) {
        failed.push({ userId, message: e?.message ?? "unknown error" });
      }
    }
    return { deleted, failed, skippedSelf: data.userIds.length - targets.length };
  });

export const recordMySignupIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ip = getClientIp(getRequest());
    if (!ip) return { ok: false, reason: "no-ip" as const };
    await supabaseAdmin
      .from("user_signup_ips")
      .upsert(
        { user_id: context.userId, ip_address: ip },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    return { ok: true };
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
        role: z.enum(["admin", "contributor"]),
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
    return { ok: true };
  });

