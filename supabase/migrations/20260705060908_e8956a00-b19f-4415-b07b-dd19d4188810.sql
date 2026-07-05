
-- Make identifier lookup tolerant of phone formatting (with/without country code, spaces, dashes)
-- and case-insensitive for usernames. Also grant EXECUTE to anon so the sign-in
-- screen (unauthenticated) can resolve an identifier → email.

CREATE OR REPLACE FUNCTION public.lookup_email_by_identifier(_identifier text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH normalized AS (
    SELECT regexp_replace(coalesce(_identifier, ''), '\D', '', 'g') AS digits
  )
  SELECT u.email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id, normalized n
  WHERE lower(p.username) = lower(_identifier)
     OR (
       length(n.digits) >= 5
       AND (
         regexp_replace(coalesce(p.phone_number, ''), '\D', '', 'g') = n.digits
         OR regexp_replace(coalesce(p.country_code, '') || coalesce(p.phone_number, ''), '\D', '', 'g') = n.digits
       )
     )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lookup_user_id_by_identifier(_identifier text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH normalized AS (
    SELECT regexp_replace(coalesce(_identifier, ''), '\D', '', 'g') AS digits
  )
  SELECT p.id
  FROM public.profiles p, normalized n
  WHERE lower(p.username) = lower(_identifier)
     OR (
       length(n.digits) >= 5
       AND (
         regexp_replace(coalesce(p.phone_number, ''), '\D', '', 'g') = n.digits
         OR regexp_replace(coalesce(p.country_code, '') || coalesce(p.phone_number, ''), '\D', '', 'g') = n.digits
       )
     )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_email_by_identifier(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_user_id_by_identifier(text) TO anon, authenticated;
