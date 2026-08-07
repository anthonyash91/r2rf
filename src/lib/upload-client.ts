import { supabase } from "@/integrations/supabase/client";

/**
 * Shared browser-side upload helper for the raw /api/uploads/* routes.
 * Consolidates what used to be 3 separate implementations (FileUploader.tsx,
 * the chapter batch uploader in admin.category.$id.tsx, and TestingTab.tsx's
 * QA screenshot uploader) — all duplicated the same signed-URL + XHR dance
 * against Supabase. Since Bunny has no client-safe upload credential, every
 * upload now proxies through our server, so there's one implementation of
 * that proxy call instead of three.
 */

export type UploadKind = "content-file" | "qa-screenshot";

const CONTENT_FILE_MAX_MB: Record<string, number> = {
  mp4: 500,
  webm: 500,
  mov: 500,
  mp3: 100,
  wav: 100,
  ogg: 100,
  m4a: 100,
  pdf: 50,
  jpg: 20,
  jpeg: 20,
  png: 20,
  gif: 20,
  webp: 20,
};

const QA_SCREENSHOT_MAX_MB: Record<string, number> = {
  png: 20,
  jpg: 20,
  jpeg: 20,
  gif: 20,
  webp: 20,
};

function extensionOf(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

// Client-side pre-check only, for fast UX feedback without a round trip.
// The server enforces the real limits against the actual byte stream —
// see src/lib/upload-handler.server.ts — so this is not authoritative.
function precheck(file: File, kind: UploadKind) {
  const ext = extensionOf(file.name);
  const table = kind === "content-file" ? CONTENT_FILE_MAX_MB : QA_SCREENSHOT_MAX_MB;
  const maxMb = table[ext];
  if (!maxMb) throw new Error(`File type .${ext} is not allowed.`);
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`File exceeds the ${maxMb} MB limit for .${ext} files.`);
  }
}

type UploadResult = { path: string; publicUrl: string };

/** Upload a file via XHR so we get real byte-level progress events. */
function xhrUpload(
  url: string,
  file: File,
  token: string | undefined,
  onProgress: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Upload succeeded but the response could not be read."));
        }
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed?.error) message = parsed.error;
      } catch {
        // response wasn't JSON — fall back to the generic message
      }
      reject(new Error(message));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.open("PUT", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

export type UploadLanguage = "english" | "spanish";

export async function uploadFile(opts: {
  file: File;
  kind: UploadKind;
  /** Required when kind is "content-file" — organizes uploads as uploads/{categorySlug}/{itemFolder}/{language}/... */
  categorySlug?: string;
  /** Required when kind is "content-file". */
  itemFolder?: string;
  /** Required when kind is "content-file". */
  language?: UploadLanguage;
  /** Required when kind is "qa-screenshot". */
  runId?: string;
  /** Required when kind is "qa-screenshot". */
  testId?: string;
  onProgress?: (pct: number) => void;
}): Promise<UploadResult> {
  const { file, kind, categorySlug, itemFolder, language, runId, testId, onProgress } = opts;
  precheck(file, kind);

  // createFileRoute routes don't go through the createServerFn RPC layer, so
  // the bearer token isn't attached automatically the way it is for server
  // functions — attach it by hand (see upload-handler.server.ts's authenticateBearer).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const params = new URLSearchParams({ filename: file.name });
  if (kind === "content-file") {
    if (!categorySlug || !itemFolder || !language) {
      throw new Error(
        "categorySlug, itemFolder, and language are required for content-file uploads.",
      );
    }
    params.set("categorySlug", categorySlug);
    params.set("itemFolder", itemFolder);
    params.set("language", language);
  }
  if (kind === "qa-screenshot") {
    if (!runId || !testId)
      throw new Error("runId and testId are required for qa-screenshot uploads.");
    params.set("runId", runId);
    params.set("testId", testId);
  }

  return xhrUpload(
    `/api/uploads/${kind}?${params.toString()}`,
    file,
    token,
    onProgress ?? (() => {}),
  );
}
