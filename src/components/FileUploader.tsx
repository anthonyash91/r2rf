import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UploadButton } from "@bytescale/upload-widget-react";
import { getBytescaleConfig } from "@/lib/bytescale.functions";
import { Upload } from "lucide-react";

type Props = {
  onUploaded: (fileUrl: string, fileName: string | null) => void;
  label?: string;
  mimeTypes?: string[];
};

export function FileUploader({ onUploaded, label = "Upload file to fill URL", mimeTypes }: Props) {
  const fetchConfig = useServerFn(getBytescaleConfig);
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
      }}
      onComplete={(files) => {
        const f = files[0];
        if (f) onUploaded(f.fileUrl, f.originalFile.originalFileName ?? null);
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
