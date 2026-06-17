import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdminOrContributor } from "@/lib/server-auth";

const BUCKET = "content-files";

const ALLOWED_EXTENSIONS = new Set([
  "mp4", "webm", "mov",          // video
  "mp3", "wav", "ogg", "m4a",   // audio
  "pdf",                          // documents
  "jpg", "jpeg", "png", "gif", "webp", // images
]);

const MAX_SIZES: Record<string, number> = {
  mp4: 500, webm: 500, mov: 500,
  mp3: 100, wav: 100, ogg: 100, m4a: 100,
  pdf: 50,
  jpg: 20, jpeg: 20, png: 20, gif: 20, webp: 20,
}; // MB

function validateUploadPath(path: string): string {
  // Normalize slashes and collapse any . / .. segments to prevent path traversal.
  const normalized = path
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg !== "" && seg !== "." && seg !== "..")
    .join("/");

  if (normalized !== path.replace(/^\//, "")) {
    throw new Error("Invalid path: path traversal sequences are not allowed.");
  }
  // Enforce that all files live under the uploads/ prefix so callers cannot
  // target arbitrary bucket paths (e.g. a sibling bucket or private prefix).
  if (!normalized.startsWith("uploads/")) {
    throw new Error("Files must be stored under the uploads/ prefix.");
  }
  const ext = normalized.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type .${ext} is not allowed. Permitted: ${[...ALLOWED_EXTENSIONS].join(", ")}`);
  }
  return ext;
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
    await assertAdminOrContributor(context.userId);
    validateUploadPath(data.path);

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
    await assertAdminOrContributor(context.userId);
    validateUploadPath(data.path); // same sanitization — rejects traversal and non-uploads/ paths

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
    await assertAdminOrContributor(context.userId);

    // SSRF guard: only allow HTTPS fetches to the configured Supabase storage
    // hostname. This prevents the server from being used as a proxy to reach
    // internal services, cloud metadata endpoints (169.254.169.254), or
    // arbitrary external hosts.
    const parsedUrl = new URL(data.url);
    if (parsedUrl.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are supported for PDF duration estimation.");
    }
    const projectHost = new URL(process.env.SUPABASE_URL!).hostname;
    if (parsedUrl.hostname !== projectHost) {
      throw new Error("PDF URL must point to this project's storage.");
    }

    try {
      // Fetch the PDF bytes server-side
      const res = await fetch(data.url);
      if (!res.ok) return { minutes: 0 };
      const pdfData = new Uint8Array(await res.arrayBuffer());

      // Use the legacy build — designed for non-browser environments and
      // avoids the DOMMatrix / browser-API errors that the main build throws
      // in Node.js. In Node.js we resolve the worker file path so pdfjs can
      // spawn it as a thread; in Cloudflare Workers (no node:module/node:url)
      // we skip the worker src entirely and pdfjs falls back to synchronous
      // in-process parsing.
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
      if (typeof process !== "undefined" && process.versions?.node) {
        const [{ createRequire }, { pathToFileURL }] = await Promise.all([
          import("module"),
          import("url"),
        ]);
        const req = createRequire(import.meta.url);
        const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      }

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
