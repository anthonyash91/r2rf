import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Our device-management platform stamps every request from an app-platform
// device (page loads and API calls alike) with these headers — never visible
// to the person using the device. Falling back to the ?site=/?user= URL
// params (see facility-context.ts / inmate-pin-context.ts) keeps the site
// working when opened outside the platform (e.g. staff testing in a browser).
export const getPlatformIdentity = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  return {
    facilityId: request?.headers.get("x-facility-id") || null,
    residentId: request?.headers.get("x-resident-id") || null,
  };
});
