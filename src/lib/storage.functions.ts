import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "content-files";

async function assertAdminOrContributor(supabase: any, userId: string) {
  const [adminRes, contribRes] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "contributor" }),
  ]);
  if (!adminRes.data && !contribRes.data) {
    throw new Error("Forbidden: admin or contributor access required");
  }
}

/**
 * Returns a signed upload URL and the resulting public URL for a given storage path.
 * The client uploads directly to Supabase Storage using the token — the file never
 * passes through the server.
 */
export const getSignedUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ path: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.supabase, context.userId);

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(data.path);
    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return { signedUrl: signed.signedUrl, token: signed.token, path: data.path, publicUrl };
  });

/**
 * Deletes a file from Supabase Storage by its storage path (e.g. "uploads/file.mp4").
 * Silently succeeds if the file doesn't exist.
 */
export const deleteStorageFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ path: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.supabase, context.userId);

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([data.path]);

    // "not found" is fine — the file was already gone
    if (error && !error.message.toLowerCase().includes("not found")) {
      throw new Error(error.message);
    }
    return { ok: true };
  });
