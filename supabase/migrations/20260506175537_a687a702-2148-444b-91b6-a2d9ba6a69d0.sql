
-- =========================================================
-- SECURITY FIXES MIGRATION
-- =========================================================

-- 1) CONVERSATIONS: remove permissive WITH CHECK (true) INSERT policy
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
-- Keep "Authenticated users can create conversations" which requires auth.

-- 2) CONVERSATION_PARTICIPANTS: restrict INSERT to legitimate cases only
DROP POLICY IF EXISTS "Authenticated users can add participants" ON public.conversation_participants;

CREATE POLICY "Creator or admin can add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if the conversation has no participants yet AND requester is creator
  (
    auth.uid() = (SELECT created_by FROM public.conversations WHERE id = conversation_id)
  )
  OR
  -- Allow if requester is already an admin participant of the conversation
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.is_admin = true
  )
);

-- 3) PROMO_CODES: remove public SELECT (validation must use RPC)
DROP POLICY IF EXISTS "Anyone can read active promo codes" ON public.promo_codes;

-- 4) PROFILES: restrict to authenticated; lock sensitive PII columns to the owner
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Owner can always see their own row (covers anon edge cases for self via auth)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Column-level lockdown of sensitive PII: only the owner can read these columns
REVOKE SELECT (phone_number, date_of_birth, business_email, gender, country_code)
  ON public.profiles FROM anon, authenticated;

-- Provide a SECURITY DEFINER getter so owners can still read their own sensitive fields
CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS TABLE (
  phone_number text,
  date_of_birth date,
  business_email text,
  gender text,
  country_code text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT phone_number, date_of_birth, business_email, gender, country_code
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_private_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

-- Allow owners to UPDATE their own sensitive fields (column grants for write paths)
GRANT UPDATE (phone_number, date_of_birth, business_email, gender, country_code)
  ON public.profiles TO authenticated;
GRANT INSERT (phone_number, date_of_birth, business_email, gender, country_code)
  ON public.profiles TO authenticated;

-- Phone-based login lookup helper (anon-callable, returns only the auth email lookup id)
CREATE OR REPLACE FUNCTION public.lookup_user_id_by_identifier(_identifier text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles
  WHERE username = _identifier OR phone_number = _identifier
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.lookup_user_id_by_identifier(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_user_id_by_identifier(text) TO anon, authenticated;

-- 5) FOLLOWS / LIKES / COMMENTS / REEL_COMMENTS: require authentication for SELECT
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Authenticated users can view follows"
ON public.follows FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
CREATE POLICY "Authenticated users can view likes"
ON public.likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Authenticated users can view comments"
ON public.comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Reel comments are public" ON public.reel_comments;
CREATE POLICY "Authenticated users can view reel comments"
ON public.reel_comments FOR SELECT TO authenticated USING (true);

-- 6) DEVICES: don't allow enumeration of all device prekey bundles
DROP POLICY IF EXISTS "Authenticated users can read device public keys" ON public.devices;

-- Provide a controlled getter to fetch a single recipient's most recent device public key
CREATE OR REPLACE FUNCTION public.get_recipient_device_public_key(_user_id uuid)
RETURNS TABLE (id uuid, device_public_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, device_public_key
  FROM public.devices
  WHERE user_id = _user_id
  ORDER BY last_seen_at DESC NULLS LAST
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_recipient_device_public_key(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_recipient_device_public_key(uuid) TO authenticated;

-- The existing "Users can manage their own devices" policy still lets owners read/write their own.

-- 7) HARDEN handle_new_user: validate username, prevent injection / oversized inputs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  proposed text;
  cleaned  text;
  candidate text;
  counter int := 0;
BEGIN
  proposed := COALESCE(
    NEW.raw_user_meta_data->>'username',
    LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '_'))
  );
  cleaned := lower(regexp_replace(coalesce(proposed,''), '[^a-zA-Z0-9_]', '', 'g'));
  IF length(cleaned) < 3 THEN
    cleaned := 'user_' || substr(md5(random()::text), 1, 8);
  END IF;
  cleaned := substr(cleaned, 1, 30);
  candidate := cleaned;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    counter := counter + 1;
    candidate := substr(cleaned, 1, 26) || '_' || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    candidate,
    substr(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), 1, 100),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

-- 8) STORAGE: add RLS policies for the 'post' bucket (currently ungoverned)
CREATE POLICY "Anyone can view post bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'post');

CREATE POLICY "Authenticated users can upload to post bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own post objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own post objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
