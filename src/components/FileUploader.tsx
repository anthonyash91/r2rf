import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSignedUploadUrl } from "@/lib/storage.functions";
import { actionButtonClassName } from "@/components/LoadingButton";

const BUCKET = "content-files";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Props = {
  onUploaded: (fileUrl: string, fileName: string | null) => void;
  onPendingDelete?: (oldStoragePath: string) => void;
  label?: string;
  mimeTypes?: string[];
  existingFileUrl?: string | null;
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
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getSignedUploadUrl);

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
      {uploading ? (
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading…
            </span>
            <span className="tabular-nums font-medium">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={actionButtonClassName("secondary")}
        >
          <Upload className="h-4 w-4" />
          {label}
        </button>
      )}
    </>
  );
}
