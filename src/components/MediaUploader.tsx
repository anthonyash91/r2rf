import { useEffect, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, type UploadLanguage } from "@/lib/upload-client";
import { uploadFileToStream, waitForStreamProcessing } from "@/lib/upload-stream-client";
import { extractStorageRef } from "@/lib/storage-url";
import { actionButtonClassName } from "@/components/LoadingButton";
import { extOf, AUDIO_EXT, VIDEO_EXT } from "@/lib/media-kind";

type Props = {
  /** durationSeconds is only ever non-null for a file routed to Stream —
   * the Storage branch has no server-side media metadata to report. */
  onUploaded: (fileUrl: string, fileName: string | null, durationSeconds: number | null) => void;
  onPendingDelete?: (oldStorageUrl: string) => void;
  label?: string;
  existingFileUrl?: string | null;
  className?: string;
  /** Organizes Bunny Storage uploads as uploads/{categorySlug}/{itemFolder}/{language}/... */
  categorySlug: string;
  itemFolder: string;
  language: UploadLanguage;
  /** Title for this individual Stream video, used only if the file turns out to be audio/video. */
  itemTitle: string;
  /** Name for the shared Stream collection (the category slug) — see StreamUploader for why
   * this is kept separate from itemTitle. */
  collectionName: string;
  collectionId: string | null;
  onCollectionCreated?: (collectionId: string) => void;
  children?: React.ReactNode;
};

type Phase = "idle" | "uploading" | "processing";

/**
 * Merges FileUploader (Bunny Storage) and StreamUploader (Bunny Stream) into
 * one drop zone that decides which backend to use from the selected file's
 * own extension — not from the surrounding form's `type` field, which is
 * free text an admin might not have set yet when they attach a file.
 */
export function MediaUploader({
  onUploaded,
  onPendingDelete,
  label = "Upload File",
  existingFileUrl,
  className,
  categorySlug,
  itemFolder,
  language,
  itemTitle,
  collectionName,
  collectionId,
  onCollectionCreated,
  children,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  async function handleStorageUpload(file: File) {
    setPhase("uploading");
    setProgress(0);
    try {
      const oldRefExists = existingFileUrl ? extractStorageRef(existingFileUrl) : null;
      const { publicUrl } = await uploadFile({
        file,
        kind: "content-file",
        categorySlug,
        itemFolder,
        language,
        onProgress: setProgress,
      });
      onUploaded(publicUrl, file.name, null);
      if (oldRefExists && existingFileUrl && onPendingDelete) {
        onPendingDelete(existingFileUrl);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setPhase("idle");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleStreamUpload(file: File) {
    setPhase("uploading");
    setProgress(0);
    try {
      const oldRefExists = existingFileUrl ? extractStorageRef(existingFileUrl) : null;

      const { videoId, playbackUrl } = await uploadFileToStream({
        file,
        title: itemTitle,
        collectionId,
        collectionName,
        onCollectionCreated,
        onProgress: setProgress,
        onUrlAvailable: (_videoId, url) => {
          // Populate the URL as soon as it's known — not playable yet, but
          // no reason to make the admin wait to see/copy it.
          onUploaded(url, file.name, null);
        },
      });

      setPhase("processing");
      const durationSeconds = await waitForStreamProcessing(videoId);
      if (cancelled.current) return;

      onUploaded(playbackUrl, file.name, durationSeconds);

      if (oldRefExists && existingFileUrl && onPendingDelete) {
        onPendingDelete(existingFileUrl);
      }
    } catch (err: any) {
      if (!cancelled.current) toast.error(err.message ?? "Upload failed");
    } finally {
      if (!cancelled.current) {
        setPhase("idle");
        setProgress(0);
      }
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFile(file: File) {
    const ext = extOf("", file.name);
    return AUDIO_EXT.has(ext) || VIDEO_EXT.has(ext)
      ? handleStreamUpload(file)
      : handleStorageUpload(file);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (phase === "idle") setIsDragging(true);
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
    if (phase !== "idle") return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const busy = phase !== "idle";
  const busyLabel = phase === "uploading" ? "Uploading" : "Processing";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
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
        {busy ? (
          <button
            type="button"
            disabled
            className={`${actionButtonClassName("secondary")} relative overflow-hidden w-40 flex-shrink-0`}
          >
            {phase === "uploading" ? (
              <>
                <span
                  className="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-150 bg-foreground"
                  style={{ width: `${progress}%` }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2 w-full whitespace-nowrap text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  {busyLabel}
                </span>
                <span
                  className="absolute inset-0 z-20 flex items-center justify-center gap-2 pointer-events-none whitespace-nowrap text-background transition-[clip-path] duration-150"
                  style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                >
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  {busyLabel}
                </span>
              </>
            ) : (
              <>
                {/* Indeterminate — same reasoning as StreamUploader: Bunny's
                    encodeProgress jumps too unevenly for a literal fill bar. */}
                <span className="absolute inset-y-0 left-0 w-2/5 pointer-events-none bg-foreground/25 animate-indeterminate-slide" />
                <span className="relative z-10 flex items-center justify-center gap-2 w-full whitespace-nowrap text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  {busyLabel}
                </span>
              </>
            )}
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
