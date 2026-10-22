-- ---------------------------------------------------------------------------
-- 063_self_enroll_gate.sql
--
-- System Settings > "Allow online self-enrollment" was client-side only. The
-- Enroll button was disabled, but a trainee holding a session could still POST
-- a new row to /rest/v1/enrollments, because enrollments_write is a permissive
-- policy for every authenticated user.
--
-- Rule: when settings.data->>'allowSelfEnroll' is false, a caller whose profile
-- role is 'trainee' may not INSERT an enrollment. Everything else is untouched:
--   * admins and trainers still create enrollments when assigning programs
--   * existing applications stay readable and resubmittable (UPDATE is allowed,
--     so a rejected requirement can still be corrected while enrollment is shut)
--   * a missing settings row means "open", matching the client default
--
-- Same shape as 062: one SECURITY DEFINER predicate + a RESTRICTIVE policy, so
-- it ANDs with the existing permissive policy instead of replacing it.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.self_enroll_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (data->>'allowSelfEnroll')::boolean
       from public.settings
      where id = 'global'),
    true
  )
$$;

-- True when this caller must be refused. public."current_role"() returns the
-- profile role (quoted because CURRENT_ROLE is a reserved word in SQL).
create or replace function public.self_enroll_blocks_insert()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.self_enroll_open()
     and coalesce(public."current_role"(), '') = 'trainee'
$$;

grant execute on function public.self_enroll_open() to authenticated;
grant execute on function public.self_enroll_blocks_insert() to authenticated;

drop policy if exists self_enroll_closed on public.enrollments;
create policy self_enroll_closed on public.enrollments
  as restrictive
  for insert
  with check (not public.self_enroll_blocks_insert());
