import { createFileRoute } from "@tanstack/react-router";
import { assertAdminOrContributor } from "@/lib/server-auth";
import { handleUploadRequest, validateContentFilePath } from "@/lib/upload-handler.server";

// Streams a content file (video/audio/pdf/image) straight through to Bunny
// Storage. Used for the main item file, item-level Spanish audio, and audio
// chapter files (single + batch upload) — see src/lib/upload-client.ts.
export const Route = createFileRoute("/api/uploads/content-file")({
  server: {
    handlers: {
      PUT: async ({ request }) =>
        handleUploadRequest(request, {
          authorize: async (userId) => assertAdminOrContributor(userId),
          buildPath: (filename, query) =>
            validateContentFilePath(
              filename,
              query.get("categorySlug") ?? "",
              query.get("itemFolder") ?? "",
              query.get("language") ?? "",
            ),
        }),
    },
  },
});
