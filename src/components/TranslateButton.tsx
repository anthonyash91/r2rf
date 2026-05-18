import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { translateToSpanish } from "@/lib/category-ai.functions";

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
  const translate = useServerFn(translateToSpanish);
  const [busy, setBusy] = useState(false);

  const hasAny = Object.values(fields).some((v) => v && v.trim());

  async function handleClick() {
    if (!hasAny) {
      toast.error("Fill in at least one English field first");
      return;
    }
    setBusy(true);
    try {
      const result = await translate({ data: { fields, context } });
      const translations = result.fields ?? {};
      if (Object.keys(translations).length === 0) {
        toast.error("No translations returned");
        return;
      }
      onTranslated(translations);
      toast.success("Translated to Spanish");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to translate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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
