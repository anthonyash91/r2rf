import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    update();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    setPageNumber(1);
  }, [url]);

  const pageWidth = width > 0 ? Math.max(width - 16, 1) : 0;

  return (
    <div className="flex h-[min(85dvh,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] min-h-0 w-full flex-col bg-background">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto p-2">
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<div className="p-8 text-sm text-muted-foreground">Loading PDF…</div>}
          error={<div className="p-8 text-sm text-destructive">Failed to load PDF.</div>}
        >
          {pageWidth > 0 && (
            <Page
              key={pageWidth}
              pageNumber={pageNumber}
              width={pageWidth}
              className="mx-auto max-w-none"
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          )}
        </Document>
      </div>

      {numPages > 1 && (
        <div className="shrink-0 overflow-x-auto border-t border-border bg-card p-2">
          <div className="flex min-w-max items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums min-w-[80px] text-center">
              {pageNumber} / {numPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
