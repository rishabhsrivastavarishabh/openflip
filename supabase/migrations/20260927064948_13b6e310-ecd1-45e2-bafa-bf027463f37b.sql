REVOKE EXECUTE ON FUNCTION public.can_view_profile_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile_content(uuid) TO authenticated;