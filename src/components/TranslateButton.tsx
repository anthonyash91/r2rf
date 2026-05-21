import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { translateToSpanish } from "@/lib/category-ai.functions";

/**
 * Hook for triggering English -> Spanish translation imperatively.
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

/**
 * Loading indicator shown inside a Spanish translation section while
 * translation is in flight.
 */
export function TranslatingIndicator({ label }: { label?: string } = {}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-md border border-input bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <Languages className="h-4 w-4" />
      <span>{label ?? "Translating from English…"}</span>
    </div>
  );
}
