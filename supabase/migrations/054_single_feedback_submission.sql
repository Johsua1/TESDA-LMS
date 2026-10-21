-- ============================================================================
-- 054_single_feedback_submission.sql
-- ----------------------------------------------------------------------------
-- One form per completed program: stars + written feedback submitted together,
-- exactly once.
--
--   * submit_trainer_feedback() now requires the star rating (1-5) as well as
--     the written feedback.
--   * The rating is mirrored into trainer_ratings so the trainer's average keeps
--     working from a single source, but a client can never change a rating
--     afterwards: only this RPC (app.rating_rpc) or a Super Admin may write it.
--   * The separate /trainee/ratings page is gone, so there is no second path.
-- ============================================================================

create or replace function public.submit_trainer_feedback(
  p_enrollment_id         text,
  p_feedback_text         text,
  p_learning_experience   text default null,
  p_trainer_strengths     text default null,
  p_areas_for_improvement text default null,
  p_recommendation        text default null,
  p_rating                smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      text := public.current_profile_id();
  v_e       record;
  v_elig    jsonb;
  v_trainer text;
  v_id      text;
  v_day     text := to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD');
begin
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_feedback_text is null or length(btrim(p_feedback_text)) = 0 then
    raise exception 'Written feedback is required.' using errcode = '22023';
  end if;

  -- Serialize concurrent submissions for the same enrollment.
  select * into v_e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found.' using errcode = 'P0002';
  end if;

  if v_e.trainee_id is distinct from v_me then
    raise exception 'You can only submit feedback for your own enrollment.'
      using errcode = '42501';
  end if;

  v_elig := public.trainer_feedback_eligibility(p_enrollment_id);

  if exists (
    select 1 from public.trainer_feedback
    where enrollment_id = p_enrollment_id and is_submitted
  ) then
    raise exception 'Feedback has already been submitted for this enrollment.'
      using errcode = '23505';
  end if;

  if not coalesce((v_elig->>'eligible')::boolean, false) then
    raise exception 'This enrollment is not eligible for trainer feedback yet: %',
      coalesce(v_elig->'completion'->>'reasons', v_elig->>'reason', 'requirements not met')
      using errcode = '42501';
  end if;

  v_trainer := v_elig->>'trainer_id';
  if v_trainer is null then
    raise exception 'No trainer is assigned to this enrollment.' using errcode = '42501';
  end if;

  if p_rating is null then
    raise exception 'A star rating is required.' using errcode = '22023';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.' using errcode = '22023';
  end if;

  insert into public.trainer_feedback (
    trainee_id, trainer_id, program_id, enrollment_id,
    feedback_text, learning_experience, trainer_strengths,
    areas_for_improvement, recommendation, rating,
    is_submitted, submitted_at
  )
  values (
    v_me, v_trainer, v_e.program_id, p_enrollment_id,
    btrim(p_feedback_text), nullif(btrim(coalesce(p_learning_experience, '')), ''),
    nullif(btrim(coalesce(p_trainer_strengths, '')), ''),
    nullif(btrim(coalesce(p_areas_for_improvement, '')), ''),
    nullif(btrim(coalesce(p_recommendation, '')), ''),
    p_rating, true, now()
  )
  on conflict (enrollment_id) do update
    set feedback_text         = excluded.feedback_text,
        learning_experience   = excluded.learning_experience,
        trainer_strengths     = excluded.trainer_strengths,
        areas_for_improvement = excluded.areas_for_improvement,
        recommendation        = excluded.recommendation,
        rating                = excluded.rating,
        is_submitted          = true,
        submitted_at          = now(),
        updated_at            = now()
    where public.trainer_feedback.is_submitted = false
  returning id into v_id;

  if v_id is null then
    raise exception 'Feedback has already been submitted for this enrollment.'
      using errcode = '23505';
  end if;

  -- Mirror the stars into the ratings table. One row per (trainee, trainer): if
  -- the trainee already rated this trainer, the new submission replaces the old
  -- value, so the average always reflects the formal evaluation.
  perform set_config('app.rating_rpc', 'on', true);
  insert into public.trainer_ratings (id, trainee_id, trainer_id, program_id, data)
  values (
    'trr-' || replace(gen_random_uuid()::text, '-', ''),
    v_me,
    v_trainer,
    v_e.program_id,
    jsonb_build_object('rating', p_rating, 'date', v_day)
  )
  on conflict (trainee_id, trainer_id) do update
    set data = jsonb_build_object('rating', p_rating, 'date', v_day);
  perform set_config('app.rating_rpc', 'off', true);

  perform public.write_audit(
    'TRAINER_FEEDBACK_SUBMITTED',
    'trainer_feedback',
    v_id,
    jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'trainer_id', v_trainer,
      'program_id', v_e.program_id,
      'rating', p_rating
    )
  );

  return public.trainer_feedback_eligibility(p_enrollment_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- A rating is submitted once. Direct client updates are rejected; the RPC above
-- and a Super Admin are the only writers.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_trainer_rating_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.rating_rpc', true), '') = 'on' then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  raise exception 'A trainer rating can only be submitted once and cannot be changed.'
    using errcode = '42501';
end;
$$;

drop trigger if exists trainer_ratings_no_change on public.trainer_ratings;
create trigger trainer_ratings_no_change
  before update on public.trainer_ratings
  for each row execute function public.prevent_trainer_rating_change();

revoke all on function public.prevent_trainer_rating_change() from public, anon, authenticated;
