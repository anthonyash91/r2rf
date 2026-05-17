import { createServerFn } from "@tanstack/react-start";

export const getBytescaleConfig = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env.BYTESCALE_PUBLIC_API_KEY;
  if (!apiKey) throw new Error("BYTESCALE_PUBLIC_API_KEY is not configured");
  return { apiKey };
});
