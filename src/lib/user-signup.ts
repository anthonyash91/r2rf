export const FACILITY_OPTIONS = [
  { value: "pennington_sd", label: "Pennington, SD" },
  { value: "campbell_ky", label: "Campbell, KY" },
] as const;

export type FacilityValue = (typeof FACILITY_OPTIONS)[number]["value"];

export function facilityLabel(value: string | null | undefined): string {
  return FACILITY_OPTIONS.find((f) => f.value === value)?.label ?? (value ?? "");
}

export const USER_EMAIL_DOMAIN = "users.local";

export function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}
