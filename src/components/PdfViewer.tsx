import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function PdfLoading() {
  const { t } = useI18n();
  const [stillLoading, setStillLoading] = useState(false);
  // After 5 seconds switch to a "still loading" message so users know
  // the PDF hasn't stalled silently on a slow connection.
  useEffect(() => {
    const id = setTimeout(() => setStillLoading(true), 5000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="p-8 text-sm text-muted-foreground">
      {stillLoading ? t("pdf.stillLoading") : t("pdf.loading")}
    </div>
  );
}

function PdfError() {
  const { t } = useI18n();
  return <div className="p-8 text-sm text-destructive">{t("pdf.failed")}</div>;
}

export default function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      // Debounce via rAF: cancels the previous frame on rapid resize events so
      // react-pdf only re-renders the page once the container size has settled.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextWidth = Math.floor(el.getBoundingClientRect().width);
        // Bail if the width hasn't changed to avoid spurious re-renders.
        setWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
      });
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Also listen on window + visualViewport for soft-keyboard resize events on mobile.
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  // Reset to page 1 whenever the PDF URL changes so navigation state doesn't
  // carry over when the user switches to a different document.
  useEffect(() => {
    setPageNumber(1);
  }, [url]);

  // Subtract 16px padding from the container width; guard against 0 until the
  // ResizeObserver fires so react-pdf doesn't render at zero width.
  const pageWidth = width > 0 ? Math.max(width - 16, 1) : 0;

  return (
    <div className="flex h-[min(85dvh,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden bg-background">
      <div ref={containerRef} className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden p-2">
        <Document
          file={url}
          key={url}
          className="mx-auto w-fit max-w-none"
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<PdfLoading />}
          error={<PdfError />}
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
        <div className="shrink-0 border-t border-border bg-card p-2">
          <div className="flex items-center justify-center gap-3">
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
