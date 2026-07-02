DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;