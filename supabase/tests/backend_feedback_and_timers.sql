-- ============================================================================
-- Backend acceptance tests: trainer feedback + timed assessments
-- ----------------------------------------------------------------------------
-- Runs entirely inside one transaction and ROLLS BACK at the end, so it is
-- safe against a live project. Results are returned as a JSON array.
--
-- Run with: node --experimental-strip-types scripts/test-backend.mjs
-- ============================================================================

begin;

create temp table zz_results (
  name   text primary key,
  passed boolean not null,
  detail jsonb not null default '{}'::jsonb
);
grant all on zz_results to authenticated;

create function pg_temp.rec(p_name text, p_passed boolean, p_detail jsonb default '{}'::jsonb)
returns void
language sql
as $$
  insert into zz_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, '{}'::jsonb))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into public.programs (id, code, title, data)
values (
  'zz-fb-prog', 'ZZ-FB', 'Feedback Test Program',
  jsonb_build_object(
    'title', 'Feedback Test Program',
    'competencies', jsonb_build_array(jsonb_build_object(
      'id', 'zz-fb-c1', 'type', 'Basic', 'title', 'Basic',
      'lessons', jsonb_build_array(jsonb_build_object(
        'id', 'zz-fb-l1', 'title', 'Feedback Lesson', 'published', true
      ))
    )),
    'quizzes', jsonb_build_array(jsonb_build_object(
      'id', 'zz-fb-quiz', 'title', 'Feedback Quiz', 'lessonId', 'zz-fb-l1',
      'published', true, 'passing', 75, 'timeLimit', 20,
      'questions', jsonb_build_array(jsonb_build_object(
        'id', 'zz-fb-q1', 'type', 'id', 'answer', 'a'
      ))
    )),
    'exams', jsonb_build_array(jsonb_build_object(
      'id', 'zz-fb-exam', 'title', 'Feedback Exam', 'published', true,
      'passing', 75, 'timeLimit', 60,
      'questions', jsonb_build_array(jsonb_build_object(
        'id', 'zz-fb-e1', 'type', 'id', 'answer', 'a'
      ))
    ))
  )
);

insert into public.enrollments (id, trainee_id, program_id, status, data)
values
  ('zz-fb-enr', 'tn-mv5614d2-ifto6', 'zz-fb-prog', 'Completed',
   jsonb_build_object('trainerId', 'tr-mv55zntx-fw75m', 'progress', jsonb_build_object('zz-fb-l1', true))),
  ('zz-fb-bad-enr', 'tn-mv5614d2-ifto6', 'zz-fb-prog', 'Completed',
   jsonb_build_object('trainerId', 'tr-mv4lep5i-uwvwj', 'progress', jsonb_build_object('zz-fb-l1', true))),
  ('zz-fb-inel-enr', 'tn-mv5614d2-ifto6', 'zz-fb-prog', 'Enrolled',
   jsonb_build_object('trainerId', 'tr-mv55zntx-fw75m', 'progress', '{}'::jsonb)),
  ('zz-fb-enr2', 'tn-mv5614d2-ifto6', 'zz-fb-prog', 'Completed',
   jsonb_build_object('trainerId', 'tr-mv55zntx-fw75m', 'progress', jsonb_build_object('zz-fb-l1', true))),
  ('zz-fb-other-enr', 'tn-mvg2fxex-0hhe8', 'zz-fb-prog', 'Completed',
   jsonb_build_object('trainerId', 'tr-mv4lep5i-uwvwj', 'progress', jsonb_build_object('zz-fb-l1', true)));

-- Only trainer 1 is assigned to the feedback program. The unrelated-trainer
-- test relies on trainer 2 NOT being assigned.
insert into public.trainer_programs (trainer_id, program_id, status)
values ('tr-mv55zntx-fw75m', 'zz-fb-prog', 'active');

-- Passing attempts for the completed enrollments. The RPC flag prevents the
-- legacy grading trigger from re-grading these fixtures.
select set_config('app.assessment_rpc', 'on', true);

insert into public.quiz_attempts
  (id, trainee_id, program_id, data, status, score, total_questions, answered_questions,
   correct_answers, incorrect_answers, unanswered_questions, percentage, started_at, submitted_at)
values
  ('zz-fb-qa', 'tn-mv5614d2-ifto6', 'zz-fb-prog',
   '{"quizId":"zz-fb-quiz","answers":[{"questionId":"zz-fb-q1","given":"a"}],"score":1,"total":1,"percentage":100}'::jsonb,
   'graded', 1, 1, 1, 1, 0, 0, 100, now(), now()),
  ('zz-fb-qa2', 'tn-mvg2fxex-0hhe8', 'zz-fb-prog',
   '{"quizId":"zz-fb-quiz","answers":[{"questionId":"zz-fb-q1","given":"a"}],"score":1,"total":1,"percentage":100}'::jsonb,
   'graded', 1, 1, 1, 1, 0, 0, 100, now(), now());

insert into public.exam_attempts
  (id, trainee_id, program_id, data, status, score, total_questions, answered_questions,
   correct_answers, incorrect_answers, unanswered_questions, percentage, started_at, submitted_at)
values
  ('zz-fb-ea', 'tn-mv5614d2-ifto6', 'zz-fb-prog',
   '{"examId":"zz-fb-exam","answers":[{"questionId":"zz-fb-e1","given":"a"}],"score":1,"total":1,"percentage":100}'::jsonb,
   'graded', 1, 1, 1, 1, 0, 0, 100, now(), now()),
  ('zz-fb-ea2', 'tn-mvg2fxex-0hhe8', 'zz-fb-prog',
   '{"examId":"zz-fb-exam","answers":[{"questionId":"zz-fb-e1","given":"a"}],"score":1,"total":1,"percentage":100}'::jsonb,
   'graded', 1, 1, 1, 1, 0, 0, 100, now(), now());

