import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

/** Returns the facility value for a facilityUser caller, or null if not a facilityUser. */
async function getFacilityUserScope(userId: string): Promise<string | null> {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "facilityUser")
    .maybeSingle();
  if (!roleRow) return null;
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("facility")
    .eq("user_id", userId)
    .maybeSingle();
  return (profile?.facility as string | null) ?? null;
}

const ACTIONS = [
  "user.create",
  "user.delete",
  "user.password_reset",
  "user.role_grant",
  "user.role_revoke",
  "user.security_answers_clear",
  "user.security_answers_change",
] as const;

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        action: z.enum(ACTIONS).optional(),
        search: z.string().trim().max(255).optional(),
        since: z.string().optional(),
        until: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    // facilityUsers can view the audit log scoped to their facility; others need admin
    const facilityScope = await getFacilityUserScope(context.userId);
    if (!facilityScope) {
      await assertAdmin(context.supabase, context.userId);
    }

    let q = supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.action) q = q.eq("action", data.action);
    if (data.since) q = q.gte("created_at", data.since);
    if (data.until) q = q.lte("created_at", data.until);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // For facilityUser callers, filter server-side after fetching. We cannot
    // push the user-ID filter into the DB query because the log records
    // reference actor+target, not a single facility field — both sides need
    // to be checked. Filtering here ensures no cross-facility data leaks.
    let facilityUserIds: Set<string> | null = null;
    if (facilityScope) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("facility", facilityScope);
      facilityUserIds = new Set((profiles ?? []).map((p) => p.user_id as string));
      // Always include the caller so their own admin actions appear in the log.
      facilityUserIds.add(context.userId);
    }

    // Collect user ids referenced (actor + target) so we can resolve
    // emails/usernames for display, since the writers don't always populate
    // the *_username columns.
    const ids = new Set<string>();
    for (const r of rows ?? []) {
      if (r.actor_user_id) ids.add(r.actor_user_id);
      if (r.target_user_id) ids.add(r.target_user_id);
    }
    const idList = Array.from(ids);

    const profileMap = new Map<string, { username: string | null }>();
    if (idList.length) {
      const { data: profs } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, username")
        .in("user_id", idList);
      for (const p of profs ?? []) {
        profileMap.set(p.user_id, { username: p.username });
      }
    }

    // Resolve auth emails via a single paginated listUsers() call rather than
    // one getUserById() per ID (which would be N sequential round-trips).
    const emailMap = new Map<string, string | null>();
    if (idList.length > 0) {
      const idSet = new Set(idList);
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of authData?.users ?? []) {
        if (idSet.has(u.id)) emailMap.set(u.id, u.email ?? null);
      }
    }

    const scoped = facilityUserIds
      ? (rows ?? []).filter(
          (r) =>
            (r.actor_user_id && facilityUserIds!.has(r.actor_user_id)) ||
            (r.target_user_id && facilityUserIds!.has(r.target_user_id)),
        )
      : (rows ?? []);

    let entries = scoped.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      action: r.action,
      actor_user_id: r.actor_user_id,
      actor_username:
        r.actor_username ??
        (r.actor_user_id ? profileMap.get(r.actor_user_id)?.username ?? null : null),
      actor_email: r.actor_user_id ? emailMap.get(r.actor_user_id) ?? null : null,
      target_user_id: r.target_user_id,
      target_username:
        r.target_username ??
        (r.target_user_id ? profileMap.get(r.target_user_id)?.username ?? null : null),
      target_email: r.target_user_id ? emailMap.get(r.target_user_id) ?? null : null,
      details: (r.details ?? {}) as Record<string, string | number | boolean | null>,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
    }));

    // Free-text search is done in JS rather than SQL because the searchable
    // fields span actor+target identities and the JSONB details column —
    // a full-text SQL OR across all of these would be significantly more complex.
    if (data.search) {
      const s = data.search.toLowerCase();
      entries = entries.filter((e) => {
        const blob = [
          e.actor_username,
          e.actor_email,
          e.target_username,
          e.target_email,
          e.ip_address,
          JSON.stringify(e.details),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(s);
      });
    }

    return { entries };
  });
