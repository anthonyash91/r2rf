-- Atomic question-probe rate limiter using pg_advisory_xact_lock.
-- Replaces the racy JavaScript check-then-insert pattern in password-reset.functions.ts
-- for the getResetQuestions endpoint. Mirrors check_and_record_reset_attempt.
CREATE OR REPLACE FUNCTION public.check_and_record_question_probe(
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
  PERFORM pg_advisory_xact_lock(hashtext('question_probe:' || p_ip));

  SELECT COUNT(*)
    INTO attempt_count
    FROM password_reset_attempts
   WHERE ip_address = p_ip
     AND created_at >= p_since;

  IF attempt_count >= p_max THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO password_reset_attempts (ip_address, username)
  VALUES (p_ip, 'probe');
END;
$$;

-- Only service_role may call this.
REVOKE EXECUTE ON FUNCTION public.check_and_record_question_probe(text, timestamptz, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_and_record_question_probe(text, timestamptz, int) TO service_role;
