import { useSyncExternalStore } from "react";

let locked = false;
const listeners = new Set<() => void>();

export function setSecurityLock(value: boolean) {
  if (locked === value) return;
  locked = value;
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSecurityLock(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => locked,
    () => false,
  );
}
