import { useSyncExternalStore } from "react";

const KEY = "admin:lastSeenUsersAt";

function readInitial(): string {
  if (typeof window === "undefined") return new Date().toISOString();
  const v = window.localStorage.getItem(KEY);
  if (v) return v;
  const now = new Date().toISOString();
  window.localStorage.setItem(KEY, now);
  return now;
}

let current = readInitial();
const listeners = new Set<() => void>();

export function getLastSeenUsersAt(): string {
  return current;
}

export function setLastSeenUsersAt(iso: string) {
  current = iso;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, iso);
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useLastSeenUsersAt(): string {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