select set_config('app.assessment_rpc', 'off', true);

-- ---------------------------------------------------------------------------
-- Completion rule
-- ---------------------------------------------------------------------------
select pg_temp.rec(
  'completion: completed enrollment with all requirements is complete',
  coalesce((public.course_completion('zz-fb-enr')->>'complete')::boolean, false),
  public.course_completion('zz-fb-enr')
);
select pg_temp.rec(
  'completion: incomplete enrollment is not complete',
  not coalesce((public.course_completion('zz-fb-inel-enr')->>'complete')::boolean, true),
  public.course_completion('zz-fb-inel-enr')
);

-- ---------------------------------------------------------------------------
-- Feedback: eligible submission
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"868d76fd-6110-43d6-86fd-858c8aec0f89","aal":"aal1"}', true);

create temp table zz_fb_submit as
select public.submit_trainer_feedback(
  'zz-fb-enr',
  'The trainer was patient and explained every step clearly.',
  'I learned the practical steps and felt supported.',
  'Patient and clear',
  'More practice time on the practical tasks',
  'Keep the same pacing',
  5::smallint
) as r;
grant select on zz_fb_submit to authenticated;

select pg_temp.rec(
  'feedback: eligible trainee can submit',
  (select r->>'status' from zz_fb_submit) = 'submitted',
  (select r from zz_fb_submit)
);

create temp table zz_fbid as
select id, feedback_text, trainer_id
from public.trainer_feedback
where enrollment_id = 'zz-fb-enr';
grant select on zz_fbid to authenticated;

select pg_temp.rec(
  'feedback: trainer is derived from the enrollment (not client supplied)',
  (select trainer_id from zz_fbid) = 'tr-mv55zntx-fw75m',
  jsonb_build_object('trainer_id', (select trainer_id from zz_fbid))
);

select pg_temp.rec(
  'feedback: submitted_at is recorded',
  exists (
    select 1 from public.trainer_feedback
    where enrollment_id = 'zz-fb-enr' and submitted_at is not null and is_submitted
  ),
  '{}'::jsonb
);

