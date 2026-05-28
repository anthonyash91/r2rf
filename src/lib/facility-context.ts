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

export function setActiveFacilitySlug(slug: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (slug) window.sessionStorage.setItem(STORAGE_KEY, slug);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT_NAME, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useActiveFacilitySlug(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
