// Maps a content "type" to a sensible action word that follows the
// estimated duration (e.g. "5 min read", "20 min listen").

export function actionWordForType(type: string | null | undefined): string {
  const t = (type ?? "").trim().toLowerCase();
  if (!t) return "";
  if (t.includes("video")) return "watch";
  if (t.includes("podcast") || t.includes("audio")) return "listen";
  if (t.includes("article") || t.includes("guide") || t.includes("pdf") || t.includes("book") || t.includes("post"))
    return "read";
  if (t.includes("worksheet")) return "complete";
  if (t.includes("meeting") || t.includes("call")) return "meeting";
  return "";
}

// Detect any verb already baked into a duration string so we don't
// append a duplicate (e.g. "5 min read read").
const VERB_RE = /\b(read|watch|listen|complete|meeting|call|view)\b/i;

export function withActionWord(duration: string | null | undefined, type: string | null | undefined): string {
  const t = (type ?? "").trim().toLowerCase();
  if (t.includes("image")) return "View image";
  if (t.includes("article")) return "Read article";
  const d = (duration ?? "").trim();
  if (!d) return "";
  if (VERB_RE.test(d)) return d;
  const verb = actionWordForType(type);
  return verb ? `${d} ${verb}` : d;
}
