import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone } from "lucide-react";

export type SiteMessageKind = "home" | "user";

type SiteMessage = {
  enabled: boolean;
  message: string;
};

const KEY_FOR_KIND: Record<SiteMessageKind, string> = {
  home: "home_message",
  user: "user_message",
};

export function SiteMessageBanner({ kind }: { kind: SiteMessageKind }) {
  const key = KEY_FOR_KIND[kind];
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
      return { enabled: Boolean(v.enabled), message: String(v.message ?? "") };
    },
  });

  if (!data || !data.enabled || !data.message.trim()) return null;

  return (
    <div
      role="status"
      className="w-full border-b border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-foreground"
    >
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-start gap-3 text-sm">
        <Megaphone className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent)]" />
        <p className="whitespace-pre-wrap leading-relaxed">{data.message}</p>
      </div>
    </div>
  );
}
