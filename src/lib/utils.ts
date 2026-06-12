import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Capitalizes the first letter of a string; leaves the rest untouched. */
export function capFirst(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Splits a large ID array into slices so each stays under Supabase's URL
 * length limit for .in() filters. Default size matches the Supabase cap.
 */
export function chunkIds(ids: string[], size = 500): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Returns a display name from first/last, falling back to a username or other string. */
export function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback?: string | null,
): string {
  const parts = [firstName, lastName].filter(Boolean).map(capFirst);
  if (parts.length) return parts.join(" ");
  return fallback ? capFirst(fallback) : "—";
}
