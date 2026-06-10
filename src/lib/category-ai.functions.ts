import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import Anthropic from "@anthropic-ai/sdk";

async function assertAdminOrContributor(supabase: any, userId: string) {
  const [adminRes, contribRes] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "contributor" }),
  ]);
  if (adminRes.error && contribRes.error) {
    throw new Error("Forbidden: role check failed");
  }
  if (!adminRes.data && !contribRes.data) {
    throw new Error("Forbidden: admin or contributor access required");
  }
}

const anthropic = new Anthropic();

// Pulls the first text block from a Claude response; falls back to "{}"
// so JSON.parse always succeeds even when the model returns no text block.
function extractText(msg: Anthropic.Message): string {
  for (const block of msg.content) {
    if (block.type === "text") return block.text;
  }
  return "{}";
}

function checkApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
}

export const generateCategoryCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ name: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrContributor(context.supabase, context.userId);
    checkApiKey();

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 512,
      system: [
        {
          type: "text",
          // User-supplied data is kept in the user turn below, never inline here,
          // so injected instructions are treated as data rather than commands.
          text: 'You write concise, polished copy for a content library\'s categories. The user will provide a category name. Always respond with strict JSON: {"tagline": string, "description": string}. The tagline is a short punchy line (max ~10 words). The description is 1–2 sentences (max ~240 chars). No quotes, no markdown.',
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: "Generate a tagline and description for this category name:" },
        { role: "assistant", content: "Understood. Please provide the category name." },
        { role: "user", content: data.name.slice(0, 300) },
      ],
    }).catch((err) => {
      if (err instanceof Anthropic.RateLimitError) throw new Error("Rate limit reached. Try again in a moment.");
      throw new Error(`AI error: ${err instanceof Error ? err.message : String(err)}`);
    });

    let parsed: { tagline?: string; description?: string } = {};
    try { parsed = JSON.parse(extractText(msg)); } catch { parsed = {}; }
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
  .handler(async ({ data, context: ctx }) => {
    await assertAdminOrContributor(ctx.supabase, ctx.userId);
    checkApiKey();

    const context = [
      data.categoryName ? `Category: "${data.categoryName}".` : "",
      data.type ? `Content type: ${data.type}.` : "",
    ].filter(Boolean).join(" ");

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 512,
      system: [
        {
          type: "text",
          // User-supplied title and context are in the user turn, not the system prompt.
          text: 'You write concise, polished descriptions for items in a content library. The user will provide an item title and optional context. Always respond with strict JSON: {"description": string}. The description is 1–2 sentences (max ~240 chars) summarizing what the item is about. No quotes, no markdown.',
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Generate a description for this content item." },
            { type: "text", text: `Title: ${data.title.slice(0, 300)}` },
            ...(context ? [{ type: "text" as const, text: context.slice(0, 300) }] : []),
          ],
        },
      ],
    }).catch((err) => {
      if (err instanceof Anthropic.RateLimitError) throw new Error("Rate limit reached. Try again in a moment.");
      throw new Error(`AI error: ${err instanceof Error ? err.message : String(err)}`);
    });

    let parsed: { description?: string } = {};
    try { parsed = JSON.parse(extractText(msg)); } catch { parsed = {}; }
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
  .handler(async ({ data, context }) => {
    // facilityUsers can translate their own facility banner messages, so
    // translation needs to be accessible to them in addition to admin/contributor.
    const [adminRes, contribRes, facilityRes] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "contributor" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "facilityUser" }),
    ]);
    if (!adminRes.data && !contribRes.data && !facilityRes.data) {
      throw new Error("Forbidden: admin, contributor, or facility user access required");
    }
    checkApiKey();

    const entries = Object.entries(data.fields).filter(([, v]) => v && v.trim());
    if (entries.length === 0) return { fields: {} as Record<string, string> };

    const payload = Object.fromEntries(entries);

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          // User-supplied context and field values are in separate user turns so
          // injected instructions are treated as data, not commands.
          text: 'You are a professional translator. Translate English text values into natural, polished Latin American Spanish. Preserve tone, punctuation, capitalization style, and approximate length. Do not translate proper nouns, brand names, or URLs. Respond with strict JSON of the form {"fields": { <sameKey>: <spanishTranslation>, ... }} using the exact same keys you received. No markdown, no commentary.',
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Translate each value to Spanish. Keep the keys identical." },
            ...(data.context ? [{ type: "text" as const, text: `Context (for tone reference only): ${data.context.slice(0, 500)}` }] : []),
            { type: "text", text: JSON.stringify(payload) },
          ],
        },
      ],
    }).catch((err) => {
      if (err instanceof Anthropic.RateLimitError) throw new Error("Rate limit reached. Try again in a moment.");
      throw new Error(`AI error: ${err instanceof Error ? err.message : String(err)}`);
    });

    let parsed: any = {};
    try { parsed = JSON.parse(extractText(msg)); } catch { parsed = {}; }

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
      console.error("translateToSpanish: empty result", { content: extractText(msg) });
    }
    return { fields: out };
  });

