import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAuthAllowedIps, getClientIp } from "./ip-allowlist";

export const isAuthIpAllowed = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const ip = getClientIp(request);
  if (!ip) return { allowed: false };
  const allowed = await getAuthAllowedIps();
  return { allowed: allowed.has(ip) };
});
