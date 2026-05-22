import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { LoadingButton } from "@/components/LoadingButton";
import { TranslatingIndicator } from "@/components/TranslateButton";

type HeadingLevel = "h2" | "h3" | "h4";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  /** Runs the translation. Called when "Add Spanish translation" or "Regenerate" is clicked. */
  onTranslate: () => void;
  title?: string;
  description?: string;
  headingLevel?: HeadingLevel;
  headingClassName?: string;
  addLabel?: string;
  /** Whether to render the top border + padding wrapper. Defaults to true. */
  borderTop?: boolean;
  /** Field inputs to render inside the panel when open. */
  children: ReactNode;
};

/**
 * Collapsible "Spanish translation" section shared across admin editors.
 * Encapsulates the show/hide toggle, header, Regenerate button, and
 * translating indicator. Caller supplies the field inputs as children.
 */
export function TranslationPanel({
  open,
  onOpenChange,
  busy,
  onTranslate,
  title = "Spanish translation",
  description = "Leave blank to fall back to English when Spanish is selected.",
  headingLevel = "h3",
  headingClassName = "font-display text-lg font-semibold",
  addLabel = "+ Add Spanish translation",
  borderTop = true,
  children,
}: Props) {
  const H = headingLevel;
  const wrap = borderTop ? "border-t border-border pt-4" : "";

  if (!open) {
    return (
      <div className={wrap}>
        <LoadingButton
          variant="secondary"
          pending={busy}
          pendingText="Translating…"
          onClick={() => {
            onOpenChange(true);
            onTranslate();
          }}
        >
          {addLabel}
        </LoadingButton>
      </div>
    );
  }

  return (
    <div className={`${wrap} space-y-4`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <H className={headingClassName}>{title}</H>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <LoadingButton
            variant="secondary"
            pending={busy}
            pendingText="Translating…"
            icon={<RefreshCw className="h-3 w-3" />}
            className="gap-1.5"
            onClick={onTranslate}
          >
            Regenerate
          </LoadingButton>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Hide
          </button>
        </div>
      </div>
      {busy && <TranslatingIndicator />}
      {children}
    </div>
  );
}
