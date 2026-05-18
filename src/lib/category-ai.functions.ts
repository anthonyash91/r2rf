import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateCategoryCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ name: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write concise, polished copy for a content library's categories. Always respond with strict JSON: {\"tagline\": string, \"description\": string}. The tagline is a short punchy line (max ~10 words). The description is 1–2 sentences (max ~240 chars). No quotes, no markdown.",
          },
          {
            role: "user",
            content: `Category name: "${data.name}". Generate a tagline and description.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error: ${res.status} ${text}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { tagline?: string; description?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }
    return {
      tagline: (parsed.tagline ?? "").toString().trim(),
      description: (parsed.description ?? "").toString().trim(),
    };
  });

export const generateContentDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      title: z.string().min(1).max(300),
      type: z.string().max(100).optional(),
      categoryName: z.string().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const context = [
      data.categoryName ? `Category: "${data.categoryName}".` : "",
      data.type ? `Content type: ${data.type}.` : "",
    ].filter(Boolean).join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write concise, polished descriptions for items in a content library. Always respond with strict JSON: {\"description\": string}. The description is 1–2 sentences (max ~240 chars) summarizing what the item is about. No quotes, no markdown.",
          },
          {
            role: "user",
            content: `Item title: "${data.title}". ${context} Generate a description.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error: ${res.status} ${text}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { description?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }
    return {
      description: (parsed.description ?? "").toString().trim(),
    };
  });

