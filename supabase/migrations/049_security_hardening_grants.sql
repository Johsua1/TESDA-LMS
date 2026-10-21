-- ===========================================================================
-- 049_security_hardening_grants.sql
--
-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. TRUNCATE is *not* filtered by RLS, so an authenticated user
-- holding it could empty an attempt/answer/feedback table regardless of any
-- policy. REFERENCES and TRIGGER are likewise unnecessary for clients.
--
-- This migration keeps exactly the privileges the API surface needs and drops
-- the rest. DML on quiz_attempts / exam_attempts / quiz_sessions is preserved
-- because the (unmodified) frontend still writes attempt rows directly; those
-- writes are constrained by the guard triggers from 031/040/046.
--
-- Additive and idempotent: safe to re-run.
-- ===========================================================================

-- Answer tables: read-only for trainers/admins via RLS; writes only through
-- the SECURITY DEFINER save_*_answer() functions.
revoke truncate, references, trigger
  on public.quiz_attempt_answers,
     public.exam_attempt_answers
  from anon, authenticated;

revoke insert, update, delete
  on public.quiz_attempt_answers,
     public.exam_attempt_answers
  from anon, authenticated;

revoke all on public.quiz_attempt_answers, public.exam_attempt_answers from anon;
grant select on public.quiz_attempt_answers, public.exam_attempt_answers
  to authenticated;

-- Feedback tables: SELECT only (RLS-filtered). Submission and corrections go
-- through SECURITY DEFINER functions.
revoke truncate, references, trigger
  on public.trainer_feedback,
     public.trainer_feedback_revisions
  from anon, authenticated;

revoke all on public.trainer_feedback from anon;
revoke all on public.trainer_feedback_revisions from anon;
grant select on public.trainer_feedback, public.trainer_feedback_revisions
  to authenticated;

-- Attempt tables keep their DML grants (legacy frontend writes whole rows and
-- BEFORE INSERT triggers re-grade them), but nothing may truncate or re-index
-- them from a client role.
revoke truncate, references, trigger
  on public.quiz_attempts,
     public.exam_attempts,
     public.quiz_sessions
  from anon, authenticated;
