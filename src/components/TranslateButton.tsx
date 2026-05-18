import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { translateToSpanish } from "@/lib/category-ai.functions";

/**
 * Hook for triggering English -> Spanish translation imperatively.
 * Use this when you want to wire auto-translation into another action
 * (e.g. the "Add Spanish translation" button).
 */
export function useTranslateToSpanish() {
  const translate = useServerFn(translateToSpanish);
  const [busy, setBusy] = useState(false);

  async function run(
    fields: Record<string, string>,
    onTranslated: (translations: Record<string, string>) => void,
    context?: string,
    opts?: { silent?: boolean },
  ): Promise<boolean> {
    const hasAny = Object.values(fields).some((v) => v && v.trim());
    if (!hasAny) {
      if (!opts?.silent) toast.error("Fill in at least one English field first");
      return false;
    }
    setBusy(true);
    try {
      const result = await translate({ data: { fields, context } });
      const translations = result.fields ?? {};
      if (Object.keys(translations).length === 0) {
        if (!opts?.silent) toast.error("No translations returned");
        return false;
      }
      onTranslated(translations);
      if (!opts?.silent) toast.success("Translated to Spanish");
      return true;
    } catch (e: any) {
      if (!opts?.silent) toast.error(e?.message ?? "Failed to translate");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy };
}

type Props = {
  /** English values to translate, keyed by stable field name. Empty values are skipped. */
  fields: Record<string, string>;
  /** Called with the Spanish translations (same keys as provided). */
  onTranslated: (translations: Record<string, string>) => void;
  /** Optional short context to guide the translator (e.g. "Category card on a content library"). */
  context?: string;
  label?: string;
  className?: string;
};

export function TranslateButton({ fields, onTranslated, context, label, className }: Props) {
  const { run, busy } = useTranslateToSpanish();
  const hasAny = Object.values(fields).some((v) => v && v.trim());

  return (
    <button
      type="button"
      onClick={() => run(fields, onTranslated, context)}
      disabled={busy || !hasAny}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
      }
    >
      <Languages className="h-4 w-4" />
      {busy ? "Translating…" : label ?? "Translate from English"}
    </button>
  );
}
