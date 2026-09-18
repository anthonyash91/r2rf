import { useSyncExternalStore } from "react";

// Two distinct things are tracked, and conflating them is a real bug:
//   STORAGE_KEY     — the facility's canonical `value` (its primary key).
//                     Everything that attributes data keys off this:
//                     user_content_sessions.facility_value, facility reports,
//                     content restrictions.
//   SITE_ID_KEY     — the Site ID that appears in `?site=` URLs.
// They're identical only while a facility's value still matches the Site ID
// it was originally derived from. Regenerating a facility's Site ID breaks
// that (its `value` deliberately never changes, since every existing record
// points at it), after which storing one where the other belongs either
// orphans analytics or produces links that resolve to no facility.
const STORAGE_KEY = "active-facility-slug";
const SITE_ID_KEY = "active-facility-site-id";
const EVENT_NAME = "active-facility-change";

function readKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function read(): string | null {
  return readKey(STORAGE_KEY);
}

function readSiteId(): string | null {
  return readKey(SITE_ID_KEY);
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

/**
 * Stores the Site ID the visitor arrived on, for rebuilding `?site=` links as
 * they navigate. Stored verbatim — unlike the facility value this is matched
 * against `facilities.site_id_hmac`, which hashes the exact string, so
 * normalizing it here would stop it resolving.
 */
export function setActiveFacilitySiteId(siteId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (siteId) window.sessionStorage.setItem(SITE_ID_KEY, siteId);
    else window.sessionStorage.removeItem(SITE_ID_KEY);
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

/** Non-hook read of the Site ID the visitor arrived on. */
export function getActiveFacilitySiteId(): string | null {
  return readSiteId();
}

export function useActiveFacilitySiteId(): string | null {
  return useSyncExternalStore(subscribe, readSiteId, () => null);
}
