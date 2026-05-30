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

/**
 * Server-side PDF reading time estimation.
 * Runs in Node.js so there are no browser worker or Vite URL transform
 * complications. Extracts actual word count via pdfjs-dist and calculates
 * reading time at 120 WPM (calibrated for a 6th-grade reading level).
 * Falls back to 1.5 min/page for scanned/image-only PDFs.
 */
export const estimatePdfDuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ url: z.string().url().max(2000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.supabase, context.userId);
    try {
      // Fetch the PDF bytes server-side
      const res = await fetch(data.url);
      if (!res.ok) return { minutes: 0 };
      const pdfData = new Uint8Array(await res.arrayBuffer());

      // Dynamically import pdfjs-dist — runs in Node.js, no web worker needed.
      // createRequire resolves the worker path relative to installed packages,
      // which is reliable across any deployment environment.
      const [pdfjsLib, { createRequire }, { pathToFileURL }] = await Promise.all([
        import("pdfjs-dist"),
        import("module"),
        import("url"),
      ]);

      const req = createRequire(import.meta.url);
      const workerPath = req.resolve("pdfjs-dist/build/pdf.worker.mjs");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

      const doc = await pdfjsLib.getDocument({ data: pdfData, verbosity: 0 }).promise;
      const pageCount = doc.numPages;
      if (pageCount === 0) return { minutes: 0 };

      let totalWords = 0;
      for (let p = 1; p <= pageCount; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items
          .map((i: any) => ("str" in i ? i.str : ""))
          .join(" ");
        const words = text.trim().split(/\s+/).filter((w: string) => w.length > 0);
        totalWords += words.length;
      }

      const wordsPerPage = totalWords / pageCount;
      if (wordsPerPage >= 30) {
        // Text-based PDF — word count at 120 WPM (6th-grade reading level)
        return { minutes: Math.max(1, Math.ceil(totalWords / 120)) };
      }
      // Scanned / image-only PDF — fall back to page-count estimate
      return { minutes: Math.max(1, Math.round(pageCount * 1.5)) };
    } catch (e: any) {
      console.error("[estimatePdfDuration]", e?.message ?? e);
      return { minutes: 0 };
    }
  });
