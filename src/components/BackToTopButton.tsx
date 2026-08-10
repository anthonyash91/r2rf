import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating button, bottom-right, that appears once the page has been
 * scrolled past `threshold` and smooth-scrolls back to top on click.
 */
export function BackToTopButton({ threshold = 400 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      title="Back to top"
      className="fixed bottom-6 right-6 z-[300] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-muted"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
