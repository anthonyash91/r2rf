// Server-only Bunny Storage + CDN integration. Never import from client code.
// Bunny's Storage API has no presigned/temporary upload credential — only a
// permanent per-zone AccessKey, which can never be exposed to the browser.
// Uploads are therefore proxied through our own server (see upload-handler.server.ts)
// rather than uploaded directly from the client, unlike the old Supabase flow.

// Each getter below requires only the env var(s) it actually needs, rather
// than one bundled config object requiring all four — so, e.g., looking up
// just the CDN hostname (SSRF allowlists, storage-url.ts) doesn't fail if the
// storage-write credentials happen to be unset.
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Bunny environment variable: ${name}`);
  return value;
}

// BUNNY_STORAGE_ENDPOINT and BUNNY_CDN_HOSTNAME are meant to be bare hostnames
// (e.g. "storage.bunnycdn.com"), but Bunny's dashboard often *displays* the
// endpoint together with the zone name as a path segment (e.g.
// "ny.storage.bunnycdn.com/zone-name"), which is an easy value to copy-paste
// whole by mistake. Since bunnyObjectUrl() appends the zone separately, a
// path segment left in the endpoint silently doubles it up — the object
// lands one directory deeper than every other codepath expects, with no
// error, just files that appear "missing" everywhere except at the wrong
// path. Strip scheme, path, and trailing slash so only the bare hostname survives.
function requiredHostnameEnv(name: string): string {
  const raw = requiredEnv(name).replace(/^https?:\/\//i, "");
  return raw.split("/")[0];
}

export function bunnyObjectUrl(path: string): string {
  const zone = requiredEnv("BUNNY_STORAGE_ZONE");
  const endpoint = requiredHostnameEnv("BUNNY_STORAGE_ENDPOINT");
  return `https://${endpoint}/${zone}/${path}`;
}

/** Returns the CDN hostname, e.g. for SSRF allowlists. Throws if unconfigured. */
export function bunnyCdnHostname(): string {
  return requiredHostnameEnv("BUNNY_CDN_HOSTNAME");
}

export function bunnyPublicUrl(path: string): string {
  return `https://${bunnyCdnHostname()}/${path}`;
}

/** Deletes an object from Bunny Storage. Treats "not found" as success. */
export async function deleteFromBunny(path: string): Promise<void> {
  const apiKey = requiredEnv("BUNNY_STORAGE_API_KEY");
  const res = await fetch(bunnyObjectUrl(path), {
    method: "DELETE",
    headers: { AccessKey: apiKey },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bunny delete failed (${res.status}): ${body}`);
  }
}

/**
 * Streams an incoming request body straight through to Bunny Storage without
 * buffering the whole file in memory. Enforces maxBytes against the real byte
 * count as it flows through (not just a Content-Length header, which a client
 * could lie about) and aborts mid-stream if exceeded.
 *
 * Returns the number of bytes written on success.
 */
export async function streamUploadToBunny(
  path: string,
  request: Request,
  maxBytes: number,
  contentType?: string,
): Promise<number> {
  const apiKey = requiredEnv("BUNNY_STORAGE_API_KEY");
  const limitMb = Math.round(maxBytes / (1024 * 1024));

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    throw new Error(`File exceeds the ${limitMb} MB limit.`);
  }
  if (!request.body) {
    throw new Error("Upload request has no body.");
  }

  let total = 0;
  let limitExceeded = false;
  const controller = new AbortController();

  const counting = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        limitExceeded = true;
        controller.abort();
        ctrl.error(new Error(`File exceeds the ${limitMb} MB limit.`));
        return;
      }
      ctrl.enqueue(chunk);
    },
  });

  const piped = request.body.pipeThrough(counting);

  let res: Response;
  try {
    res = await fetch(bunnyObjectUrl(path), {
      method: "PUT",
      headers: {
        AccessKey: apiKey,
        "Content-Type": contentType || "application/octet-stream",
      },
      body: piped,
      // Required by Node's fetch (undici) whenever body is a stream.
      duplex: "half",
      signal: controller.signal,
    } as RequestInit);
  } catch (err) {
    await deleteFromBunny(path).catch(() => {});
    if (limitExceeded) throw new Error(`File exceeds the ${limitMb} MB limit.`);
    throw err;
  }

  if (!res.ok) {
    await deleteFromBunny(path).catch(() => {});
    const body = await res.text().catch(() => "");
    throw new Error(`Bunny upload failed (${res.status}): ${body}`);
  }

  return total;
}
