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
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `Design a single minimalist, friendly icon for a content library category.

Category name: "${data.name}"
${data.tagline ? `Tagline: "${data.tagline}"` : ""}
${data.description ? `Description: "${data.description}"` : ""}

STRICT visual rules:
- PERFECTLY SQUARE 1:1 composition (equal width and height).
- Background MUST be filled edge-to-edge with the exact color #fff9e1 (warm cream). No other background color is acceptable.
- STRICT color palette — use ONLY these five hex colors, no others: #aeb25d (sage), #986313 (brown), #587932 (olive green), #fff9e1 (cream background), #d5a43e (goldenrod). Do not introduce any color outside this list.
- One simple, centered subject that clearly evokes the category. Keep it MINIMALIST — not too busy. Prefer 1 main shape, optionally with 1 small supporting element. Avoid clutter, avoid many small details.
- Use THICK, BOLD, CLEAN outline strokes with FLAT/BUTT line caps and SHARP corners (NO rounded caps, NO rounded corners). Stroke width roughly 8–12% of the icon height — defined, crisp, confident lines.
- Lines and shapes must NEVER collide, overlap, or touch each other. Maintain clear visible spacing between every stroke and shape so the icon stays easy to read and interpret at a glance.
- Flat fills only — no gradients, no shading, no highlights, no shadows, no textures, no noise, no 3D.
- Generous padding around the icon (around 15–20% of the canvas on every side).
- No text, no letters, no numbers, no watermark, no border, no frame, no photorealism, no glow.

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

