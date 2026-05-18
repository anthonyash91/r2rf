import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UploadButton } from "@bytescale/upload-widget-react";
import { getBytescaleConfig, deleteBytescaleFileIfExists } from "@/lib/bytescale.functions";
import { Upload } from "lucide-react";

type Props = {
  onUploaded: (fileUrl: string, fileName: string | null) => void;
  label?: string;
  mimeTypes?: string[];
  /** Existing Bytescale file URL — if provided, that exact file is deleted before the new upload. */
  existingFileUrl?: string | null;
};

// Extract the Bytescale filePath (e.g. "/uploads/foo.png") from a stored URL.
// Strips any cache-busting query string and the CDN/account/transformation prefix.
function extractBytescaleFilePath(url: string): string | null {
  try {
    const u = new URL(url);
    const decode = (p: string) => { try { return decodeURIComponent(p); } catch { return p; } };
    const m = u.pathname.match(/\/(raw|image|video|audio)\/(.+)$/);
    if (m) return decode("/" + m[2]);
    const up = u.pathname.indexOf("/uploads/");
    if (up !== -1) return decode(u.pathname.slice(up));
    return null;
  } catch {
    return null;
  }
}

export function FileUploader({ onUploaded, label = "Upload file to fill URL", mimeTypes, existingFileUrl }: Props) {
  const fetchConfig = useServerFn(getBytescaleConfig);
  const deleteIfExists = useServerFn(deleteBytescaleFileIfExists);
  const { data, isLoading, error } = useQuery({
    queryKey: ["bytescale-config"],
    queryFn: () => fetchConfig(),
    staleTime: Infinity,
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading uploader…</p>;
  }
  if (error || !data) {
    return <p className="text-xs text-destructive">Upload unavailable: {(error as Error)?.message ?? "missing config"}</p>;
  }

  return (
    <UploadButton
      options={{
        apiKey: data.apiKey,
        maxFileCount: 1,
        showFinishButton: true,
        path: {
          folderPath: "/uploads",
          fileName: "{ORIGINAL_FILE_NAME}{ORIGINAL_FILE_EXT}",
        },
        ...(mimeTypes ? { mimeTypes } : {}),
        onPreUpload: async (file) => {
          // Sanitize to match the path template above; replace disallowed chars with "_"
          const original = file.name ?? "";
          const safe = original.replace(/[^A-Za-z0-9._\- ]/g, "_");
          const targets = new Set<string>();
          if (safe) targets.add(`/uploads/${safe}`);
          // Also remove the previous file if its path differs from the new upload's path
          if (existingFileUrl) {
            const prev = extractBytescaleFilePath(existingFileUrl);
            if (prev) targets.add(prev);
          }
          try {
            await Promise.all(
              Array.from(targets).map((filePath) => deleteIfExists({ data: { filePath } })),
            );
          } catch (err) {
            return { errorMessage: `Could not replace existing file: ${(err as Error).message}` };
          }
          return undefined;
        },
      }}
      onComplete={(files) => {
        const f = files[0];
        if (f) {
          // Append a cache-buster so a re-upload with the same filename still produces a
          // changed URL (forces DB update + bypasses browser/CDN cache of the old image).
          const sep = f.fileUrl.includes("?") ? "&" : "?";
          const bustedUrl = `${f.fileUrl}${sep}v=${Date.now()}`;
          onUploaded(bustedUrl, f.originalFile.originalFileName ?? null);
        }
      }}
    >
      {({ onClick }) => (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          <Upload className="h-4 w-4" /> {label}
        </button>
      )}
    </UploadButton>
  );
}
