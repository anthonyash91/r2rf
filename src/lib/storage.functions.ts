import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdminOrContributor } from "@/lib/server-auth";
import { deleteFromBunny, bunnyCdnHostname } from "@/lib/bunny-storage.server";
import { deleteStreamVideo } from "@/lib/bunny-stream.server";
import { extractStorageRef } from "@/lib/storage-url";

const BUCKET = "content-files";

/**
 * Deletes a file by its public URL, regardless of which provider it's hosted
 * on. The provider is re-derived from the URL server-side (extractStorageRef)
 * rather than trusted from the client — during the Supabase → Bunny
 * migration, content may still reference either provider, and this keeps
 * delete/replace working unchanged for both without a flag day.
 * Silently succeeds if the file doesn't exist, or if the URL doesn't match
 * either provider (e.g. an admin-entered external link — nothing to delete).
 */
export const deleteStorageFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ url: z.string().min(1).max(2000) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.userId);

    const ref = extractStorageRef(data.url);
    if (!ref) return { ok: true }; // not one of our managed files — nothing to delete

    if (ref.provider === "supabase") {
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove([ref.path]);
      if (error && !error.message.toLowerCase().includes("not found")) {
        throw new Error(error.message);
      }
    } else if (ref.provider === "bunny-stream") {
      await deleteStreamVideo(ref.videoId);
    } else {
      await deleteFromBunny(ref.path);
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
  .inputValidator((input) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.userId);

    // SSRF guard: only allow HTTPS fetches to our own storage hostnames. This
    // prevents the server from being used as a proxy to reach internal
    // services, cloud metadata endpoints (169.254.169.254), or arbitrary
    // external hosts. Supabase stays allowlisted temporarily during the
    // Bunny migration — remove once all content has been migrated.
    const parsedUrl = new URL(data.url);
    if (parsedUrl.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are supported for PDF duration estimation.");
    }
    const allowedHosts = new Set([new URL(process.env.SUPABASE_URL!).hostname]);
    try {
      allowedHosts.add(bunnyCdnHostname());
    } catch {
      // Bunny not configured yet — Supabase-only allowlist still applies.
    }
    if (!allowedHosts.has(parsedUrl.hostname)) {
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
        const text = content.items.map((i: any) => ("str" in i ? i.str : "")).join(" ");
        const words = text
          .trim()
          .split(/\s+/)
          .filter((w: string) => w.length > 0);
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
