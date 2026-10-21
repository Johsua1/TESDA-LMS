-- ============================================================================
-- 052_trainer_ratings_visibility.sql
-- ----------------------------------------------------------------------------
-- Quantitative ratings (stars only) stay visible to the people who need them:
--   trainee  -> the ratings they submitted
--   trainer  -> the ratings about themselves (used for the average on the
--               trainer profile and the Super Admin trainer list)
--   admin    -> everything
--
-- The previous policy was USING (true), which exposed every rating (and the
-- legacy comments stored in data) to any signed-in user, and to anon.
-- ============================================================================

drop policy if exists trainer_ratings_select on public.trainer_ratings;

create policy trainer_ratings_select on public.trainer_ratings
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or trainer_id = public.current_profile_id()
    or public.is_super_admin()
  );

-- TRUNCATE ignores RLS, so the grant itself has to go.
revoke truncate, references, trigger on public.trainer_ratings from anon, authenticated;
revoke all on public.trainer_ratings from anon;
grant select, insert, update, delete on public.trainer_ratings to authenticated;
