import { useSyncExternalStore } from "react";

const STORAGE_KEY = "active-inmate-pin";
const EVENT_NAME = "active-inmate-pin-change";

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveInmatePin(pin: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (pin) window.sessionStorage.setItem(STORAGE_KEY, pin);
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

export function useActiveInmatePin(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
