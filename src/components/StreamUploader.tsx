import { useEffect, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFileToStream, waitForStreamProcessing } from "@/lib/upload-stream-client";
import { extractStorageRef } from "@/lib/storage-url";
import { actionButtonClassName } from "@/components/LoadingButton";

type Props = {
  /** Unlike FileUploader, resolves once transcoding finishes — durationSeconds
   * comes from Bunny's own metadata rather than client-side probing. */
  onUploaded: (
    playbackUrl: string,
    fileName: string | null,
    durationSeconds: number | null,
  ) => void;
  onPendingDelete?: (oldStorageUrl: string) => void;
  label?: string;
  mimeTypes?: string[];
  existingFileUrl?: string | null;
  className?: string;
  /** Title for this individual Stream video (e.g. "Lesson — Chapter 3"). */
  itemTitle: string;
  /** Name for the collection itself — the overall content item's title.
   * Deliberately separate from itemTitle so the collection doesn't end up
   * named after whichever chapter happens to upload first. */
  collectionName: string;
  /** Pass the item's already-created collection id to reuse it; null creates one on first upload. */
  collectionId: string | null;
  onCollectionCreated?: (collectionId: string) => void;
  /** Lets a parent-driven upload (the batch chapter uploader) show its
   * progress through this exact button instead of a separate indicator —
   * same busy UI as a manual single-file upload, and disables the button so
   * it can't be clicked while the parent is already writing to this slot. */
  externalUpload?: { phase: "uploading" | "processing"; progress: number } | null;
  children?: React.ReactNode;
};

type Phase = "idle" | "uploading" | "processing";

export function StreamUploader({
  onUploaded,
  onPendingDelete,
  label = "Upload File",
  mimeTypes,
  existingFileUrl,
  className,
  itemTitle,
  collectionName,
  collectionId,
  onCollectionCreated,
  externalUpload,
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

  async function handleFile(file: File) {
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
          // Populate the URL as soon as it's known — it isn't playable yet
          // (transcoding hasn't finished), but there's no reason to make the
          // admin wait to see/copy it. Duration isn't known yet, so pass null.
          onUploaded(url, file.name, null);
        },
      });

      setPhase("processing");
      // No progress tracking here — the indeterminate UI doesn't read it (see
      // the render below for why: Bunny's encodeProgress jumps too unevenly
      // to drive a literal fill bar).
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

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (phase === "idle" && !externalUpload) setIsDragging(true);
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
    if (phase !== "idle" || externalUpload) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const effectivePhase: Phase = externalUpload ? externalUpload.phase : phase;
  const effectiveProgress = externalUpload ? externalUpload.progress : progress;
  const busy = effectivePhase !== "idle";
  const busyLabel = effectivePhase === "uploading" ? "Uploading" : "Processing";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={!!externalUpload}
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
        {busy ? (
          <button
            type="button"
            disabled
            className={`${actionButtonClassName("secondary")} relative overflow-hidden w-40 flex-shrink-0`}
          >
            {effectivePhase === "uploading" ? (
              <>
                {/* Determinate fill — TUS byte progress is smooth and reliable. */}
                <span
                  className="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-150 bg-foreground"
                  style={{ width: `${effectiveProgress}%` }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2 w-full whitespace-nowrap text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  {busyLabel}
                </span>
                <span
                  className="absolute inset-0 z-20 flex items-center justify-center gap-2 pointer-events-none whitespace-nowrap text-background transition-[clip-path] duration-150"
                  style={{ clipPath: `inset(0 ${100 - effectiveProgress}% 0 0)` }}
                >
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  {busyLabel}
                </span>
              </>
            ) : (
              <>
                {/* Indeterminate — Bunny's encodeProgress jumps in large uneven
                    steps (confirmed: 5% → flat ~9s → 40% → flat ~6s → 100%), so a
                    literal width-fill looks stuck between jumps. A sliding
                    segment communicates "still working" honestly instead. */}
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
