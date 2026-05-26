import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const listErrorLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        source: z.enum(["server", "client"]).optional(),
        since: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    let q = supabaseAdmin
      .from("error_logs")
      .select(
        "id, source, level, message, stack, route, ip_address, user_agent, user_id, context, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.source) q = q.eq("source", data.source);
    if (data.since) q = q.gte("created_at", data.since);

    const { data: rows, error } = await q;
    if (error) throw new Error("Failed to load error logs");

    // Optionally enrich with usernames
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[]));
    let usernameById = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, username")
        .in("user_id", userIds);
      usernameById = new Map((profiles ?? []).map((p) => [p.user_id, p.username]));
    }

    return {
      entries: (rows ?? []).map((r) => ({
        ...r,
        username: r.user_id ? usernameById.get(r.user_id) ?? null : null,
      })),
    };
  });

export const clearOldErrorLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ olderThanDays: z.number().int().min(1).max(365).default(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const cutoff = new Date(Date.now() - data.olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("error_logs").delete().lt("created_at", cutoff);
    if (error) throw new Error("Failed to clear old logs");
    return { ok: true as const };
  });

export const deleteAllErrorLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("error_logs")
      .delete()
      .gte("created_at", "1900-01-01");
    if (error) throw new Error("Failed to clear logs");
    return { ok: true as const };
  });
