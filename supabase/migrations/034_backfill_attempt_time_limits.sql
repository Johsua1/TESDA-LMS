-- ============================================================================
-- 034_backfill_attempt_time_limits.sql
-- Attempt clocks are fixed in the app (quiz 30 min, exam 60 min), so the old
-- per-quiz/exam `timeLimit` values are no longer read. Normalise the stored
-- jsonb so reports and exports do not show a duration the trainee never gets.
-- Safe to re-run.
-- ============================================================================

update public.programs p
set data = jsonb_set(
  p.data,
  '{quizzes}',
  (
    select jsonb_agg(jsonb_set(elem, '{timeLimit}', to_jsonb(30), true))
    from jsonb_array_elements(p.data->'quizzes') elem
  ),
  false
)
where jsonb_typeof(p.data->'quizzes') = 'array';

update public.programs p
set data = jsonb_set(
  p.data,
  '{exams}',
  (
    select jsonb_agg(jsonb_set(elem, '{timeLimit}', to_jsonb(60), true))
    from jsonb_array_elements(p.data->'exams') elem
  ),
  false
)
where jsonb_typeof(p.data->'exams') = 'array';
