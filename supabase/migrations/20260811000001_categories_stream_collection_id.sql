-- Bunny Stream collection shared by every video/audio upload within a
-- category (replaces the old per-item collection scheme). Nullable:
-- categories with no Stream uploads yet simply have none, created lazily
-- on first video/audio upload and cached here.
ALTER TABLE public.categories ADD COLUMN stream_collection_id TEXT;
