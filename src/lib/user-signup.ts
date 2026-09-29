export const FACILITY_OPTIONS = [
  { value: "pennington_sd", label: "Pennington, SD" },
  { value: "campbell_ky", label: "Campbell, KY" },
] as const;

export type FacilityValue = (typeof FACILITY_OPTIONS)[number]["value"];

export function facilityLabel(value: string | null | undefined): string {
  return FACILITY_OPTIONS.find((f) => f.value === value)?.label ?? value ?? "";
}

export const USER_EMAIL_DOMAIN = "users.local";

export function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}

/**
 * Resolves a "username or email" input to the address Supabase auth actually
 * uses: real emails pass through unchanged, bare usernames become their
 * synthetic @users.local address. Staff accounts (admin/contributor/
 * facilityUser) only ever authenticate via their real email — their
 * auto-derived username isn't a valid Supabase identity — so this only
 * resolves correctly when the input is either a regular/inmate account's
 * username or anyone's real email, matching how sign-in already works.
 */
export function resolveLoginEmail(idOrEmail: string): string {
  const trimmed = idOrEmail.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : syntheticEmail(trimmed);
}
