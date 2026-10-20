-- ---------------------------------------------------------------------------
-- 037_lock_online_enrollment.sql
-- Trainees can no longer self-enroll in any program: every course now shows the
-- "Enrollment: Contact Admin" state. Enrollments are created by the
-- administrator (assigning a program to a trainee).
--
-- Idempotent: only rows that are still enrollable are touched.
-- ---------------------------------------------------------------------------

update public.programs
set data = jsonb_set(data, '{enrollable}', 'false'::jsonb)
where data->>'enrollable' is distinct from 'false';
