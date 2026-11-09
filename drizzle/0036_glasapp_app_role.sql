-- HAND-WRITTEN (sweep D15). The app's own database login, `glasapp_app`: it reads and writes rows
-- in `politics` and can do nothing else. No DDL, no TRUNCATE, no REFERENCES or TRIGGER, nothing in
-- any other schema (GlasCore is shared with GlasIntelligence, whose tables are in `public`), and no
-- read of drizzle.__drizzle_migrations. Migrations keep running as the owner (docs/deploy.md).
--
-- The role is cluster-wide and has a password, so a human creates it on GlasCore by hand BEFORE
-- this runs (docs/deploy.md, section 3). CI's and developers' Postgres have no such role, so, like
-- 0026, everything here runs only if it exists.
--
-- Every politics table has RLS with no policy (0026), which denies every role but the owner. So
-- each table also gets the policy `glasapp_app_all`, which lets the role see and write every row.
-- Grants for tables made later come from the default privileges below; their POLICY does not, so
-- a migration that creates a table adds one itself (docs/deploy.md, "A new table"). The test
-- server/dbRole.integration.test.ts fails on any politics table without it.
--
-- Safe to run again by hand: grants are idempotent and an existing policy is left alone. If this
-- migration was applied before the role existed, it did nothing; create the role, then run this
-- file's DO block once in the SQL editor.
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'glasapp_app') THEN
    RAISE NOTICE 'role glasapp_app does not exist: no grants or policies made';
    RETURN;
  END IF;
  GRANT USAGE ON SCHEMA politics TO glasapp_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA politics TO glasapp_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA politics TO glasapp_app;
  -- Default privileges belong to the role that creates the objects: the one running migrations.
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA politics GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO glasapp_app', current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA politics GRANT USAGE, SELECT ON SEQUENCES TO glasapp_app', current_user);
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'politics' AND c.relkind IN ('r', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'politics' AND p.tablename = c.relname AND p.policyname = 'glasapp_app_all')
  LOOP
    EXECUTE format('CREATE POLICY glasapp_app_all ON politics.%I FOR ALL TO glasapp_app USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
