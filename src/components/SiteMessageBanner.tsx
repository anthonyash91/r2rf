import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type SiteMessageKind = "home" | "user";

type SiteMessage = {
  enabled: boolean;
  message: string;
  message_es?: string;
};

const KEY_FOR_KIND: Record<SiteMessageKind, string> = {
  home: "home_message",
  user: "user_message",
};

export function SiteMessageBanner({ kind }: { kind: SiteMessageKind }) {
  const key = KEY_FOR_KIND[kind];
  const { lang } = useI18n();
  const { data } = useQuery({
    queryKey: ["site_settings", key],
    queryFn: async (): Promise<SiteMessage | null> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value ?? null) as Partial<SiteMessage> | null;
      if (!v) return null;
      return {
        enabled: Boolean(v.enabled),
        message: String(v.message ?? ""),
        message_es: v.message_es ? String(v.message_es) : "",
      };
    },
  });

  if (!data || !data.message.trim()) return null;

  const text =
    lang === "es" && data.message_es && data.message_es.trim()
      ? data.message_es
      : data.message;

  return (
    <div
      role="status"
      className="w-full border-t border-b border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-foreground"
    >
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-center gap-3 text-sm text-center">
        <Megaphone className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
