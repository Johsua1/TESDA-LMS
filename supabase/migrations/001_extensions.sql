-- ===========================================================================
-- 001_extensions.sql
-- ---------------------------------------------------------------------------
-- Required PostgreSQL extensions.
--   pgcrypto -> gen_random_uuid(), gen_random_bytes(), crypt()/gen_salt()
--   citext   -> case-insensitive email comparisons (optional, guarded)
-- Idempotent: safe to run repeatedly.
-- ===========================================================================

create extension if not exists pgcrypto;

-- citext is optional; only created when available (managed Postgres ships it).
do $$
begin
  create extension if not exists citext;
exception
  when insufficient_privilege then null;
  when undefined_file then null;
end $$;
