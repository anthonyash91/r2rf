CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_user_profiles_facility
  ON public.user_profiles (facility) WHERE is_synthetic = false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_username_trgm
  ON public.user_profiles USING gin (lower(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_profiles_first_name_trgm
  ON public.user_profiles USING gin (lower(first_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_name_trgm
  ON public.user_profiles USING gin (lower(last_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_user
  ON public.user_roles (role, user_id);