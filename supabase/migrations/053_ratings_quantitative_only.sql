-- ============================================================================
-- 053_ratings_quantitative_only.sql
-- ----------------------------------------------------------------------------
-- "Rate Trainer" is quantitative: stars only. Qualitative feedback lives in
-- trainer_feedback. This migration
--   1. removes the legacy comment text that older builds stored in
--      trainer_ratings.data, and
--   2. makes sure it cannot come back: a BEFORE INSERT/UPDATE trigger drops any
--      comment/feedback/review key and validates the star value.
--
-- The rating, date and program fields are untouched.
-- ============================================================================

-- 1. One-off cleanup of the legacy text.
update public.trainer_ratings
   set data = data - 'comment'
 where data ? 'comment';

-- 2. Guard so a tampered client cannot re-introduce written feedback.
create or replace function public.sanitize_trainer_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating text;
begin
  new.data := coalesce(new.data, '{}'::jsonb)
              - 'comment'
              - 'feedback'
              - 'feedbackText'
              - 'review'
              - 'remarks';

  v_rating := new.data->>'rating';
  if v_rating is not null and v_rating <> '' then
    if v_rating !~ '^[1-5]$' then
      raise exception 'A trainer rating must be a whole number from 1 to 5.'
        using errcode = '22023';
    end if;
    new.data := jsonb_set(new.data, '{rating}', to_jsonb(v_rating::int));
  end if;

  return new;
end;
$$;

drop trigger if exists trainer_ratings_sanitize on public.trainer_ratings;
create trigger trainer_ratings_sanitize
  before insert or update on public.trainer_ratings
  for each row execute function public.sanitize_trainer_rating();

revoke all on function public.sanitize_trainer_rating() from public, anon, authenticated;
