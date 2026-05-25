import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

export type SiteMessageKind = "home" | "user";

type SiteMessage = {
  enabled: boolean;
  message: string;
  message_es?: string;
  updatedAt: string;
};

const KEY_FOR_KIND: Record<SiteMessageKind, string> = {
  home: "home_message",
  user: "user_message",
};

function storageKey(kind: SiteMessageKind) {
  return `site_message_dismissed:${kind}`;
}

export function SiteMessageBanner({ kind }: { kind: SiteMessageKind }) {
  const key = KEY_FOR_KIND[kind];
  const { lang } = useI18n();
  const { session } = useAuth();
  const { data } = useQuery({
    queryKey: ["site_settings", key],
    queryFn: async (): Promise<SiteMessage | null> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value, updated_at")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value ?? null) as Partial<SiteMessage> | null;
      if (!v) return null;
      return {
        enabled: Boolean(v.enabled),
        message: String(v.message ?? ""),
        message_es: v.message_es ? String(v.message_es) : "",
        updatedAt: String(data?.updated_at ?? ""),
      };
    },
  });

  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = storageKey(kind);
    const local = window.localStorage.getItem(k);
    const sess = window.sessionStorage.getItem(k);
    setDismissedAt(local ?? sess);
  }, [kind, data?.updatedAt]);

  if (!data || !data.message.trim()) return null;
  if (dismissedAt && data.updatedAt && dismissedAt === data.updatedAt) return null;

  const text =
    lang === "es" && data.message_es && data.message_es.trim()
      ? data.message_es
      : data.message;

  const onDismiss = () => {
    if (typeof window === "undefined") return;
    const k = storageKey(kind);
    const store = session ? window.localStorage : window.sessionStorage;
    store.setItem(k, data.updatedAt);
    setDismissedAt(data.updatedAt);
  };

  return (
    <div
      role="status"
      className="w-full border-t border-b border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-foreground"
    >
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-start gap-3 text-sm text-left">
        <Megaphone className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
        <p className="whitespace-pre-wrap leading-relaxed flex-1">{text}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--color-accent)]/15 hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
