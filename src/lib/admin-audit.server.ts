// Server-only helper for writing admin audit log entries.
// Writes use the service role client (bypasses RLS). RLS still blocks
// authenticated/anon writes — this helper is the only sanctioned writer.
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminAuditAction =
  | "user.create"
  | "user.delete"
  | "user.password_reset"
  | "user.role_grant"
  | "user.role_revoke"
  | "user.security_answers_clear"
  | "user.security_answers_change";

export interface AdminAuditEntry {
  actorUserId: string | null;
  actorUsername?: string | null;
  action: AdminAuditAction;
  targetUserId?: string | null;
  targetUsername?: string | null;
  details?: Record<string, unknown>;
}

function getRequestMeta(): { ip: string | null; userAgent: string | null } {
  try {
    const req = getRequest();
    if (!req?.headers) return { ip: null, userAgent: null };
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export async function recordAdminAudit(entry: AdminAuditEntry): Promise<void> {
  const meta = getRequestMeta();
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    actor_user_id: entry.actorUserId,
    actor_username: entry.actorUsername ?? null,
    action: entry.action,
    target_user_id: entry.targetUserId ?? null,
    target_username: entry.targetUsername ?? null,
    details: entry.details ?? {},
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });
  if (error) {
    // Do not throw — audit failures must not block the underlying admin
    // action, but they MUST be loud in logs for ops to investigate.
    console.error("[admin-audit] insert failed:", error.message, entry);
  }
}
