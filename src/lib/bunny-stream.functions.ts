import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminOrContributor } from "@/lib/server-auth";
import {
  createStreamCollection,
  createStreamVideo,
  computeTusSignature,
  streamPlaybackUrl,
  getStreamVideoStatus,
} from "@/lib/bunny-stream.server";

/**
 * Creates a Stream video entry (and, lazily, a collection to group it under)
 * and returns everything the client needs to drive the TUS upload directly
 * to Bunny — unlike the Storage flow, this is a plain JSON request/response,
 * not a streaming body, since the upload bytes never pass through our server.
 */
export const createStreamUploadSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(300),
        collectionId: z.string().nullable().optional(),
        collectionName: z.string().min(1).max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.userId);

    const collectionId =
      data.collectionId ??
      (data.collectionName ? await createStreamCollection(data.collectionName) : null);
    const videoId = await createStreamVideo(data.title, collectionId);
    const { signature, expiration, libraryId } = computeTusSignature(videoId);

    return {
      videoId,
      collectionId,
      libraryId,
      signature,
      expiration,
      uploadEndpoint: "https://video.bunnycdn.com/tusupload",
      // Deterministic even before processing finishes — the video isn't
      // actually playable until getStreamUploadStatus reports isFinished.
      playbackUrl: streamPlaybackUrl(videoId),
    };
  });

/**
 * Resolves/creates just the collection, with no throwaway video — used by
 * the bulk multi-item uploader to serialize a category's first-ever
 * collection creation before its per-file uploads run in parallel, so N
 * media files in one batch don't each create their own collection.
 */
export const ensureStreamCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().min(1).max(300) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.userId);
    const collectionId = await createStreamCollection(data.name);
    return { collectionId };
  });

export const getStreamUploadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ videoId: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminOrContributor(context.userId);
    return await getStreamVideoStatus(data.videoId);
  });
