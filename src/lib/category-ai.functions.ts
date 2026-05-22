import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const generateCategoryIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(200),
      tagline: z.string().max(500).optional().default(""),
      description: z.string().max(2000).optional().default(""),
      extraPrompt: z.string().max(1000).optional().default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `Design a single flat vector icon for a content library category, in the exact style described below.

Category name: "${data.name}"
${data.tagline ? `Tagline: "${data.tagline}"` : ""}
${data.description ? `Description: "${data.description}"` : ""}
${data.extraPrompt ? `Additional instructions from the user (follow these, but never break the strict visual rules below): "${data.extraPrompt}"` : ""}

STRICT visual rules — match this style exactly:
- PERFECTLY SQUARE 1:1 composition.
- Background MUST be filled edge-to-edge with the EXACT color #fff9e1 (warm cream). No other background color.
- Use ONLY these five hex colors in the entire image, no others: #aeb25d (light sage green), #986313 (warm brown), #587932 (deep olive green), #fff9e1 (cream — also used as interior negative space), #d5a43e (goldenrod / mustard yellow).
- Flat vector illustration: solid color fills with thick, confident outlines. NO gradients, NO shading, NO highlights, NO shadows, NO textures, NO 3D, NO photorealism, NO glow.
- Outlines are bold and clean, drawn in #986313 (warm brown) or #587932 (deep olive green). Stroke width roughly 6–10% of the icon height. Slightly rounded corners are acceptable where natural, but lines stay defined and crisp.
- Large flat color-blocked shapes filled with the sage, olive, brown, and goldenrod palette colors, with the cream (#fff9e1) showing through as interior negative space (e.g. the pages of an open book, the windows of a house, a face on a figure).
- One clear central subject — a single main shape, optionally with one small supporting element. Friendly, simple, easy to read at a glance. Not busy, not cluttered.
- Shapes and lines maintain clear visible separation; nothing collides chaotically.
- Generous padding around the subject (about 12–18% of the canvas on every side).
- No text, no letters, no numbers, no watermark, no border, no frame.

Output: just the finished square icon image. Nothing else.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error(`AI gateway error: ${res.status} ${text}`);
    }

    const json = await res.json();
    const dataUrl: string | undefined =
      json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl || !dataUrl.startsWith("data:")) {
      throw new Error("Model did not return an image");
    }

    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URL");
    const mime = match[1];
    const ext = mime.split("/")[1]?.split("+")[0] ?? "png";
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));

    const userId = context.userId ?? "anon";
    const path = `ai/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("category-icons")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: pub } = supabaseAdmin.storage.from("category-icons").getPublicUrl(path);
    return { url: pub.publicUrl };
  });



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

export const translateToSpanish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      fields: z.record(z.string().min(1).max(200), z.string().max(5000)),
      context: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const entries = Object.entries(data.fields).filter(([, v]) => v && v.trim());
    if (entries.length === 0) return { fields: {} as Record<string, string> };

    const payload = Object.fromEntries(entries);

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
              "You are a professional translator. Translate the given English text values into natural, polished Latin American Spanish. Preserve tone, punctuation, capitalization style, and approximate length. Do not translate proper nouns, brand names, or URLs. Respond with strict JSON of the form {\"fields\": { <sameKey>: <spanishTranslation>, ... }} using the exact same keys you received. No markdown, no commentary.",
          },
          {
            role: "user",
            content: `${data.context ? `Context: ${data.context}\n` : ""}Translate each value to Spanish. Keep the keys identical:\n${JSON.stringify(payload)}`,
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
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }
    // Accept either {fields: {...}} or a flat {...} object keyed by field names.
    const source: Record<string, unknown> =
      parsed && typeof parsed === "object" && parsed.fields && typeof parsed.fields === "object"
        ? parsed.fields
        : parsed && typeof parsed === "object"
          ? parsed
          : {};
    const out: Record<string, string> = {};
    for (const key of Object.keys(payload)) {
      const v = source[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim();
    }
    if (Object.keys(out).length === 0) {
      console.error("translateToSpanish: empty result", { content });
    }
    return { fields: out };
  });

