import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bunnyPublicUrl, streamUploadToBunny } from "@/lib/bunny-storage.server";

/**
 * Shared streaming-upload core for the raw /api/uploads/* routes.
 * These routes use createFileRoute (not createServerFn) because they need a
 * real, streamable Request body — see the auth note below for the tradeoff.
 */

// createServerFn RPCs get their Authorization header attached automatically by
// attachSupabaseAuth (a functionMiddleware, registered in src/start.ts). Raw
// fetch/XHR calls to a createFileRoute route bypass that entirely, so callers
// must attach the header manually (see upload-client.ts) and routes must
// verify it by hand — same pattern already used in api/public/log-error.ts.
export async function authenticateBearer(request: Request): Promise<string> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No bearer token provided");
  }
  const token = auth.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized: Invalid token");
  return data.user.id;
}

type UploadPolicy = {
  authorize: (userId: string, query: URLSearchParams) => Promise<void>;
  buildPath: (filename: string, query: URLSearchParams) => { path: string; maxBytes: number };
};

export async function handleUploadRequest(
  request: Request,
  policy: UploadPolicy,
): Promise<Response> {
  try {
    const userId = await authenticateBearer(request);
    const url = new URL(request.url);
    await policy.authorize(userId, url.searchParams);

    const filename = url.searchParams.get("filename");
    if (!filename) throw new Error("Missing filename query parameter.");

    const { path, maxBytes } = policy.buildPath(filename, url.searchParams);
    const contentType = request.headers.get("content-type") ?? undefined;

    await streamUploadToBunny(path, request, maxBytes, contentType);

    return new Response(JSON.stringify({ path, publicUrl: bunnyPublicUrl(path) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    const message = err?.message ?? "Upload failed";
    const status = message.startsWith("Unauthorized")
      ? 401
      : message.startsWith("Forbidden")
        ? 403
        : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_");
}

function extensionOf(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

// Folder segments (category slug, item folder) come from the client and are
// organizational only — not a security boundary, since this endpoint is
// already gated to admin/contributor. Still sanitized so a stray value can
// never inject '/' or '..' and escape the intended nesting, same principle
// as safeName() above but collapsed to a single flat segment.
function safeSegment(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || fallback;
}

// ---- Content file policy (admin/contributor; content items + chapters) ----

const CONTENT_FILE_MAX_MB: Record<string, number> = {
  mp4: 500,
  webm: 500,
  mov: 500, // video
  mp3: 100,
  wav: 100,
  ogg: 100,
  m4a: 100, // audio
  pdf: 50, // documents
  jpg: 20,
  jpeg: 20,
  png: 20,
  gif: 20,
  webp: 20, // images
};

const LANGUAGE_FOLDERS = new Set(["english", "spanish"]);

/**
 * Builds the storage path for a content file:
 * uploads/{category-slug}/{item-folder}/{english|spanish}/{timestamp}-{filename}
 *
 * categorySlug, itemFolder, and language are all chosen client-side (see
 * admin.category.$id.tsx) — language maps directly from which form field the
 * upload came from (main file / EN chapter audio → english; ES audio fields →
 * spanish) so there's no ambiguity to resolve here, just validation.
 *
 * Unlike the old Supabase flow (where the client sent a full path the server
 * had to validate for traversal), the client here only ever sends bare
 * segments — the server builds the path itself, so traversal is prevented by
 * construction rather than by validating untrusted input.
 */
export function validateContentFilePath(
  filename: string,
  categorySlug: string,
  itemFolder: string,
  language: string,
): { path: string; maxBytes: number } {
  const ext = extensionOf(filename);
  const maxMb = CONTENT_FILE_MAX_MB[ext];
  if (!maxMb) {
    throw new Error(
      `File type .${ext} is not allowed. Permitted: ${Object.keys(CONTENT_FILE_MAX_MB).join(", ")}`,
    );
  }
  if (!LANGUAGE_FOLDERS.has(language)) {
    throw new Error('Language must be "english" or "spanish".');
  }
  const category = safeSegment(categorySlug, "uncategorized");
  const item = safeSegment(itemFolder, "misc");
  return {
    path: `uploads/${category}/${item}/${language}/${Date.now()}-${safeName(filename)}`,
    maxBytes: maxMb * 1024 * 1024,
  };
}

// ---- QA screenshot policy (run owner only; images only) ----

const QA_SCREENSHOT_MAX_MB: Record<string, number> = {
  png: 20,
  jpg: 20,
  jpeg: 20,
  gif: 20,
  webp: 20,
};

export function validateQaScreenshotPath(
  filename: string,
  runId: string,
  testId: string,
): { path: string; maxBytes: number } {
  const ext = extensionOf(filename) || "png";
  const maxMb = QA_SCREENSHOT_MAX_MB[ext];
  if (!maxMb) {
    throw new Error(
      `Only image files are allowed (${Object.keys(QA_SCREENSHOT_MAX_MB).join(", ")})`,
    );
  }
  return {
    path: `qa-screenshots/${runId}/${testId}/${Date.now()}.${ext}`,
    maxBytes: maxMb * 1024 * 1024,
  };
}
