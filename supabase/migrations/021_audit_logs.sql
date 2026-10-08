-- ===========================================================================
-- 021_audit_logs.sql
-- ---------------------------------------------------------------------------
-- Immutable-ish audit trail for all trainer-management actions.
--
--   who   -> user_id (auth.users.id) + actor_profile_id (public.profiles.id)
--   what  -> action (e.g. TRAINER_CREATED)
--   which -> target_type + target_id
--   when  -> created_at
--   extra -> metadata jsonb
--
-- NEVER store passwords, temporary credentials, tokens or MFA secrets here.
-- ===========================================================================

create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,                         -- auth.users.id of the actor
  actor_profile_id text,                        -- public.profiles.id of the actor
  action          text not null,
  target_type     text,
  target_id       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_action_idx     on public.audit_logs (action);
create index if not exists audit_logs_target_idx     on public.audit_logs (target_type, target_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx      on public.audit_logs (actor_profile_id);

alter table public.audit_logs enable row level security;

-- RLS: only Super Admin may read the log. No direct client writes at all;
-- rows are inserted exclusively by SECURITY DEFINER functions.
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- write_audit(...)  -- internal helper used by the RPCs / Edge Functions.
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(
  p_action          text,
  p_target_type     text,
  p_target_id       text,
  p_metadata        jsonb default '{}'::jsonb,
  p_actor_profile_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, actor_profile_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    coalesce(p_actor_profile_id, public.current_profile_id()),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end $$;

-- Only definer functions may call write_audit(); never expose it to clients.
revoke all on function public.write_audit(text, text, text, jsonb, text) from public, anon, authenticated;

grant select on public.audit_logs to authenticated;