-- Duplicate submission
do $$
begin
  begin
    perform public.submit_trainer_feedback('zz-fb-enr', 'Duplicate attempt');
    perform pg_temp.rec('feedback: duplicate submission rejected', false, '{"error":"no exception"}'::jsonb);
  exception when unique_violation then
    perform pg_temp.rec('feedback: duplicate submission rejected', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;
end $$;

-- Another trainee cannot submit for this enrollment
select set_config('request.jwt.claims',
  '{"sub":"93515538-b68f-42a1-9722-e974c7ed9d73","aal":"aal1"}', true);

do $$
begin
  begin
    perform public.submit_trainer_feedback('zz-fb-enr', 'Not my enrollment');
    perform pg_temp.rec('feedback: another trainee is blocked', false, '{"error":"no exception"}'::jsonb);
  exception when insufficient_privilege then
    perform pg_temp.rec('feedback: another trainee is blocked', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;
end $$;

-- Unrelated trainer (not assigned to the program)
select set_config('request.jwt.claims',
  '{"sub":"868d76fd-6110-43d6-86fd-858c8aec0f89","aal":"aal1"}', true);

do $$
begin
  begin
    perform public.submit_trainer_feedback('zz-fb-bad-enr', 'Unrelated trainer');
    perform pg_temp.rec('feedback: unrelated trainer is blocked', false, '{"error":"no exception"}'::jsonb);
  exception when insufficient_privilege then
    perform pg_temp.rec('feedback: unrelated trainer is blocked', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;
end $$;

-- Ineligible enrollment
do $$
begin
  begin
    perform public.submit_trainer_feedback('zz-fb-inel-enr', 'Not completed');
    perform pg_temp.rec('feedback: ineligible enrollment is blocked', false, '{"error":"no exception"}'::jsonb);
  exception when insufficient_privilege then
    perform pg_temp.rec('feedback: ineligible enrollment is blocked', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Admin retrieval / filters
-- ---------------------------------------------------------------------------
insert into public.trainer_feedback
  (id, trainee_id, trainer_id, program_id, enrollment_id, feedback_text, is_submitted, submitted_at)
values
  ('zz-fb-other', 'tn-mvg2fxex-0hhe8', 'tr-mv4lep5i-uwvwj', 'zz-fb-prog',
   'zz-fb-other-enr', 'Feedback about the other trainer.', true, now());

select set_config('request.jwt.claims',
  '{"sub":"ab22f03f-f234-4957-9322-2078e9950651","aal":"aal2"}', true);

create temp table zz_admin_all as
select public.admin_trainer_feedback_page('{}'::jsonb, 100, 0) as rows;
grant select on zz_admin_all to authenticated;

select pg_temp.rec(
  'feedback: admin can retrieve all feedback',
  jsonb_array_length((select rows from zz_admin_all)) >= 2,
  jsonb_build_object('rows', jsonb_array_length((select rows from zz_admin_all)))
);

select pg_temp.rec(
  'feedback: admin filter by trainer',
  jsonb_array_length(public.admin_trainer_feedback_page(
    jsonb_build_object('trainer_id', 'tr-mv55zntx-fw75m'), 100, 0)) = 1,
  public.admin_trainer_feedback_page(jsonb_build_object('trainer_id', 'tr-mv55zntx-fw75m'), 100, 0)
);

select pg_temp.rec(
  'feedback: admin filter by program',
  jsonb_array_length(public.admin_trainer_feedback_page(
    jsonb_build_object('program_id', 'zz-fb-prog'), 100, 0)) = 2,
  '{}'::jsonb
);

select pg_temp.rec(
  'feedback: admin filter by trainee',
  jsonb_array_length(public.admin_trainer_feedback_page(
    jsonb_build_object('trainee_id', 'tn-mv5614d2-ifto6'), 100, 0)) = 1,
  '{}'::jsonb
);

select pg_temp.rec(
  'feedback: admin filter by enrollment',
  jsonb_array_length(public.admin_trainer_feedback_page(
    jsonb_build_object('enrollment_id', 'zz-fb-enr'), 100, 0)) = 1,
  '{}'::jsonb
);

select pg_temp.rec(
  'feedback: admin filter by date range',
  jsonb_array_length(public.admin_trainer_feedback_page(
    jsonb_build_object(
      'date_from', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
      'date_to',   to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD')
    ), 100, 0)) = 2,
  '{}'::jsonb
);

select pg_temp.rec(
  'feedback: admin search matches qualitative text',
  jsonb_array_length(public.admin_trainer_feedback_page(
    jsonb_build_object('search', 'patient'), 100, 0)) = 1,
  '{}'::jsonb
);

select pg_temp.rec(
  'feedback: admin paging is stable and does not duplicate rows',
  (select (public.admin_trainer_feedback_page('{}'::jsonb, 1, 0)->0->>'id')
        <> (public.admin_trainer_feedback_page('{}'::jsonb, 1, 1)->0->>'id'))
  and jsonb_array_length(public.admin_trainer_feedback_page('{}'::jsonb, 1, 2)) = 0,
  jsonb_build_object(
    'page1', public.admin_trainer_feedback_page('{}'::jsonb, 1, 0),
    'page2', public.admin_trainer_feedback_page('{}'::jsonb, 1, 1),
    'page3', public.admin_trainer_feedback_page('{}'::jsonb, 1, 2)
  )
);

-- Admin without MFA is refused.
select set_config('request.jwt.claims',
  '{"sub":"ab22f03f-f234-4957-9322-2078e9950651","aal":"aal1"}', true);

do $$
begin
  begin
    perform public.admin_trainer_feedback_page('{}'::jsonb, 10, 0);
    perform pg_temp.rec('feedback: admin at AAL1 is refused', false, '{"error":"no exception"}'::jsonb);
  exception when insufficient_privilege then
    perform pg_temp.rec('feedback: admin at AAL1 is refused', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;

  begin
    perform public.log_trainer_feedback_export('{}'::jsonb, 0, 'csv');
    perform pg_temp.rec('feedback: export audit at AAL1 is refused', false, '{"error":"no exception"}'::jsonb);
  exception when insufficient_privilege then
    perform pg_temp.rec('feedback: export audit at AAL1 is refused', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Trainer access: no feedback reads at all (051), and no writes
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"ced33251-2a4e-42ed-9771-c83f584e3b80","aal":"aal1"}', true);
select set_config('role', 'authenticated', true);

select pg_temp.rec(
  'feedback: trainer cannot read feedback about themselves',
  (select count(*) from public.trainer_feedback where id = (select id from zz_fbid)) = 0,
  jsonb_build_object('visible_rows', (select count(*) from public.trainer_feedback))
);

select pg_temp.rec(
  'feedback: trainer cannot read another trainer feedback',
  (select count(*) from public.trainer_feedback where id = 'zz-fb-other') = 0,
  '{}'::jsonb
);

do $$
declare
  v_rows int := 0;
begin
  begin
    update public.trainer_feedback
       set feedback_text = 'Tampered by trainer'
     where id = (select id from zz_fbid);
    get diagnostics v_rows = row_count;
    perform pg_temp.rec('feedback: trainer cannot update feedback', v_rows = 0,
      jsonb_build_object('updated_rows', v_rows));
  exception when insufficient_privilege then
    perform pg_temp.rec('feedback: trainer cannot update feedback', true,
      jsonb_build_object('blocked_by', 'table privilege'));
  end;
end $$;

do $$
declare
  v_rows int := 0;
begin
  begin
    delete from public.trainer_feedback where id = (select id from zz_fbid);
    get diagnostics v_rows = row_count;
    perform pg_temp.rec('feedback: trainer cannot delete feedback', v_rows = 0,
      jsonb_build_object('deleted_rows', v_rows));
  exception when insufficient_privilege then
    perform pg_temp.rec('feedback: trainer cannot delete feedback', true,
      jsonb_build_object('blocked_by', 'table privilege'));
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Quantitative ratings (052): a trainer sees only the rows about themselves,
-- a trainee only their own, and nobody sees another trainer's ratings.
-- ---------------------------------------------------------------------------
select pg_temp.rec(
  'ratings: trainer sees only rows about themselves',
  (select count(*) from public.trainer_ratings)
    = (select count(*) from public.trainer_ratings where trainer_id = public.current_profile_id()),
  jsonb_build_object('visible', (select count(*) from public.trainer_ratings))
);

select set_config('request.jwt.claims',
  '{"sub":"9f4b61f3-3969-49b3-828c-7a4e02b2a4c2","aal":"aal1"}', true);

select pg_temp.rec(
  'ratings: another trainer cannot see those ratings',
  (select count(*) from public.trainer_ratings where trainer_id = 'tr-mv55zntx-fw75m') = 0,
  jsonb_build_object('visible', (select count(*) from public.trainer_ratings where trainer_id = 'tr-mv55zntx-fw75m'))
);

select pg_temp.rec(
  'ratings: trainer cannot truncate the table',
  not has_table_privilege('authenticated', 'public.trainer_ratings', 'TRUNCATE'),
  '{}'::jsonb
);

do $$
begin
  begin
    insert into public.trainer_ratings (id, trainee_id, trainer_id, program_id, data)
    values ('zz-rt-direct', public.current_profile_id(), 'tr-mv55zntx-fw75m', 'barista', '{"rating":5}'::jsonb);
    perform pg_temp.rec('ratings: no client role can insert a rating directly', false,
      '{"error":"no exception"}'::jsonb);
  exception when insufficient_privilege then
    perform pg_temp.rec('ratings: no client role can insert a rating directly', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"ced33251-2a4e-42ed-9771-c83f584e3b80","aal":"aal1"}', true);

select set_config('role', 'postgres', true);

select pg_temp.rec(
  'feedback: original text survived trainer tamper attempts',
  (select feedback_text from public.trainer_feedback where id = (select id from zz_fbid))
    = (select feedback_text from zz_fbid),
  jsonb_build_object(
    'stored', (select feedback_text from public.trainer_feedback where id = (select id from zz_fbid)),
    'original', (select feedback_text from zz_fbid)
  )
);

-- ---------------------------------------------------------------------------
-- Auditable admin correction
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"ab22f03f-f234-4957-9322-2078e9950651","aal":"aal2"}', true);

create temp table zz_correction as
select public.admin_correct_trainer_feedback(
  (select id from zz_fbid),
  'Corrected: the trainer was patient and explained every step clearly.',
  'I learned the practical steps and felt supported.',
  'Patient and clear',
  'More practice time on the practical tasks',
  'Keep the same pacing',
  'Clarified wording after review'
) as r;
grant select on zz_correction to authenticated;

select pg_temp.rec(
  'feedback: admin correction creates a revision',
  (select count(*) from public.trainer_feedback_revisions
    where feedback_id = (select id from zz_fbid)) = 1,
  (select r from zz_correction)
);

select pg_temp.rec(
  'feedback: revision preserves the original text',
  (select previous_values->>'feedback_text' from public.trainer_feedback_revisions
    where feedback_id = (select id from zz_fbid) limit 1)
    = (select feedback_text from zz_fbid),
  '{}'::jsonb
);

select pg_temp.rec(
  'feedback: corrected text is stored',
  (select feedback_text from public.trainer_feedback where id = (select id from zz_fbid))
    like 'Corrected:%',
  '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
select pg_temp.rec(
  'audit: submission is recorded',
  exists (select 1 from public.audit_logs
           where action = 'TRAINER_FEEDBACK_SUBMITTED'
             and target_id = (select id from zz_fbid)),
  '{}'::jsonb
);

select pg_temp.rec(
  'audit: correction is recorded',
  exists (select 1 from public.audit_logs
           where action = 'TRAINER_FEEDBACK_CORRECTED'
             and target_id = (select id from zz_fbid)),
  '{}'::jsonb
);

select public.log_trainer_feedback_export(
  jsonb_build_object('trainer_id', 'tr-mv55zntx-fw75m'), 1, 'csv');

select pg_temp.rec(
  'audit: export is recorded',
  exists (select 1 from public.audit_logs
           where action = 'TRAINER_FEEDBACK_EXPORTED'
             and metadata->>'row_count' = '1'),
  '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Timed assessment fixtures
-- ---------------------------------------------------------------------------
insert into public.programs (id, code, title, data)
values (
  'zz-timer-prog', 'ZZ-T', 'Timer Test Program',
  jsonb_build_object(
    'title', 'Timer Test Program',
    'competencies', '[]'::jsonb,
    'quizzes', jsonb_build_array(
      jsonb_build_object(
        'id', 'zz-timer-quiz', 'title', 'Timer Quiz 15', 'published', true,
        'passing', 75, 'timeLimit', 20,
        'startDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
        'startTime', '00:00',
        'deadlineDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
        'deadlineTime', '23:59',
        'questions', (
          select jsonb_agg(jsonb_build_object('id', 'zzq' || i, 'type', 'id', 'answer', 'a'))
          from generate_series(1, 15) i
        )
      ),
      jsonb_build_object(
        'id', 'zz-timer-quiz2', 'title', 'Timer Quiz 10', 'published', true,
        'passing', 75, 'timeLimit', 20,
        'startDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
        'startTime', '00:00',
        'deadlineDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
        'deadlineTime', '23:59',
        'questions', (
          select jsonb_agg(jsonb_build_object('id', 'zzr' || i, 'type', 'id', 'answer', 'a'))
          from generate_series(1, 10) i
        )
      )
    ),
    'exams', jsonb_build_array(jsonb_build_object(
      'id', 'zz-timer-exam', 'title', 'Timer Exam', 'published', true,
      'passing', 75, 'timeLimit', 60,
      'startDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
      'startTime', '00:00',
      'deadlineDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
      'deadlineTime', '23:59',
      'questions', (
        select jsonb_agg(jsonb_build_object('id', 'zze' || i, 'type', 'id', 'answer', 'a'))
        from generate_series(1, 5) i
      )
    ))
  )
);

insert into public.trainer_programs (trainer_id, program_id, status)
values ('tr-mv55zntx-fw75m', 'zz-timer-prog', 'active');

insert into public.enrollments (id, trainee_id, program_id, status, data)
values ('zz-timer-enr', 'tn-mv5614d2-ifto6', 'zz-timer-prog', 'Enrolled',
        jsonb_build_object('trainerId', 'tr-mv55zntx-fw75m', 'progress', '{}'::jsonb));

-- ---------------------------------------------------------------------------
-- Test A/B: start, refresh, partial answers
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"868d76fd-6110-43d6-86fd-858c8aec0f89","aal":"aal1"}', true);

create temp table zz_timer as
select public.start_quiz_attempt('zz-timer-prog', 'zz-timer-quiz') as j;
create temp table zz_timer_id as select j->>'id' as id from zz_timer;
grant select on zz_timer_id to authenticated;

select pg_temp.rec(
  'timer: start creates a server deadline',
  (select (j->>'status') = 'in_progress'
      and (j->>'remaining_seconds')::int between 1195 and 1200
      and (j->>'deadline_at') is not null
   from zz_timer),
  (select j from zz_timer)
);

create temp table zz_state1 as
select public.get_quiz_attempt((select id from zz_timer_id)) as j;
create temp table zz_state2 as
select public.get_quiz_attempt((select id from zz_timer_id)) as j;

select pg_temp.rec(
  'timer: refresh keeps the original started_at and deadline_at',
  (select (j->>'started_at') = (select j->>'started_at' from zz_state2)
      and (j->>'deadline_at') = (select j->>'deadline_at' from zz_state2)
   from zz_state1),
  jsonb_build_object(
    'first', (select j from zz_state1),
    'second', (select j from zz_state2)
  )
);

select pg_temp.rec(
  'timer: remaining time is derived from the stored deadline',
  (select (j->>'remaining_seconds')::int >= 0
      and (j->>'remaining_seconds')::int <= (select (j->>'remaining_seconds')::int from zz_state1)
   from zz_state2),
  jsonb_build_object(
    'first_remaining', (select (j->>'remaining_seconds')::int from zz_state1),
    'second_remaining', (select (j->>'remaining_seconds')::int from zz_state2)
  )
);

do $$
declare
  i int;
begin
  for i in 1..10 loop
    perform public.save_quiz_answer(
      (select id from zz_timer_id),
      'zzq' || i,
      case when i <= 8 then '"a"'::jsonb else '"b"'::jsonb end
    );
  end loop;
end $$;

create temp table zz_after_save as
select public.get_quiz_attempt((select id from zz_timer_id)) as j;

select pg_temp.rec(
  'timer: answers are persisted before the deadline',
  (select (j->>'answered_questions')::int = 10 and (j->>'status') = 'in_progress' from zz_after_save),
  (select j from zz_after_save)
);

-- Expire the attempt using server time (test fixture only).
select set_config('app.assessment_rpc', 'on', true);
update public.quiz_attempts
   set started_at = now() - interval '21 minutes',
       deadline_at = now() - interval '1 second'
 where id = (select id from zz_timer_id);
select set_config('app.assessment_rpc', 'off', true);

create temp table zz_late as
select public.save_quiz_answer((select id from zz_timer_id), 'zzq11', '"a"'::jsonb) as r;

select pg_temp.rec(
  'timer: answer after the deadline is rejected',
  (select (r->>'accepted')::boolean = false
      and (r->>'reason') = 'deadline_passed'
      and (r->'attempt'->>'status') = 'auto_submitted'
   from zz_late),
  (select r from zz_late)
);

create temp table zz_final1 as
select public.finalize_quiz_attempt((select id from zz_timer_id)) as j;
create temp table zz_final2 as
select public.finalize_quiz_attempt((select id from zz_timer_id)) as j;

select pg_temp.rec(
  'timer: partial completion scores 8/15 = 53.33% with 5 unanswered',
  (select (j->>'score')::int = 8
      and (j->>'total_questions')::int = 15
      and (j->>'answered_questions')::int = 10
      and (j->>'correct_answers')::int = 8
      and (j->>'incorrect_answers')::int = 2
      and (j->>'unanswered_questions')::int = 5
      and (j->>'percentage')::numeric = 53.33
      and (j->>'auto_submitted')::boolean = true
      and (j->>'status') = 'auto_submitted'
   from zz_final1),
  (select j from zz_final1)
);

select pg_temp.rec(
  'timer: repeated finalization is idempotent',
  (select (j->>'score') = (select j->>'score' from zz_final1)
      and (j->>'percentage') = (select j->>'percentage' from zz_final1)
      and (j->>'submitted_at') = (select j->>'submitted_at' from zz_final1)
   from zz_final2),
  jsonb_build_object(
    'first', (select j from zz_final1),
    'second', (select j from zz_final2)
  )
);

create temp table zz_after_final as
select public.save_quiz_answer((select id from zz_timer_id), 'zzq12', '"a"'::jsonb) as r;

select pg_temp.rec(
  'timer: no answer is accepted after finalization',
  (select (r->>'accepted')::boolean = false and (r->>'reason') = 'finalized' from zz_after_final),
  (select r from zz_after_final)
);

-- ---------------------------------------------------------------------------
-- Test C: expired exam is finalized on retrieval
-- ---------------------------------------------------------------------------
create temp table zz_exam as
select public.start_exam_attempt('zz-timer-prog', 'zz-timer-exam') as j;
create temp table zz_exam_id as select j->>'id' as id from zz_exam;
grant select on zz_exam_id to authenticated;

select set_config('app.assessment_rpc', 'on', true);
update public.exam_attempts
   set started_at = now() - interval '61 minutes',
       deadline_at = now() - interval '1 second'
 where id = (select id from zz_exam_id);
select set_config('app.assessment_rpc', 'off', true);

create temp table zz_exam_get as
select public.get_exam_attempt((select id from zz_exam_id)) as j;

select pg_temp.rec(
  'timer: expired exam is auto-finalized on retrieval',
  (select (j->>'status') = 'auto_submitted'
      and (j->>'auto_submitted')::boolean = true
      and (j->>'score')::int = 0
      and (j->>'unanswered_questions')::int = 5
   from zz_exam_get),
  (select j from zz_exam_get)
);

create temp table zz_exam_late as
select public.save_exam_answer((select id from zz_exam_id), 'zze1', '"a"'::jsonb) as r;

select pg_temp.rec(
  'timer: expired exam rejects new answers',
  (select (r->>'accepted')::boolean = false from zz_exam_late),
  (select r from zz_exam_late)
);

-- ---------------------------------------------------------------------------
-- Test D: offline trainee, only persisted answers count
-- ---------------------------------------------------------------------------
create temp table zz_offline as
select public.start_quiz_attempt('zz-timer-prog', 'zz-timer-quiz2') as j;
create temp table zz_offline_id as select j->>'id' as id from zz_offline;
grant select on zz_offline_id to authenticated;

select public.save_quiz_answer((select id from zz_offline_id), 'zzr1', '"a"'::jsonb);
select public.save_quiz_answer((select id from zz_offline_id), 'zzr2', '"a"'::jsonb);
select public.save_quiz_answer((select id from zz_offline_id), 'zzr3', '"b"'::jsonb);

select set_config('app.assessment_rpc', 'on', true);
update public.quiz_attempts
   set started_at = now() - interval '21 minutes',
       deadline_at = now() - interval '1 second'
 where id = (select id from zz_offline_id);
select set_config('app.assessment_rpc', 'off', true);

create temp table zz_offline_final as
select public.finalize_quiz_attempt((select id from zz_offline_id)) as j;

select pg_temp.rec(
  'timer: offline attempt grades only persisted answers',
  (select (j->>'score')::int = 2
      and (j->>'total_questions')::int = 10
      and (j->>'answered_questions')::int = 3
      and (j->>'unanswered_questions')::int = 7
      and (j->>'percentage')::numeric = 20.00
   from zz_offline_final),
  (select j from zz_offline_final)
);

-- ---------------------------------------------------------------------------
-- Test H: client tampering is blocked
-- ---------------------------------------------------------------------------
select set_config('role', 'authenticated', true);
select set_config('app.assessment_rpc', 'off', true);

do $$
declare
  v_rows     int := 0;
  v_score    int;
  v_status   text;
  v_deadline timestamptz;
begin
  update public.quiz_attempts
     set score = 99,
         status = 'in_progress',
         deadline_at = now() + interval '1 day'
   where id = (select id from zz_timer_id);
  get diagnostics v_rows = row_count;

  select score, status, deadline_at
  into v_score, v_status, v_deadline
  from public.quiz_attempts
  where id = (select id from zz_timer_id);

  perform pg_temp.rec(
    'security: trainee cannot alter score, status or deadline',
    v_score = 8 and v_status = 'auto_submitted' and v_deadline < now(),
    jsonb_build_object(
      'matched_rows', v_rows,
      'score', v_score,
      'status', v_status,
      'deadline_at', v_deadline
    )
  );
end $$;

select pg_temp.rec(
  'security: trainee cannot read raw answer rows',
  (select count(*) from public.quiz_attempt_answers
    where attempt_id = (select id from zz_timer_id)) = 0,
  '{}'::jsonb
);

-- A legacy single-shot insert cannot dictate its own score.
select set_config('role', 'postgres', true);

insert into public.programs (id, code, title, data)
values (
  'zz-legacy-prog', 'ZZ-L', 'Legacy Test Program',
  jsonb_build_object(
    'title', 'Legacy Test Program',
    'competencies', '[]'::jsonb,
    'quizzes', jsonb_build_array(jsonb_build_object(
      'id', 'zz-legacy-quiz', 'title', 'Legacy Quiz', 'published', true,
      'passing', 75, 'timeLimit', 20,
      'startDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
      'startTime', '00:00',
      'deadlineDate', to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD'),
      'deadlineTime', '23:59',
      'questions', jsonb_build_array(
        jsonb_build_object('id', 'zzl1', 'type', 'id', 'answer', 'a'),
        jsonb_build_object('id', 'zzl2', 'type', 'id', 'answer', 'a'),
        jsonb_build_object('id', 'zzl3', 'type', 'id', 'answer', 'a')
      )
    )),
    'exams', '[]'::jsonb
  )
);

insert into public.enrollments (id, trainee_id, program_id, status, data)
values ('zz-legacy-enr', 'tn-mv5614d2-ifto6', 'zz-legacy-prog', 'Enrolled',
        jsonb_build_object('progress', '{}'::jsonb));

select set_config('request.jwt.claims',
  '{"sub":"868d76fd-6110-43d6-86fd-858c8aec0f89","aal":"aal1"}', true);
select set_config('app.assessment_rpc', 'off', true);
select set_config('role', 'authenticated', true);

insert into public.quiz_attempts (id, trainee_id, program_id, data)
values (
  'zz-legacy-attempt',
  'tn-mv5614d2-ifto6',
  'zz-legacy-prog',
  jsonb_build_object(
    'quizId', 'zz-legacy-quiz',
    'quizTitle', 'Legacy Quiz',
    'startedAt', to_jsonb(now()),
    'score', 99,
    'total', 99,
    'percentage', 99,
    'answers', jsonb_build_array(
      jsonb_build_object('questionId', 'zzl1', 'given', 'a'),
      jsonb_build_object('questionId', 'zzl2', 'given', 'a'),
      jsonb_build_object('questionId', 'zzl3', 'given', 'b')
    )
  )
);

select pg_temp.rec(
  'security: legacy insert is graded by the server',
  (select score = 2 and total_questions = 3 and percentage = 66.67
   from public.quiz_attempts where id = 'zz-legacy-attempt'),
  (select jsonb_build_object(
     'score', score, 'total', total_questions,
     'percentage', percentage, 'status', status
   ) from public.quiz_attempts where id = 'zz-legacy-attempt')
);

-- The real existing flow: the client writes a quiz_sessions row at start, then
-- submits the attempt. The session clock must be server-owned and the attempt
-- must be graded against it.
select set_config('role', 'postgres', true);

insert into public.enrollments (id, trainee_id, program_id, status, data)
values ('zz-legacy-enr2', 'tn-mvg2fxex-0hhe8', 'zz-legacy-prog', 'Enrolled',
        jsonb_build_object('progress', '{}'::jsonb));

insert into public.quiz_sessions (id, trainee_id, program_id, quiz_id, data)
values ('zz-legacy-session', 'tn-mvg2fxex-0hhe8', 'zz-legacy-prog', 'zz-legacy-quiz',
        jsonb_build_object('startedAt', '2000-01-01T00:00:00Z'));

create temp table zz_session_clock as
select started_at, deadline_at from public.quiz_sessions where id = 'zz-legacy-session';
grant select on zz_session_clock to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"93515538-b68f-42a1-9722-e974c7ed9d73","aal":"aal1"}', true);
select set_config('app.assessment_rpc', 'off', true);
select set_config('role', 'authenticated', true);

-- A client-supplied startedAt cannot move the session clock.
update public.quiz_sessions
   set data = data || '{"startedAt":"2000-01-01T00:00:00Z"}'::jsonb
 where id = 'zz-legacy-session';

select pg_temp.rec(
  'timer: legacy session clock cannot be reset by the client',
  (select started_at = (select started_at from zz_session_clock)
      and deadline_at = (select deadline_at from zz_session_clock)
   from public.quiz_sessions where id = 'zz-legacy-session'),
  (select jsonb_build_object('started_at', started_at, 'deadline_at', deadline_at)
   from public.quiz_sessions where id = 'zz-legacy-session')
);

insert into public.quiz_attempts (id, trainee_id, program_id, data)
values (
  'zz-legacy-attempt2',
  'tn-mvg2fxex-0hhe8',
  'zz-legacy-prog',
  jsonb_build_object(
    'quizId', 'zz-legacy-quiz',
    'quizTitle', 'Legacy Quiz',
    'startedAt', to_jsonb(now()),
    'score', 99,
    'total', 99,
    'percentage', 99,
    'answers', jsonb_build_array(
      jsonb_build_object('questionId', 'zzl1', 'given', 'a'),
      jsonb_build_object('questionId', 'zzl2', 'given', 'a'),
      jsonb_build_object('questionId', 'zzl3', 'given', 'b')
    )
  )
);

select pg_temp.rec(
  'timer: legacy session submission is graded against the session deadline',
  (select score = 2 and total_questions = 3 and percentage = 66.67
   from public.quiz_attempts where id = 'zz-legacy-attempt2'),
  (select jsonb_build_object(
     'score', score, 'total', total_questions,
     'percentage', percentage, 'status', status
   ) from public.quiz_attempts where id = 'zz-legacy-attempt2')
);

select pg_temp.rec(
  'timer: session is cleared after the legacy submission',
  (select count(*) from public.quiz_sessions where id = 'zz-legacy-session') = 0,
  '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- RLS isolation
-- ---------------------------------------------------------------------------
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims',
  '{"sub":"93515538-b68f-42a1-9722-e974c7ed9d73","aal":"aal1"}', true);
select set_config('role', 'authenticated', true);

select pg_temp.rec(
  'security: trainee cannot read another trainee attempt',
  (select count(*) from public.quiz_attempts where id = (select id from zz_timer_id)) = 0,
  '{}'::jsonb
);

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims',
  '{"sub":"ced33251-2a4e-42ed-9771-c83f584e3b80","aal":"aal1"}', true);
select set_config('role', 'authenticated', true);

select pg_temp.rec(
  'security: assigned trainer can read the attempt',
  (select count(*) from public.quiz_attempts where id = (select id from zz_timer_id)) = 1,
  '{}'::jsonb
);

do $$
declare
  v_rows int := 0;
begin
  update public.quiz_attempts set score = 0 where id = (select id from zz_timer_id);
  get diagnostics v_rows = row_count;
  perform pg_temp.rec('security: trainer cannot modify a finalized attempt', v_rows = 0,
    jsonb_build_object('updated_rows', v_rows));
end $$;

select set_config('role', 'postgres', true);

-- ---------------------------------------------------------------------------
-- Automatic completion (050)
-- ---------------------------------------------------------------------------
do $autocomplete$
declare
  v_status text;
  v_audit  int;
  v_empty  text;
  v_trainee text;
begin
  select id into v_trainee from public.profiles where role = 'trainee' order by id limit 1;

  insert into public.programs (id, code, title, data)
  values ('zz-ac-prog', 'ZZAC', 'ZZ Auto Complete',
          '{"competencies":[{"id":"c1","lessons":[{"id":"l1","published":true},{"id":"l2","published":true}]}]}'::jsonb)
  on conflict (id) do nothing;

  insert into public.enrollments (id, trainee_id, program_id, status, data)
  values ('zz-ac-enr', v_trainee, 'zz-ac-prog', 'Enrolled', '{"progress":{"l1":true}}'::jsonb)
  on conflict (id) do nothing;

  select status into v_status from public.enrollments where id = 'zz-ac-enr';
  perform pg_temp.rec('auto-complete: partial progress stays Enrolled', v_status = 'Enrolled',
    jsonb_build_object('status', v_status));

  update public.enrollments
     set data = jsonb_set(data, '{progress}', '{"l1":true,"l2":true}'::jsonb)
   where id = 'zz-ac-enr';

  select status into v_status from public.enrollments where id = 'zz-ac-enr';
  perform pg_temp.rec('auto-complete: finishing every lesson sets Completed', v_status = 'Completed',
    jsonb_build_object('status', v_status));

  select count(*) into v_audit
  from public.audit_logs
  where target_id = 'zz-ac-enr' and action = 'ENROLLMENT_AUTO_COMPLETED';
  perform pg_temp.rec('auto-complete: audit row written', v_audit = 1,
    jsonb_build_object('rows', v_audit));

  insert into public.programs (id, code, title, data)
  values ('zz-ac-empty', 'ZZAE', 'ZZ Empty', '{"competencies":[]}'::jsonb)
  on conflict (id) do nothing;

  insert into public.enrollments (id, trainee_id, program_id, status, data)
  values ('zz-ac-enr2', v_trainee, 'zz-ac-empty', 'Enrolled', '{}'::jsonb)
  on conflict (id) do nothing;

  select status into v_empty from public.enrollments where id = 'zz-ac-enr2';
  perform pg_temp.rec('auto-complete: program without lessons never completes', v_empty = 'Enrolled',
    jsonb_build_object('status', v_empty));
end $autocomplete$;

-- ---------------------------------------------------------------------------
-- Stars are part of the same submission (054)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"868d76fd-6110-43d6-86fd-858c8aec0f89","aal":"aal1"}', true);
select set_config('role', 'authenticated', true);

do $$
begin
  begin
    perform public.submit_trainer_feedback('zz-fb-enr2', 'No stars given');
    perform pg_temp.rec('feedback: submission without stars is rejected', false, '{"error":"no exception"}'::jsonb);
  exception when invalid_parameter_value then
    perform pg_temp.rec('feedback: submission without stars is rejected', true,
      jsonb_build_object('sqlstate', SQLSTATE));
  end;
end $$;

select pg_temp.rec(
  'feedback: stars and text are submitted together',
  (public.submit_trainer_feedback(
     'zz-fb-enr2',
     'Great pacing and clear examples throughout.',
     'I learned the practical steps.',
     'Patient and clear',
     'More practice time',
     'Recommended',
     4::smallint
   )->>'status') = 'submitted',
  '{}'::jsonb
);

select pg_temp.rec(
  'feedback: stars are mirrored into trainer_ratings',
  (select (data->>'rating')::int from public.trainer_ratings
    where trainee_id = 'tn-mv5614d2-ifto6' and trainer_id = 'tr-mv55zntx-fw75m') = 4,
  jsonb_build_object('stored', (select data from public.trainer_ratings
    where trainee_id = 'tn-mv5614d2-ifto6' and trainer_id = 'tr-mv55zntx-fw75m'))
);


select set_config('role', 'postgres', true);

-- ---------------------------------------------------------------------------
-- Privilege hardening (049): TRUNCATE bypasses RLS, so no client role may hold
-- it on any table added by 042-049.
-- ---------------------------------------------------------------------------
do $guard$
declare
  v_answer_truncate boolean;
  v_feedback_truncate boolean;
  v_attempt_truncate boolean;
begin
  v_answer_truncate := has_table_privilege('authenticated', 'public.quiz_attempt_answers', 'TRUNCATE')
                    or has_table_privilege('authenticated', 'public.exam_attempt_answers', 'TRUNCATE');
  perform pg_temp.rec('grants: answer tables are not truncatable by clients', not v_answer_truncate,
    jsonb_build_object('authenticated_can_truncate', v_answer_truncate));

  v_feedback_truncate := has_table_privilege('authenticated', 'public.trainer_feedback', 'TRUNCATE')
                      or has_table_privilege('authenticated', 'public.trainer_feedback_revisions', 'TRUNCATE');
  perform pg_temp.rec('grants: feedback tables are not truncatable by clients', not v_feedback_truncate,
    jsonb_build_object('authenticated_can_truncate', v_feedback_truncate));

  v_attempt_truncate := has_table_privilege('authenticated', 'public.quiz_attempts', 'TRUNCATE')
                     or has_table_privilege('authenticated', 'public.exam_attempts', 'TRUNCATE')
                     or has_table_privilege('authenticated', 'public.quiz_sessions', 'TRUNCATE');
  perform pg_temp.rec('grants: attempt tables are not truncatable by clients', not v_attempt_truncate,
    jsonb_build_object('authenticated_can_truncate', v_attempt_truncate));
end $guard$;

-- ---------------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------------
select jsonb_build_object(
  'total', count(*),
  'passed', count(*) filter (where passed),
  'failed', count(*) filter (where not passed),
  'failures', coalesce(
    jsonb_agg(jsonb_build_object('name', name, 'detail', detail))
      filter (where not passed),
    '[]'::jsonb
  )
) as summary
from zz_results;

rollback;
