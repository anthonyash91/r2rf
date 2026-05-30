import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUploadUrl, deleteStorageFile } from "@/lib/storage.functions";
import { actionButtonClassName } from "@/components/LoadingButton";

const BUCKET = "content-files";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Props = {
  onUploaded: (fileUrl: string, fileName: string | null) => void;
  label?: string;
  mimeTypes?: string[];
  /** Existing Supabase storage URL — if provided, that file is deleted before the new upload. */
  existingFileUrl?: string | null;
};

/** Extracts the storage path from a Supabase public file URL, or null if it's a non-Supabase URL. */
function extractStoragePath(url: string): string | null {
  try {
    const u = new URL(url);
    // Only handle URLs from our own Supabase project
    if (!SUPABASE_URL || !u.href.startsWith(SUPABASE_URL)) return null;
    const match = u.pathname.match(new RegExp(`/object/public/${BUCKET}/(.+)$`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** Sanitises a filename: keeps alphanumerics, dots, hyphens, underscores; replaces anything else with _. */
function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._\-]/g, "_");
}

export function FileUploader({
  onUploaded,
  label = "Upload file to fill URL",
  mimeTypes,
  existingFileUrl,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getSignedUploadUrl);
  const deleteFile = useServerFn(deleteStorageFile);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      // Unique path: timestamp prefix prevents collisions and acts as a cache-buster
      const path = `uploads/${Date.now()}-${safeName(file.name)}`;

      // Delete the old file if it lives in our Supabase bucket
      if (existingFileUrl) {
        const oldPath = extractStoragePath(existingFileUrl);
        if (oldPath) {
          await deleteFile({ data: { path: oldPath } }).catch(() => {
            // Non-fatal — old file missing is fine
          });
        }
      }

      // Get a short-lived signed upload URL from the server
      const { token, publicUrl } = await getUrl({ data: { path } });

      // Upload the file directly from the browser — no server roundtrip for the bytes
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (error) throw new Error(error.message);

      onUploaded(publicUrl, file.name);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      // Reset input so selecting the same file again triggers onChange
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
