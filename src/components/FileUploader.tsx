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
    const u = new URL(url);
    if (!SUPABASE_URL || !u.href.startsWith(SUPABASE_URL)) return null;
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
    setUploading(true);
    setUploadProgress(0);
    try {
      const path = `uploads/${Date.now()}-${safeName(file.name)}`;
      const oldPath = existingFileUrl ? extractStoragePath(existingFileUrl) : null;

      const { token, publicUrl } = await getUrl({ data: { path } });

      // Construct the Supabase signed-upload endpoint directly so we can use
      // XHR instead of the Supabase client — XHR exposes upload.onprogress,
      // which fetch and the Supabase JS client do not.
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
        // Text color: badge bg mixed against white so it renders as a visible
        // light tint rather than a near-invisible transparent overlay
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
            {/* Fill: badge text color + badge border on leading edge */}
            <span
              className="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-150"
              style={{ width: `${uploadProgress}%`, backgroundColor: ps.color, borderRight: `2px solid ${ps.border}` }}
            />

            {/* Base text layer — light tint of badge color */}
            <span className="relative z-10 flex items-center justify-center gap-2 w-full whitespace-nowrap tabular-nums" style={{ color: uploadTextColor }}>
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              {uploadingLabel}
            </span>

            {/* Revealed text layer — same light tint, clipped to fill */}
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
