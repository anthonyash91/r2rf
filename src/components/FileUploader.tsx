import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, type UploadLanguage } from "@/lib/upload-client";
import { extractStorageRef } from "@/lib/storage-url";
import { actionButtonClassName } from "@/components/LoadingButton";

type Props = {
  onUploaded: (fileUrl: string, fileName: string | null) => void;
  onPendingDelete?: (oldStorageUrl: string) => void;
  label?: string;
  mimeTypes?: string[];
  existingFileUrl?: string | null;
  className?: string;
  /** Organizes Bunny uploads as uploads/{categorySlug}/{itemFolder}/{language}/... */
  categorySlug: string;
  itemFolder: string;
  language: UploadLanguage;
  /** Optional content to render inside the drop zone before the upload button (e.g. a URL text input). */
  children?: React.ReactNode;
};

export function FileUploader({
  onUploaded,
  onPendingDelete,
  label = "Upload File",
  mimeTypes,
  existingFileUrl,
  className,
  categorySlug,
  itemFolder,
  language,
  children,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadProgress(0);
    try {
      // Only queue the old file for deletion if it's actually one of our
      // managed files (Supabase or Bunny) — an admin-entered external URL
      // must never be deleted.
      const oldRefExists = existingFileUrl ? extractStorageRef(existingFileUrl) : null;

      const { publicUrl } = await uploadFile({
        file,
        kind: "content-file",
        categorySlug,
        itemFolder,
        language,
        onProgress: setUploadProgress,
      });

      onUploaded(publicUrl, file.name);

      if (oldRefExists && existingFileUrl && onPendingDelete) {
        onPendingDelete(existingFileUrl);
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
