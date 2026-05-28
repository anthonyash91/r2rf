import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { useBadgeStyles } from "@/hooks/use-badge-styles";
import { paletteStyle } from "@/lib/badge-styles";

export type SiteMessageKind = "home" | "facility";

type SiteMessage = {
  enabled: boolean;
  message: string;
  message_es?: string;
  updatedAt: string;
};

const KEY_FOR_KIND: Record<Exclude<SiteMessageKind, "facility">, string> = {
  home: "home_message",
};

function sessionStorageKey(kind: SiteMessageKind, facilityValue?: string) {
  return `site_message_dismissed:${kind}${facilityValue ? `:${facilityValue}` : ""}`;
}

function messageKindForDismissal(kind: SiteMessageKind, facilityValue?: string) {
  return kind === "facility" && facilityValue ? `facility_${facilityValue}` : kind;
}

export function SiteMessageBanner({
  kind,
  facilityValue: facilityValueProp,
}: {
  kind: SiteMessageKind;
  /** For kind="facility": the facility slug. Omit to auto-detect from the logged-in user's profile. */
  facilityValue?: string;
}) {
  const { lang } = useI18n();
  const { session, isAdmin, isContributor } = useAuth();
  const userId = session?.user?.id ?? null;
  const qc = useQueryClient();

  // For facility kind without a prop, auto-detect the user's facility
  const fetchFacility = useServerFn(getMyFacilityValue);
  const { data: facilityData } = useQuery({
    queryKey: ["my-facility", userId],
    enabled: kind === "facility" && !facilityValueProp && !!userId && !isAdmin && !isContributor,
    queryFn: () => fetchFacility(),
  });
  const facilityValue = kind === "facility"
    ? (facilityValueProp ?? facilityData?.facility ?? null)
    : null;

  // Derive the site_settings key
  const settingsKey = kind === "facility"
    ? (facilityValue ? `facility_message_${facilityValue}` : null)
    : KEY_FOR_KIND[kind as Exclude<SiteMessageKind, "facility">];

  const { data } = useQuery({
    queryKey: ["site_settings", settingsKey],
    enabled: !!settingsKey,
    queryFn: async (): Promise<SiteMessage | null> => {
      if (!settingsKey) return null;
      const { data, error } = await supabase
        .from("site_settings")
        .select("value, updated_at")
        .eq("key", settingsKey)
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

  const dismissalKind = messageKindForDismissal(kind, facilityValue ?? undefined);
  const dismissalQueryKey = ["site_message_dismissal", dismissalKind, userId] as const;
  const { data: dbDismissedAt } = useQuery({
    queryKey: dismissalQueryKey,
    enabled: !!userId && !!settingsKey,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("user_dismissed_messages")
        .select("dismissed_version")
        .eq("user_id", userId!)
        .eq("message_kind", dismissalKind)
        .maybeSingle();
      if (error) throw error;
      return data?.dismissed_version ? String(data.dismissed_version) : null;
    },
  });

  const [anonDismissedAt, setAnonDismissedAt] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || userId) return;
    setAnonDismissedAt(window.sessionStorage.getItem(sessionStorageKey(kind, facilityValue ?? undefined)));
  }, [kind, facilityValue, userId, data?.updatedAt]);

  if (!settingsKey || !data || !data.message.trim()) return null;

  const dismissedAt = userId ? dbDismissedAt ?? null : anonDismissedAt;
  if (
    dismissedAt &&
    data.updatedAt &&
    new Date(dismissedAt).getTime() === new Date(data.updatedAt).getTime()
  ) {
    return null;
  }

  const text =
    lang === "es" && data.message_es && data.message_es.trim()
      ? data.message_es
      : data.message;

  const onDismiss = async () => {
    if (userId) {
      qc.setQueryData(dismissalQueryKey, data.updatedAt);
      const { error } = await supabase
        .from("user_dismissed_messages")
        .upsert(
          { user_id: userId, message_kind: dismissalKind, dismissed_version: data.updatedAt },
          { onConflict: "user_id,message_kind" },
        );
      if (error) qc.invalidateQueries({ queryKey: dismissalQueryKey });
    } else if (typeof window !== "undefined") {
      window.sessionStorage.setItem(sessionStorageKey(kind, facilityValue ?? undefined), data.updatedAt);
      setAnonDismissedAt(data.updatedAt);
    }
  };

  // Facility messages use whatever color the facility badge is currently set to
  const badgeStyles = useBadgeStyles();
  const facilityPs = paletteStyle(badgeStyles.variants["facility"] ?? 11);
  const isFacilityBanner = kind === "facility";
  const bannerStyle = isFacilityBanner
    ? { borderColor: facilityPs.border, backgroundColor: facilityPs.bg }
    : undefined;
  const iconStyle = isFacilityBanner ? { color: facilityPs.color } : undefined;
  const iconClassName = isFacilityBanner
    ? "h-4 w-4 shrink-0"
    : "h-4 w-4 shrink-0 text-[var(--color-accent)]";
  const dismissClassName = isFacilityBanner
    ? "shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
    : "shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--color-accent)]/15 hover:text-foreground transition-colors";

  return (
    <div
      role="status"
      className="w-full border-t border-b text-foreground"
      style={bannerStyle ?? { borderColor: "color-mix(in oklab, var(--color-accent) 30%, transparent)", backgroundColor: "color-mix(in oklab, var(--color-accent) 10%, transparent)" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-start gap-3 text-sm text-left">
        <Megaphone className={iconClassName} style={iconStyle} />
        <p className="whitespace-pre-wrap leading-relaxed flex-1">{text}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className={dismissClassName}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
