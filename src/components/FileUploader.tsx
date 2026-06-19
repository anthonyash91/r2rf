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
  className?: string;
  /** Optional content to render inside the drop zone before the upload button (e.g. a URL text input). */
  children?: React.ReactNode;
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
  label = "Upload File",
  mimeTypes,
  existingFileUrl,
  className,
  children,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const getUrl = useServerFn(getSignedUploadUrl);

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

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (!uploading) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
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
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex items-center gap-2 rounded-md border border-dashed px-4 py-3 transition-colors ${isDragging ? "border-foreground bg-muted" : "border-input"} ${className ?? ""}`}
      >
        {children}
        {uploading ? (
          <button
            type="button"
            disabled
            className={`${actionButtonClassName("secondary")} relative overflow-hidden w-40 flex-shrink-0`}
          >
            <span
              className="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-150 bg-foreground"
              style={{ width: `${uploadProgress}%` }}
            />
            <span className="relative z-10 flex items-center justify-center gap-2 w-full whitespace-nowrap text-foreground">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              Uploading
            </span>
            <span
              className="absolute inset-0 z-20 flex items-center justify-center gap-2 pointer-events-none whitespace-nowrap text-background transition-[clip-path] duration-150"
              style={{ clipPath: `inset(0 ${100 - uploadProgress}% 0 0)` }}
            >
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              Uploading
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`${actionButtonClassName("secondary")} flex-shrink-0`}
            >
              <Upload className="h-4 w-4" />
              {label}
            </button>
            <span className="text-sm text-muted-foreground">
              {children ? "or drag & drop" : "or drag a file here"}
            </span>
          </>
        )}
      </div>
    </>
  );
}
