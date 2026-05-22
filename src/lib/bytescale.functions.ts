import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBytescaleConfig = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env.BYTESCALE_PUBLIC_API_KEY;
  if (!apiKey) throw new Error("BYTESCALE_PUBLIC_API_KEY is not configured");
  return { apiKey };
});

// Account ID is the 7-character prefix encoded in the Bytescale API key
// (both public and secret keys: e.g. `public_ABCDEFG...` / `secret_ABCDEFG...`).
function getAccountId(key: string): string {
  const m = key.match(/^(?:public|secret)_([A-Za-z0-9]{7})/);
  if (!m) throw new Error("Invalid Bytescale API key format");
  return m[1];
}

export const deleteBytescaleFileIfExists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      filePath: z.string().min(1).max(1024).regex(/^\/[A-Za-z0-9._\-/ ]+$/),
    }).parse,
  )
  .handler(async ({ data }) => {
    const secret = process.env.BYTESCALE_SECRET_API_KEY;
    if (!secret) throw new Error("BYTESCALE_SECRET_API_KEY is not configured");
    const accountId = getAccountId(secret);

    const url = `https://api.bytescale.com/v2/accounts/${accountId}/files?filePath=${encodeURIComponent(data.filePath)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secret}` },
    });

    // 200/204 = deleted, 404 = didn't exist (all fine)
    if (res.ok || res.status === 404) {
      return { deleted: res.ok };
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Bytescale delete failed (${res.status}): ${body}`);
  });
