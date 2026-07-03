CREATE OR REPLACE FUNCTION public.lookup_email_by_identifier(_identifier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.username = _identifier OR p.phone_number = _identifier
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_email_by_identifier(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_email_by_identifier(text) TO anon, authenticated;