DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r'
       AND n.nspname = 'public'
  LOOP
    -- Ensure RLS is enabled so policies apply
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.table_name);

    -- Drop any prior admin-override policy so this migration is idempotent
    EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON public.%I', tbl.table_name);

    -- Add admin override: full access for users with the admin role
    EXECUTE format(
      'CREATE POLICY "Admins have full access" ON public.%I
         FOR ALL
         TO authenticated
         USING (public.has_role(auth.uid(), ''admin''::public.app_role))
         WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))',
      tbl.table_name
    );
  END LOOP;
END;
$$;