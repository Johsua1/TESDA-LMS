-- ============================================================================
-- 055_ratings_write_lock.sql
-- ----------------------------------------------------------------------------
-- A trainee could still INSERT into trainer_ratings directly (the RLS insert
-- policy only checked trainee_id = current_profile_id()), which bypassed
-- submit_trainer_feedback() and the "one submission" rule. Ratings are now
-- written only by that SECURITY DEFINER function:
--
--   authenticated -> SELECT only
--   anon          -> no access
--   definer RPC   -> INSERT / UPDATE (mirrors the stars of a submission)
-- ============================================================================

revoke insert, update, delete on public.trainer_ratings from authenticated;
revoke all on public.trainer_ratings from anon;
grant select on public.trainer_ratings to authenticated;

-- No write policies for clients: the only writer is the definer function.
drop policy if exists trainer_ratings_insert on public.trainer_ratings;
drop policy if exists trainer_ratings_update on public.trainer_ratings;
drop policy if exists trainer_ratings_delete on public.trainer_ratings;
