-- Atomic signup-challenge rate limiter using a pg_advisory_xact_lock.
-- Replaces the racy JavaScript check-then-insert pattern in rate-limit.server.ts
-- for signup challenge generation. The advisory lock is keyed on a hash of the
-- IP address, so concurrent requests from the same IP serialise inside the
-- transaction instead of both reading a count below the limit.
--
-- Mirrors check_and_record_reset_attempt (used by the password-reset path).
CREATE OR REPLACE FUNCTION public.check_and_record_signup_challenge_attempt(
  p_ip       text,
  p_since    timestamptz,
  p_max      int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempt_count int;
BEGIN
  -- Serialise concurrent requests from the same IP within this transaction.
  PERFORM pg_advisory_xact_lock(hashtext('signup_challenge:' || p_ip));

  SELECT COUNT(*)
    INTO attempt_count
    FROM signup_attempts
   WHERE ip_address = p_ip
     AND username   = 'challenge'
     AND created_at >= p_since;

  IF attempt_count >= p_max THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO signup_attempts (ip_address, username)
  VALUES (p_ip, 'challenge');
END;
$$;

-- Only service_role may call this — anon/authenticated callers cannot bypass
-- the rate limit by invoking the function directly.
REVOKE EXECUTE ON FUNCTION public.check_and_record_signup_challenge_attempt(text, timestamptz, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_and_record_signup_challenge_attempt(text, timestamptz, int) TO service_role;
