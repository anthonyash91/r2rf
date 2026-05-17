import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UploadButton } from "@bytescale/upload-widget-react";
import { getBytescaleConfig } from "@/lib/bytescale.functions";
import { Upload, X, FileText } from "lucide-react";

type Props = {
  fileUrl: string | null;
  fileName: string | null;
  onChange: (fileUrl: string | null, fileName: string | null) => void;
};

export function FileUploader({ fileUrl, fileName, onChange }: Props) {
  const fetchConfig = useServerFn(getBytescaleConfig);
  const { data, isLoading, error } = useQuery({
    queryKey: ["bytescale-config"],
    queryFn: () => fetchConfig(),
    staleTime: Infinity,
  });

  if (fileUrl) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 truncate text-[var(--color-accent)] hover:underline"
        >
          {fileName || fileUrl}
        </a>
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          title="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

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
      }}
      onComplete={(files) => {
        const f = files[0];
        if (f) onChange(f.fileUrl, f.originalFile.originalFileName ?? null);
      }}
    >
      {({ onClick }) => (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          <Upload className="h-4 w-4" /> Upload file
        </button>
      )}
    </UploadButton>
  );
}
