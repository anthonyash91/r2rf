import { useSyncExternalStore } from "react";

// Same sessionStorage-backed pattern as facility-context.ts / inmate-pin-context.ts,
// for the platform-provided firstName/lastName headers — factored once since
// both fields behave identically (they just lock independently in the UI).
function makeStore(storageKey: string, eventName: string) {
  function read(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function set(value: string | null) {
    if (typeof window === "undefined") return;
    try {
      if (value) window.sessionStorage.setItem(storageKey, value);
      else window.sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(eventName));
  }

  function subscribe(cb: () => void) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(eventName, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(eventName, cb);
      window.removeEventListener("storage", cb);
    };
  }

  function useValue(): string | null {
    return useSyncExternalStore(subscribe, read, () => null);
  }

  return { get: read, set, useValue };
}

const firstNameStore = makeStore("active-first-name", "active-first-name-change");
const lastNameStore = makeStore("active-last-name", "active-last-name-change");

export const getActiveFirstName = firstNameStore.get;
export const setActiveFirstName = firstNameStore.set;
export const useActiveFirstName = firstNameStore.useValue;

export const getActiveLastName = lastNameStore.get;
export const setActiveLastName = lastNameStore.set;
export const useActiveLastName = lastNameStore.useValue;
