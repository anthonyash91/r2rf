import { useSyncExternalStore } from "react";

// Module-level singleton: the lock state is shared across all components
// without needing a React context or prop drilling.
let locked = false;
const listeners = new Set<() => void>();

export function setSecurityLock(value: boolean) {
  if (locked === value) return; // Bail early to avoid redundant re-renders
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
