// Browser-side error reporter. Sends errors to /api/public/log-error.
// Dedupes by message+stack signature to survive render loops without
// flooding the server. Use `reportError` from try/catch sites and
// `installGlobalErrorReporter()` once at app boot.

const recent = new Map<string, number>();
const DEDUPE_MS = 30_000;

function shouldSend(signature: string): boolean {
  const now = Date.now();
  // prune old
  for (const [k, t] of recent) {
    if (now - t > DEDUPE_MS) recent.delete(k);
  }
  if (recent.has(signature)) return false;
  recent.set(signature, now);
  return true;
}

async function send(payload: {
  message: string;
  stack?: string | null;
  route?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Don't include credentials/auth — the server route picks up auth header
    // from the same-origin fetch automatically if present via the attacher,
    // but for a plain fetch we just omit it; user attribution is best-effort.
    await fetch("/api/public/log-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // If we can't reach the server, nothing we can do — don't recurse.
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;
  const sig = `${message}\n${stack ?? ""}`.slice(0, 500);
  if (!shouldSend(sig)) return;
  void send({
    message: message || "Unknown error",
    stack,
    route: window.location.pathname + window.location.search,
    context,
  });
}

let installed = false;
export function installGlobalErrorReporter(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message ?? "window.onerror", {
      filename: (event as ErrorEvent).filename,
      lineno: (event as ErrorEvent).lineno,
      colno: (event as ErrorEvent).colno,
      kind: "window.error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError((event as PromiseRejectionEvent).reason ?? "unhandledrejection", {
      kind: "unhandledrejection",
    });
  });
}
