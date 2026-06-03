import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSignedUploadUrl } from "@/lib/storage.functions";
import { actionButtonClassName } from "@/components/LoadingButton";
import { useBadgeStyles } from "@/hooks/use-badge-styles";
import { paletteStyle, indexForType } from "@/lib/badge-styles";

const BUCKET = "content-files";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Props = {
  onUploaded: (fileUrl: string, fileName: string | null) => void;
  onPendingDelete?: (oldStoragePath: string) => void;
  label?: string;
  mimeTypes?: string[];
  existingFileUrl?: string | null;
  /** Content type string (e.g. "video", "pdf") — used to match the type badge color during upload. */
  contentType?: string | null;
};

function extractStoragePath(url: string): string | null {
  try {
    if (!SUPABASE_URL || !url) return null;
    const u = new URL(url);
    if (!u.href.startsWith(SUPABASE_URL)) return null;
    const match = u.pathname.match(new RegExp(`/object/public/${BUCKET}/(.+)$`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._\-]/g, "_");
}

/** Upload a file via XHR so we get real byte-level progress events. */
function xhrUpload(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

export function FileUploader({
  onUploaded,
  onPendingDelete,
  label = "Upload file to fill URL",
  mimeTypes,
  existingFileUrl,
  contentType,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getSignedUploadUrl);
  const badgeStyles = useBadgeStyles();
  const ps = paletteStyle(indexForType(contentType, badgeStyles));

  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const maxMb: Record<string, number> = {
      mp4: 500, webm: 500, mov: 500,
      mp3: 100, wav: 100, ogg: 100, m4a: 100,
      pdf: 50,
      jpg: 20, jpeg: 20, png: 20, gif: 20, webp: 20,
    };
    const allowed = new Set(Object.keys(maxMb));
    if (!allowed.has(ext)) {
      toast.error(`File type .${ext} is not allowed.`);
      return;
    }
    const limitMb = maxMb[ext];
    if (file.size > limitMb * 1024 * 1024) {
      toast.error(`File exceeds the ${limitMb} MB limit for .${ext} files.`);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const path = `uploads/${Date.now()}-${safeName(file.name)}`;
      const oldPath = existingFileUrl ? extractStoragePath(existingFileUrl) : null;

      const { token, publicUrl } = await getUrl({ data: { path } });

      // Build the Supabase signed-upload URL manually so we can use XHR.
      // XHR exposes upload.onprogress for byte-level progress; fetch and the
      // Supabase JS client provide no equivalent upload progress event.
      const uploadUrl =
        `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}` +
        `?token=${encodeURIComponent(token)}`;

      await xhrUpload(uploadUrl, file, setUploadProgress);

      onUploaded(publicUrl, file.name);

      if (oldPath && onPendingDelete) {
        onPendingDelete(oldPath);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={mimeTypes?.join(",") ?? undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {(() => {
        const typeName = contentType
          ? contentType.charAt(0).toUpperCase() + contentType.slice(1)
          : null;
        const uploadingLabel = typeName
          ? `${uploadProgress}% Uploading ${typeName}`
          : `${uploadProgress}% uploading…`;
        // Mix the badge color against white (not transparent) so the clipped
        // "revealed" text layer reads as a visible light tint on the fill swatch.
        const uploadTextColor = `color-mix(in oklab, ${ps.color} 15%, white)`;
        return (
      <button
        type="button"
        disabled={uploading}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`${actionButtonClassName("secondary")} relative overflow-hidden ${uploading ? "w-52" : ""}`}
      >
        {uploading ? (
          <>
            {/* Moving fill — badge background color with a border accent on its leading edge. */}
            <span
              className="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-150"
              style={{ width: `${uploadProgress}%`, backgroundColor: ps.color, borderRight: `2px solid ${ps.border}` }}
            />

            {/* Base text layer — badge-color text, fully visible in the unfilled region. */}
            <span className="relative z-10 flex items-center justify-center gap-2 w-full whitespace-nowrap tabular-nums" style={{ color: ps.color }}>
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              {uploadingLabel}
            </span>

            {/* Revealed text layer — light-tint text clipped to the filled region, creating
                a two-tone readout: dark text on fill, light text on background. */}
            <span
              className="absolute inset-0 z-20 flex items-center justify-center gap-2 pointer-events-none whitespace-nowrap tabular-nums transition-[clip-path] duration-150"
              style={{ clipPath: `inset(0 ${100 - uploadProgress}% 0 0)`, color: uploadTextColor }}
            >
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              {uploadingLabel}
            </span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {label}
          </>
        )}
      </button>
        );
      })()}
    </>
  );
}
