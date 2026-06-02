-- Drop the ip_passkey_attempts table. This table was used to track failed
-- passkey attempts for the self-service IP bypass feature, which has been
-- removed. Facilities share a single outgoing IP address, meaning multiple
-- users at the same facility could unintentionally block the entire
-- facility's IP within minutes by entering an incorrect passkey.
-- Non-allowlisted IPs now simply see a restricted page with no form or bypass.
DROP TABLE IF EXISTS public.ip_passkey_attempts;
