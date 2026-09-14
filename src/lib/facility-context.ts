import { useSyncExternalStore } from "react";

const STORAGE_KEY = "active-facility-slug";
const EVENT_NAME = "active-facility-change";

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Mirrors deriveValue() in facilities.functions.ts (server-only, so not
// importable from here) — the canonical `facilities.value` a site ID maps to
// is always lowercased/slugified there. Every call site that feeds this
// function a site ID gets it from a different raw source (a platform header,
// a `?site=` param, a route slug) and none of them reliably arrive already
// in that canonical casing, so normalizing once here — rather than trusting
// each caller — is what keeps facility_value consistent with what RLS,
// reports, and user_profiles.facility actually key off. The transform is
// idempotent, so re-normalizing an already-canonical value is a no-op.
function normalizeFacilitySlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function setActiveFacilitySlug(slug: string | null) {
  if (typeof window === "undefined") return;
  const normalized = slug ? normalizeFacilitySlug(slug) : null;
  try {
    if (normalized) window.sessionStorage.setItem(STORAGE_KEY, normalized);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  // Custom event: same-tab writes via setActiveFacilitySlug.
  // "storage" event: cross-tab synchronisation when another tab changes the value.
  window.addEventListener(EVENT_NAME, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT_NAME, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Non-hook read — safe to call outside React (e.g. useState lazy initializer). */
export function getActiveFacilitySlug(): string | null {
  return read();
}

export function useActiveFacilitySlug(): string | null {
  // Third arg is the SSR snapshot — returns null on the server where
  // sessionStorage is unavailable.
  return useSyncExternalStore(subscribe, read, () => null);
}
