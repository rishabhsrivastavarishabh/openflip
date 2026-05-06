
GRANT SELECT (phone_number, date_of_birth, business_email, gender, country_code)
  ON public.profiles TO authenticated;
-- anon stays revoked (anonymous can't SELECT due to RLS anyway, but be explicit-safe)
