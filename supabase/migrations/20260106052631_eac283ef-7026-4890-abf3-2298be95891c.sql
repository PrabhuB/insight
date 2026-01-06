-- Ensure pgcrypto is available for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Track passcode verification attempts per user
CREATE TABLE IF NOT EXISTS public.user_passcode_attempts (
  user_id uuid PRIMARY KEY,
  failed_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_passcode_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own passcode attempts"
ON public.user_passcode_attempts
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Securely set/update the current user's passcode using bcrypt via pgcrypto
CREATE OR REPLACE FUNCTION public.set_passcode(p_passcode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_hash text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(p_passcode) < 6 OR length(p_passcode) > 12 THEN
    RAISE EXCEPTION 'Invalid passcode length';
  END IF;

  v_hash := crypt(p_passcode, gen_salt('bf'));

  INSERT INTO public.user_passcodes (user_id, passcode_hash)
  VALUES (v_user_id, v_hash)
  ON CONFLICT (user_id) DO UPDATE
    SET passcode_hash = EXCLUDED.passcode_hash,
        updated_at = now();

  -- Reset attempt counters on successful set
  DELETE FROM public.user_passcode_attempts WHERE user_id = v_user_id;
END;
$$;

-- Verify current user's passcode with basic rate limiting
CREATE OR REPLACE FUNCTION public.verify_passcode(p_passcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_record public.user_passcodes%ROWTYPE;
  v_attempts public.user_passcode_attempts%ROWTYPE;
  v_now timestamptz := now();
  v_delay_seconds integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Simple exponential backoff after multiple failures
  SELECT * INTO v_attempts
  FROM public.user_passcode_attempts
  WHERE user_id = v_user_id;

  IF FOUND THEN
    v_delay_seconds := LEAST(30, 2 ^ GREATEST(0, v_attempts.failed_attempts - 3));
    IF v_attempts.last_attempt_at > v_now - make_interval(secs => v_delay_seconds) THEN
      RAISE EXCEPTION 'Too many attempts, please wait before trying again';
    END IF;
  END IF;

  SELECT * INTO v_record
  FROM public.user_passcodes
  WHERE user_id = v_user_id;

  IF NOT FOUND OR v_record.passcode_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  IF crypt(p_passcode, v_record.passcode_hash) = v_record.passcode_hash THEN
    DELETE FROM public.user_passcode_attempts WHERE user_id = v_user_id;
    RETURN TRUE;
  ELSE
    INSERT INTO public.user_passcode_attempts (user_id, failed_attempts, last_attempt_at)
    VALUES (v_user_id, 1, v_now)
    ON CONFLICT (user_id) DO UPDATE
      SET failed_attempts = public.user_passcode_attempts.failed_attempts + 1,
          last_attempt_at = v_now;
    RETURN FALSE;
  END IF;
END;
$$;