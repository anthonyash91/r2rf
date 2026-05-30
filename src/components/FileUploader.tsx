import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUploadUrl } from "@/lib/storage.functions";
import { actionButtonClassName } from "@/components/LoadingButton";

const BUCKET = "content-files";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Props = {
  onUploaded: (fileUrl: string, fileName: string | null) => void;
  /**
   * Called after a successful upload when there was a pre-existing Supabase
   * file. The caller should queue this path and delete it only after the
   * form is saved successfully — that way a cancelled form never leaves a
   * broken content URL.
   */
  onPendingDelete?: (oldStoragePath: string) => void;
  label?: string;
  mimeTypes?: string[];
  /** Existing Supabase storage URL — used to resolve the old path for cleanup. */
  existingFileUrl?: string | null;
};

/** Extracts the storage path from a Supabase public file URL, or null for non-Supabase URLs. */
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

export function FileUploader({
  onUploaded,
  onPendingDelete,
  label = "Upload file to fill URL",
  mimeTypes,
  existingFileUrl,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getSignedUploadUrl);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const path = `uploads/${Date.now()}-${safeName(file.name)}`;

      // Resolve the old path before uploading — we'll hand it to the caller
      // to delete *after* a successful save, not before.
      const oldPath = existingFileUrl ? extractStoragePath(existingFileUrl) : null;

      const { token, publicUrl } = await getUrl({ data: { path } });

      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (error) throw new Error(error.message);

      // Upload succeeded — report back
      onUploaded(publicUrl, file.name);

      // Tell the caller which old file to clean up after saving
      if (oldPath && onPendingDelete) {
        onPendingDelete(oldPath);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
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
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={actionButtonClassName("secondary")}
      >
        {uploading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading…" : label}
      </button>
    </>
  );
}
