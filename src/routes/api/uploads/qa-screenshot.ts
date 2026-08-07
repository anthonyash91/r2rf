import { createFileRoute } from "@tanstack/react-router";
import { assertRunOwner } from "@/lib/test-runs.functions";
import { handleUploadRequest, validateQaScreenshotPath } from "@/lib/upload-handler.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireRunId(query: URLSearchParams): string {
  const runId = query.get("runId");
  if (!runId || !UUID_RE.test(runId)) throw new Error("Missing or invalid runId query parameter.");
  return runId;
}

function requireTestId(query: URLSearchParams): string {
  const testId = query.get("testId");
  if (!testId || testId.length > 20) throw new Error("Missing or invalid testId query parameter.");
  return testId;
}

// Streams a QA failure screenshot straight through to Bunny Storage, under
// qa-screenshots/{runId}/{testId}/. Only the run owner may upload — see
// src/components/TestingTab.tsx.
export const Route = createFileRoute("/api/uploads/qa-screenshot")({
  server: {
    handlers: {
      PUT: async ({ request }) =>
        handleUploadRequest(request, {
          authorize: async (userId, query) => {
            const runId = requireRunId(query);
            await assertRunOwner(runId, userId);
          },
          buildPath: (filename, query) =>
            validateQaScreenshotPath(filename, requireRunId(query), requireTestId(query)),
        }),
    },
  },
});
