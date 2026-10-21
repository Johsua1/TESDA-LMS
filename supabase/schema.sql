-- ===========================================================================
-- HYT Global Institute / TESDA-LMS  —  Supabase schema
-- ---------------------------------------------------------------------------
-- HOW TO USE
--   1) Supabase Dashboard > SQL Editor > New query
--   2) Paste this ENTIRE file and click Run.
--   3) (Recommended) Authentication > Providers > Email > turn OFF
--      "Confirm email", so trainee self-signup logs in immediately.
--   4) Paste your Project URL + anon key into src/lib/supabase.js
--
-- This file is idempotent — it is safe to run more than once.
-- It creates: tables, helper functions, RLS policies, admin RPCs, and seeds
-- the 6-program catalog plus ONE Super Admin account.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- TABLES  (one row per entity: `id text` + a few scalar columns + `data jsonb`)
-- The `data` column holds the exact object shape the frontend already uses.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           text primary key,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  role         text not null default 'trainee',
  email        text unique,
  name         text,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.programs (
  id         text primary key,
  code       text,
  title      text,
  trainer_id text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id         text primary key,
  program_id text,
  trainer_id text,
  date       date,
  data       jsonb not null default '{}'::jsonb
);

create table if not exists public.enrollments (
  id         text primary key,
  trainee_id text,
  program_id text,
  status     text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id          text primary key,
  trainee_id  text,
  program_id  text,
  schedule_id text,
  data        jsonb not null default '{}'::jsonb,
  unique (trainee_id, schedule_id)
);

create table if not exists public.quiz_attempts (
  id         text primary key,
  trainee_id text,
  program_id text,
  data       jsonb not null default '{}'::jsonb
);

create table if not exists public.exam_attempts (
  id         text primary key,
  trainee_id text,
  program_id text,
  data       jsonb not null default '{}'::jsonb
);

create table if not exists public.typing_tests (
  id         text primary key,
  trainee_id text,
  program_id text,
  trainer_id text,
  data       jsonb not null default '{}'::jsonb
);

create table if not exists public.evaluations (
  id         text primary key,
  trainee_id text,
  program_id text,
  trainer_id text,
  data       jsonb not null default '{}'::jsonb,
  unique (trainee_id, program_id)
);

create table if not exists public.announcements (
  id         text primary key,
  author_id  text,
  program_id text,
  audience   text,
  date       date,
  data       jsonb not null default '{}'::jsonb
);

create table if not exists public.settings (
  id         text primary key default 'global' check (id = 'global'),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bring a pre-existing profiles table up to the shape this file expects.
-- `create table if not exists` does not add columns to an older table, and the
-- helper functions below reference auth_user_id immediately.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists auth_user_id uuid;
create unique index if not exists profiles_auth_user_id_key
  on public.profiles (auth_user_id);

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- SECURITY DEFINER so RLS policies can read `profiles` without recursing.
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns text
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid() limit 1
$$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Baseline: any signed-in user may READ everything (the SPA already gates by
-- role). Writes are restricted where it is safe to do so. Tune later if needed.
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.programs      enable row level security;
alter table public.schedules     enable row level security;
alter table public.enrollments   enable row level security;
alter table public.attendance    enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.typing_tests  enable row level security;
alter table public.evaluations   enable row level security;
alter table public.announcements enable row level security;
alter table public.settings      enable row level security;

-- ---- profiles ----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (auth_user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth_user_id = auth.uid() or public.current_role() = 'admin')
  with check (auth_user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (public.current_role() = 'admin');

-- ---- read-all + role-gated write tables ----
-- programs / schedules / announcements / evaluations: admin + trainer write.
do $$
declare t text;
begin
  foreach t in array array['programs','schedules','announcements','evaluations'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated using (public.current_role() in (''admin'',''trainer'')) with check (public.current_role() in (''admin'',''trainer''))',
      t, t);
  end loop;
end $$;

-- ---- read-all + authenticated write tables ----
-- enrollments / attendance / attempts / typing tests / settings.
do $$
declare t text;
begin
  foreach t in array array['enrollments','attendance','quiz_attempts','exam_attempts','typing_tests','settings'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated using (true) with check (true)',
      t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- ADMIN RPCs
-- Let a signed-in Super Admin create/delete accounts straight from the browser
-- (anon key only). SECURITY DEFINER inserts into auth.users on the caller's
-- behalf after verifying the caller's role.
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_user(
  p_email    text,
  p_password text,
  p_role     text,
  p_id       text,
  p_name     text,
  p_data     jsonb default '{}'::jsonb
)
returns text
language plpgsql security definer set search_path = public, auth, extensions
as $$
declare
  v_uid             uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Only a Super Admin can create accounts.';
  end if;
  if coalesce(p_email, '') = '' then
    raise exception 'Email is required.';
  end if;
  if coalesce(p_password, '') = '' then
    raise exception 'Password is required.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'name', p_name),
    '', '', '', ''
  );

  -- GoTrue changed auth.identities across versions: newer builds have both an
  -- `id uuid default` and `provider_id text`; older builds use `id text` as the
  -- provider id. Handle both.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  end if;

  insert into public.profiles (id, auth_user_id, role, email, name, data)
  values (p_id, v_uid, p_role, lower(p_email), p_name, coalesce(p_data, '{}'::jsonb))
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        role         = excluded.role,
        email        = excluded.email,
        name         = excluded.name,
        data         = excluded.data,
        updated_at   = now();

  return p_id;
end $$;

create or replace function public.admin_delete_user(p_id text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_uid uuid;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Only a Super Admin can delete accounts.';
  end if;
  select auth_user_id into v_uid from public.profiles where id = p_id;
  delete from public.profiles where id = p_id;
  if v_uid is not null then
    delete from auth.users where id = v_uid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.admin_create_user(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_delete_user(text) to authenticated;

-- ---------------------------------------------------------------------------
-- SEED: SUPER ADMIN
-- Login: admin@tesda.gov.ph  /  Admin@12345   (change it after first login!)
-- ---------------------------------------------------------------------------
do $$
declare
  v_uid             uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  if exists (select 1 from public.profiles where id = 'sa-001') then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'admin@tesda.gov.ph', crypt('Admin@12345', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', 'admin', 'name', 'Super Administrator'),
    '', '', '', ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', 'admin@tesda.gov.ph'),
            'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', 'admin@tesda.gov.ph'),
            'email', now(), now(), now());
  end if;

  insert into public.profiles (id, auth_user_id, role, email, name, data)
  values (
    'sa-001', v_uid, 'admin', 'admin@tesda.gov.ph', 'Super Administrator',
    jsonb_build_object(
      'avatarColor', 'from-tesda-blue to-brand-700',
      'position', 'Super Administrator',
      'phone', '', 'address', '',
      'since', to_char(now(), 'YYYY-MM-DD')
    )
  );
end $$;

-- The 6-program catalog seed is appended below by scripts/gen-programs.mjs

-- =======================  SEED: PROGRAM CATALOG  =======================
-- The 6 training programs with their lessons, quizzes and exams.
-- Safe to re-run (upsert by id).

insert into public.programs (id, code, title, trainer_id, data)
values ('housekeeping', 'HK-102', 'Housekeeping NC II', 'tr-001', $prog${"id":"housekeeping","code":"HK-102","title":"Housekeeping NC II","category":"Tourism & Hospitality","level":"NC II","special":false,"enrollable":false,"description":"Prepare trainees to clean and prepare guest rooms, handle linen, and deliver quality housekeeping services in hotels and resorts.","overview":"The Housekeeping NC II program equips trainees with the skills to maintain cleanliness and orderliness in guest rooms and public areas of hospitality establishments. It covers room cleaning, bed making, bathroom sanitation, linen management and guest room inspection.","duration":"3 months","hours":160,"fee":8500,"color":"from-sky-500 to-blue-600","image":"/courses/housekeeping.jpg","coverBackground":false,"requirements":["At least 18 years old","High School graduate or ALS equivalent","Physically fit (medical certificate)","Birth certificate (PSA)","2 pcs. 2x2 ID picture","Barangay clearance"],"trainerId":"tr-001","competencies":[{"id":"housekeeping-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"housekeeping-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"housekeeping-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"housekeeping-basic-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"housekeeping-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"housekeeping-basic-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"housekeeping-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"housekeeping-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"housekeeping-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"housekeeping-basic-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"housekeeping-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"housekeeping-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"housekeeping-basic-l4-quiz"}]},{"id":"housekeeping-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"housekeeping-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"housekeeping-common-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"housekeeping-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"housekeeping-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"housekeeping-common-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"housekeeping-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"housekeeping-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"housekeeping-common-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"housekeeping-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"housekeeping-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"housekeeping-common-l4-quiz"}]},{"id":"housekeeping-core","type":"Core","title":"Core Competency","description":"The core competencies of Housekeeping NC II: preparing guest rooms, cleaning procedures, bed making, bathroom cleaning, and guest room inspection.","lessons":[],"units":[{"id":"housekeeping-core-u1","title":"Room Cleaning Procedures","description":"Clean and prepare guest rooms according to establishment standards.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u1-l1","title":"Introduction to Housekeeping Operations","description":"Understand the role of housekeeping in the hospitality industry.","duration":45,"video":"Introduction to Housekeeping Operations","materials":[{"id":"housekeeping-core-u1-l1-m1","name":"Housekeeping Dept. Overview.pdf","type":"pdf","url":""}],"content":"Housekeeping is the heart of hospitality. This lesson introduces the department structure, roles and responsibilities, grooming standards, and the importance of cleanliness to guest satisfaction.","quizId":"housekeeping-core-u1-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-core-u1-l2","title":"Cleaning Equipment & Chemicals","description":"Identify, use and maintain cleaning tools, equipment and chemicals safely.","duration":50,"video":"Cleaning Equipment & Chemicals","materials":[{"id":"housekeeping-core-u1-l2-m1","name":"Cleaning Equipment Catalogue.pdf","type":"pdf","url":""},{"id":"housekeeping-core-u1-l2-m2","name":"Chemical Safety Data Sheet.pdf","type":"pdf","url":""}],"content":"Learn to identify common cleaning equipment such as vacuum cleaners, mops, and caddies. Understand chemical dilution, safety data sheets, and proper storage.","quizId":"housekeeping-core-u1-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"housekeeping-core-u1-l3","title":"Guest Room Preparation","description":"Systematically clean and prepare a guest room for occupancy.","duration":60,"video":"Guest Room Preparation","materials":[{"id":"housekeeping-core-u1-l3-m1","name":"Room Cleaning Checklist.pdf","type":"pdf","url":""}],"content":"Follow the standard sequence for guest room cleaning: entering the room, dusting, bed making, bathroom cleaning, replenishing supplies, and final inspection.","quizId":"housekeeping-core-u1-l3-quiz"}]},{"id":"housekeeping-core-u2","title":"Bed Making & Linen Handling","description":"Perform professional bed making and manage linen inventory.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u2-l1","title":"Bed Making Techniques","description":"Make beds to hotel standards including bed stripping and triple sheeting.","duration":45,"video":"Bed Making Techniques","materials":[{"id":"housekeeping-core-u2-l1-m1","name":"Bed Making Steps.pdf","type":"pdf","url":""}],"content":"Learn the step-by-step process of stripping, making, and inspecting a bed. Covers fitted sheets, flat sheets, duvets, pillowcases and decorative arrangements.","quizId":"housekeeping-core-u2-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-core-u2-l2","title":"Linen Room Management","description":"Sort, store and control linen inventory and laundering.","duration":40,"video":"Linen Room Management","materials":[{"id":"housekeeping-core-u2-l2-m1","name":"Linen Inventory Sheet.pdf","type":"pdf","url":""}],"content":"Manage linen par levels, sort soiled linen, coordinate with laundry, and maintain linen room organization to avoid losses.","quizId":"housekeeping-core-u2-l2-quiz"}]},{"id":"housekeeping-core-u3","title":"Bathroom Cleaning & Sanitation","description":"Deep-clean and sanitize bathrooms using proper techniques.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u3-l1","title":"Bathroom Cleaning Sequence","description":"Clean and sanitize all bathroom fixtures and surfaces.","duration":50,"video":"Bathroom Cleaning Sequence","materials":[{"id":"housekeeping-core-u3-l1-m1","name":"Bathroom Cleaning Guide.pdf","type":"pdf","url":""}],"content":"Learn top-to-bottom bathroom cleaning: mirrors, sink, toilet, shower/bathtub, floor, and amenities replenishment. Emphasizes hygiene and cross-contamination prevention.","quizId":"housekeeping-core-u3-l1-quiz"}]},{"id":"housekeeping-core-u4","title":"Guest Room Inspection","description":"Inspect rooms and handle guest requests and complaints.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u4-l1","title":"Room Inspection Standards","description":"Apply quality standards during guest room inspection.","duration":45,"video":"Room Inspection Standards","materials":[{"id":"housekeeping-core-u4-l1-m1","name":"Inspection Standards.pdf","type":"pdf","url":""}],"content":"Use inspection checklists to verify cleanliness, functionality, and presentation. Learn how to document and escalate issues.","quizId":"housekeeping-core-u4-l1-quiz"}]}]}],"quizzes":[{"id":"housekeeping-basic-l1-quiz","programId":"housekeeping","lessonId":"housekeeping-basic-l1","title":"Reading, Writing & Comprehension Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-basic-l1-quiz-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"housekeeping-basic-l1-quiz-q2","type":"tf","q":"When reading workplace instructions, it is fine to skip the steps you think are unnecessary.","answer":false},{"id":"housekeeping-basic-l1-quiz-q3","type":"id","q":"The central point of a paragraph is called the ______ idea.","answer":"main"},{"id":"housekeeping-basic-l1-quiz-q4","type":"mcq","q":"Which sentence is clearest for a workplace report?","options":["Done already yesterday by me the task.","The task was completed yesterday.","Task yesterday done.","Yesterday task done by me already."],"answer":"The task was completed yesterday."}]},{"id":"housekeeping-basic-l2-quiz","programId":"housekeeping","lessonId":"housekeeping-basic-l2","title":"Basic Communication Skills Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-basic-l2-quiz-q1","type":"mcq","q":"Which behavior is the strongest sign of active listening?","options":["Interrupting to correct the speaker","Repeating back what you understood","Checking your phone","Changing the topic"],"answer":"Repeating back what you understood"},{"id":"housekeeping-basic-l2-quiz-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"housekeeping-basic-l2-quiz-q3","type":"id","q":"Restating a message in your own words to confirm understanding is called ______.","answer":"paraphrasing"},{"id":"housekeeping-basic-l2-quiz-q4","type":"mcq","q":"Which tone is appropriate when writing to a customer?","options":["Sarcastic","Professional and courteous","Aggressive","Overly casual"],"answer":"Professional and courteous"}]},{"id":"housekeeping-basic-l3-quiz","programId":"housekeeping","lessonId":"housekeeping-basic-l3","title":"Basic Digital Literacy Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-basic-l3-quiz-q1","type":"mcq","q":"Which of these is an email application?","options":["Gmail","Excel","Photoshop","VLC"],"answer":"Gmail"},{"id":"housekeeping-basic-l3-quiz-q2","type":"tf","q":"A strong password should be shared with co-workers so they can open your files.","answer":false},{"id":"housekeeping-basic-l3-quiz-q3","type":"id","q":"The key combination Ctrl + C is used to ______ the selected text.","answer":"copy"},{"id":"housekeeping-basic-l3-quiz-q4","type":"mcq","q":"What should you do before opening an attachment from an unknown sender?","options":["Open it immediately","Verify the sender and scan it for malware","Forward it to all staff","Reply with your password"],"answer":"Verify the sender and scan it for malware"}]},{"id":"housekeeping-basic-l4-quiz","programId":"housekeeping","lessonId":"housekeeping-basic-l4","title":"Workplace Behavior & Professionalism Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-basic-l4-quiz-q1","type":"mcq","q":"What does punctuality at work demonstrate?","options":["Reliability and respect for others","That you are overworked","That you dislike the job","Nothing important"],"answer":"Reliability and respect for others"},{"id":"housekeeping-basic-l4-quiz-q2","type":"tf","q":"Personal social media accounts may be used to discuss confidential client information.","answer":false},{"id":"housekeeping-basic-l4-quiz-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"housekeeping-basic-l4-quiz-q4","type":"mcq","q":"A colleague keeps arriving late. What is the professional response?","options":["Post about it online","Raise it with the supervisor privately","Ignore your own work","Confront them in front of clients"],"answer":"Raise it with the supervisor privately"}]},{"id":"housekeeping-common-l1-quiz","programId":"housekeeping","lessonId":"housekeeping-common-l1","title":"Workplace Communication Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-common-l1-quiz-q1","type":"mcq","q":"Which channel is best for reporting an urgent safety incident?","options":["A memo next week","A call or direct message to the supervisor","A suggestion box","A social media post"],"answer":"A call or direct message to the supervisor"},{"id":"housekeeping-common-l1-quiz-q2","type":"tf","q":"Incident reports should be written as soon as possible after the event.","answer":true},{"id":"housekeeping-common-l1-quiz-q3","type":"id","q":"The written record of what was discussed in a meeting is called the ______.","answer":"minutes"},{"id":"housekeeping-common-l1-quiz-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"}]},{"id":"housekeeping-common-l2-quiz","programId":"housekeeping","lessonId":"housekeeping-common-l2","title":"Workplace Safety & Emergency Procedures Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-common-l2-quiz-q1","type":"mcq","q":"What does OSH stand for?","options":["Occupational Safety and Health","Office Staff Handbook","Operational Service Hours","Organized Safety Help"],"answer":"Occupational Safety and Health"},{"id":"housekeeping-common-l2-quiz-q2","type":"tf","q":"Fire exits must be kept clear of boxes and equipment at all times.","answer":true},{"id":"housekeeping-common-l2-quiz-q3","type":"id","q":"Gear worn to protect a worker from hazards is called ______ equipment.","answer":"personal protective"},{"id":"housekeeping-common-l2-quiz-q4","type":"mcq","q":"During an earthquake while indoors you should:","options":["Run to the elevator","Duck, cover and hold","Stand near the windows","Call clients first"],"answer":"Duck, cover and hold"}]},{"id":"housekeeping-common-l3-quiz","programId":"housekeeping","lessonId":"housekeeping-common-l3","title":"Customer Service Excellence Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-common-l3-quiz-q1","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"housekeeping-common-l3-quiz-q2","type":"tf","q":"Customer expectations are met only when the service is free of charge.","answer":false},{"id":"housekeeping-common-l3-quiz-q3","type":"id","q":"The measure of how happy customers are with a service is customer ______.","answer":"satisfaction"},{"id":"housekeeping-common-l3-quiz-q4","type":"mcq","q":"A customer is angry about a delayed order. What should you say first?","options":["That is not our problem.","I understand — let me check the status for you.","You should have ordered earlier.","Call again tomorrow."],"answer":"I understand — let me check the status for you."}]},{"id":"housekeeping-common-l4-quiz","programId":"housekeeping","lessonId":"housekeeping-common-l4","title":"Working with Others & Time Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-common-l4-quiz-q1","type":"mcq","q":"Which practice helps a team meet deadlines?","options":["Working without a plan","Setting priorities and tracking tasks","Avoiding updates","Doing everything at the last minute"],"answer":"Setting priorities and tracking tasks"},{"id":"housekeeping-common-l4-quiz-q2","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"housekeeping-common-l4-quiz-q3","type":"id","q":"Arranging tasks from most to least important is called ______.","answer":"prioritizing"},{"id":"housekeeping-common-l4-quiz-q4","type":"mcq","q":"A teammate is behind on a shared task. What is the best action?","options":["Ignore it","Offer help and inform the lead","Complain about it later","Take over without telling anyone"],"answer":"Offer help and inform the lead"}]},{"id":"housekeeping-core-u1-l1-quiz","programId":"housekeeping","lessonId":"housekeeping-core-u1-l1","title":"Introduction to Housekeeping Operations Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-core-u1-l1-quiz-q1","type":"mcq","q":"Housekeeping mainly delivers which guest expectation?","options":["Clean, comfortable rooms","Menu planning","Airline bookings","Building construction"],"answer":"Clean, comfortable rooms"},{"id":"housekeeping-core-u1-l1-quiz-q2","type":"tf","q":"Grooming standards apply to housekeeping staff because they deal with guests.","answer":true},{"id":"housekeeping-core-u1-l1-quiz-q3","type":"id","q":"The department that cleans guest rooms and public areas is ______.","answer":"housekeeping"},{"id":"housekeeping-core-u1-l1-quiz-q4","type":"mcq","q":"Which is a duty of a room attendant?","options":["Preparing payroll","Cleaning and preparing guest rooms","Designing the hotel website","Auditing financial statements"],"answer":"Cleaning and preparing guest rooms"}]},{"id":"housekeeping-core-u1-l2-quiz","programId":"housekeeping","lessonId":"housekeeping-core-u1-l2","title":"Cleaning Equipment & Chemicals Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-core-u1-l2-quiz-q1","type":"mcq","q":"Which tool is used to reach dust on high surfaces?","options":["Mop","Extendable duster","Bucket","Caddie"],"answer":"Extendable duster"},{"id":"housekeeping-core-u1-l2-quiz-q2","type":"tf","q":"Cleaning chemicals should be kept in labeled containers away from food.","answer":true},{"id":"housekeeping-core-u1-l2-quiz-q3","type":"id","q":"The document that explains a chemical's hazards is the Safety Data ______.","answer":"sheet"},{"id":"housekeeping-core-u1-l2-quiz-q4","type":"mcq","q":"Why is correct chemical dilution important?","options":["It makes cleaning slower","It cleans effectively without damaging surfaces","It uses more product","It avoids reading labels"],"answer":"It cleans effectively without damaging surfaces"}]},{"id":"housekeeping-core-u1-l3-quiz","programId":"housekeeping","lessonId":"housekeeping-core-u1-l3","title":"Guest Room Preparation Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-core-u1-l3-quiz-q1","type":"mcq","q":"What is the first step when cleaning a guest room?","options":["Making the bed","Knocking and announcing entry","Cleaning the bathroom","Vacuuming the floor"],"answer":"Knocking and announcing entry"},{"id":"housekeeping-core-u1-l3-quiz-q2","type":"tf","q":"Supplies are replenished before the final inspection of the room.","answer":true},{"id":"housekeeping-core-u1-l3-quiz-q3","type":"id","q":"The last step of room preparation is the final ______.","answer":"inspection"},{"id":"housekeeping-core-u1-l3-quiz-q4","type":"mcq","q":"Which cleaning order is correct?","options":["Bathroom, dusting, bed making","Dusting, bed making, bathroom cleaning","Bed making, dusting, bathroom cleaning","Floor, bathroom, dusting"],"answer":"Dusting, bed making, bathroom cleaning"}]},{"id":"housekeeping-core-u2-l1-quiz","programId":"housekeeping","lessonId":"housekeeping-core-u2-l1","title":"Bed Making Techniques Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-core-u2-l1-quiz-q1","type":"mcq","q":"Triple sheeting uses how many flat sheets?","options":["One","Two","Three","Four"],"answer":"Three"},{"id":"housekeeping-core-u2-l1-quiz-q2","type":"tf","q":"The bed is stripped before fresh linen is applied.","answer":true},{"id":"housekeeping-core-u2-l1-quiz-q3","type":"id","q":"The sheet placed over the mattress and tucked on all sides is the ______ sheet.","answer":"fitted"},{"id":"housekeeping-core-u2-l1-quiz-q4","type":"mcq","q":"How should pillowcases be finished?","options":["Left loose and wrinkled","Smooth, tucked and facing the same way","Placed under the bed","Changed once a week only"],"answer":"Smooth, tucked and facing the same way"}]},{"id":"housekeeping-core-u2-l2-quiz","programId":"housekeeping","lessonId":"housekeeping-core-u2-l2","title":"Linen Room Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-core-u2-l2-quiz-q1","type":"mcq","q":"A linen par level is:","options":["The maximum price of linen","The minimum stock kept on hand","The number of laundry staff","The color of the linen"],"answer":"The minimum stock kept on hand"},{"id":"housekeeping-core-u2-l2-quiz-q2","type":"tf","q":"Soiled linen is separated from clean linen immediately.","answer":true},{"id":"housekeeping-core-u2-l2-quiz-q3","type":"id","q":"Linen already used by guests is called ______ linen.","answer":"soiled"},{"id":"housekeeping-core-u2-l2-quiz-q4","type":"mcq","q":"Which practice reduces linen loss?","options":["Recording issues and returns","Storing linen in guest rooms","Loaning linen to staff","Mixing linen with trash"],"answer":"Recording issues and returns"}]},{"id":"housekeeping-core-u3-l1-quiz","programId":"housekeeping","lessonId":"housekeeping-core-u3-l1","title":"Bathroom Cleaning Sequence Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-core-u3-l1-quiz-q1","type":"mcq","q":"Which bathroom area is cleaned first?","options":["Floor","Mirror and sink","Toilet","Shower"],"answer":"Mirror and sink"},{"id":"housekeeping-core-u3-l1-quiz-q2","type":"tf","q":"The same cloth may be used for the toilet and the sink to save time.","answer":false},{"id":"housekeeping-core-u3-l1-quiz-q3","type":"id","q":"Using a separate color-coded cloth per area prevents ______.","answer":"cross-contamination"},{"id":"housekeeping-core-u3-l1-quiz-q4","type":"mcq","q":"Why is the bathroom floor cleaned last?","options":["It dries fastest","So dirt from other surfaces does not fall on it","It is the least dirty","Guests do not see it"],"answer":"So dirt from other surfaces does not fall on it"}]},{"id":"housekeeping-core-u4-l1-quiz","programId":"housekeeping","lessonId":"housekeeping-core-u4-l1","title":"Room Inspection Standards Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"housekeeping-core-u4-l1-quiz-q1","type":"mcq","q":"What is the purpose of a room inspection checklist?","options":["To delay room release","To verify cleanliness and functionality consistently","To record guest complaints only","To order supplies"],"answer":"To verify cleanliness and functionality consistently"},{"id":"housekeeping-core-u4-l1-quiz-q2","type":"tf","q":"Defects found during inspection should be documented and escalated.","answer":true},{"id":"housekeeping-core-u4-l1-quiz-q3","type":"id","q":"Rooms that pass inspection are reported to the front desk as ______ rooms.","answer":"ready"},{"id":"housekeeping-core-u4-l1-quiz-q4","type":"mcq","q":"Which item is checked for functionality during inspection?","options":["TV remote and lights","Guest luggage","Room rate","Menu prices"],"answer":"TV remote and lights"}]}],"exams":[{"id":"housekeeping-exam-1","programId":"housekeeping","title":"Housekeeping NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"housekeeping-exam-1-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"housekeeping-exam-1-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"housekeeping-exam-1-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"housekeeping-exam-1-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"},{"id":"housekeeping-exam-1-q5","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"housekeeping-exam-1-q6","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"housekeeping-exam-1-q7","type":"id","q":"The document that explains a chemical's hazards is the Safety Data ______.","answer":"sheet"},{"id":"housekeeping-exam-1-q8","type":"mcq","q":"Which cleaning order is correct?","options":["Bathroom, dusting, bed making","Dusting, bed making, bathroom cleaning","Bed making, dusting, bathroom cleaning","Floor, bathroom, dusting"],"answer":"Dusting, bed making, bathroom cleaning"},{"id":"housekeeping-exam-1-q9","type":"mcq","q":"A linen par level is:","options":["The maximum price of linen","The minimum stock kept on hand","The number of laundry staff","The color of the linen"],"answer":"The minimum stock kept on hand"},{"id":"housekeeping-exam-1-q10","type":"tf","q":"The same cloth may be used for the toilet and the sink to save time.","answer":false}],"questionCount":10,"timeLimit":60,"passing":75,"date":"2026-11-20","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('barista', 'BAR-204', 'Barista NC II', 'tr-002', $prog${"id":"barista","code":"BAR-204","title":"Barista NC II","category":"Tourism & Hospitality","level":"NC II","special":false,"enrollable":false,"description":"Train in coffee preparation, espresso extraction, milk steaming and latte art to become a professional barista.","overview":"The Barista NC II program develops the skills required to prepare and serve a variety of espresso-based and brewed coffee beverages. It covers coffee fundamentals, espresso preparation, milk texturing, latte art, and beverage menu preparation with excellent customer service.","duration":"2 months","hours":120,"fee":7500,"color":"from-amber-500 to-orange-600","image":"/courses/barista.jpg","coverBackground":false,"requirements":["At least 18 years old","High School graduate or ALS equivalent","Physically fit (medical certificate)","Birth certificate (PSA)","2 pcs. 2x2 ID picture","Barangay clearance"],"trainerId":"tr-002","competencies":[{"id":"barista-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"barista-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"barista-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"barista-basic-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"barista-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"barista-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"barista-basic-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"barista-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"barista-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"barista-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"barista-basic-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"barista-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"barista-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"barista-basic-l4-quiz"}]},{"id":"barista-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"barista-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"barista-common-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"barista-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"barista-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"barista-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"barista-common-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"barista-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"barista-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"barista-common-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"barista-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"barista-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"barista-common-l4-quiz"}]},{"id":"barista-core","type":"Core","title":"Core Competency","description":"Core competencies of Barista NC II: coffee fundamentals, espresso preparation, milk steaming and latte art, and beverage menu preparation.","lessons":[],"units":[{"id":"barista-core-u1","title":"Coffee Fundamentals","description":"Understand coffee varieties, origins, roasting and flavor profiles.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u1-l1","title":"Introduction to Coffee","description":"Explore the history, varieties and journey of coffee from bean to cup.","duration":45,"video":"Introduction to Coffee","materials":[{"id":"barista-core-u1-l1-m1","name":"Coffee Origins Chart.pdf","type":"pdf","url":""}],"content":"Learn about Arabica and Robusta, coffee-growing regions, processing methods, and how origin and roast affect flavor.","quizId":"barista-core-u1-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"barista-core-u1-l2","title":"Coffee Roasting & Grinding","description":"Understand roast levels and proper grinding for different brew methods.","duration":50,"video":"Coffee Roasting & Grinding","materials":[{"id":"barista-core-u1-l2-m1","name":"Grind Size Guide.pdf","type":"pdf","url":""}],"content":"Roast level dramatically affects taste. Learn light, medium and dark roasts, and how grind size must match the brewing method.","quizId":"barista-core-u1-l2-quiz"}]},{"id":"barista-core-u2","title":"Espresso Preparation","description":"Calibrate and extract consistent, high-quality espresso shots.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u2-l1","title":"The Espresso Machine","description":"Operate and maintain the espresso machine and grinder.","duration":55,"video":"The Espresso Machine","materials":[{"id":"barista-core-u2-l1-m1","name":"Espresso Machine Manual.pdf","type":"pdf","url":""}],"content":"Identify machine parts, understand pressure and temperature, and perform daily cleaning and backflushing routines.","quizId":"barista-core-u2-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"barista-core-u2-l2","title":"Dialing In the Shot","description":"Adjust grind and dose to achieve ideal extraction.","duration":50,"video":"Dialing In the Shot","materials":[{"id":"barista-core-u2-l2-m1","name":"Extraction Troubleshooting.pdf","type":"pdf","url":""}],"content":"Learn to diagnose over- and under-extraction, adjust grind, dose and tamp, and taste-test to standardize your espresso.","quizId":"barista-core-u2-l2-quiz"}]},{"id":"barista-core-u3","title":"Milk Steaming & Latte Art","description":"Steam milk to the correct texture and pour latte art.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u3-l1","title":"Milk Texturing","description":"Steam milk to create microfoam for espresso beverages.","duration":45,"video":"Milk Texturing","materials":[{"id":"barista-core-u3-l1-m1","name":"Milk Steaming Steps.pdf","type":"pdf","url":""}],"content":"Learn proper milk steaming technique for different temperatures and textures, including dairy and alternative milks.","quizId":"barista-core-u3-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"barista-core-u3-l2","title":"Basic Latte Art","description":"Pour a heart and rosetta using free-pour technique.","duration":50,"video":"Basic Latte Art","materials":[{"id":"barista-core-u3-l2-m1","name":"Latte Art Reference.pdf","type":"pdf","url":""}],"content":"Master milk-pitcher control to pour hearts, tulips and rosettas. Practice consistency and cup presentation.","quizId":"barista-core-u3-l2-quiz"}]},{"id":"barista-core-u4","title":"Beverage Menu & Customer Service","description":"Prepare the full beverage menu and serve customers.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u4-l1","title":"Building the Beverage Menu","description":"Prepare espresso-based and brewed beverages to recipe.","duration":55,"video":"Building the Beverage Menu","materials":[{"id":"barista-core-u4-l1-m1","name":"Standard Recipes.pdf","type":"pdf","url":""}],"content":"Prepare Americano, cappuccino, latte, flat white, mocha, and manual brews following standard recipes and presentation.","quizId":"barista-core-u4-l1-quiz"}]}]}],"quizzes":[{"id":"barista-basic-l1-quiz","programId":"barista","lessonId":"barista-basic-l1","title":"Reading, Writing & Comprehension Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-basic-l1-quiz-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"barista-basic-l1-quiz-q2","type":"tf","q":"When reading workplace instructions, it is fine to skip the steps you think are unnecessary.","answer":false},{"id":"barista-basic-l1-quiz-q3","type":"id","q":"The central point of a paragraph is called the ______ idea.","answer":"main"},{"id":"barista-basic-l1-quiz-q4","type":"mcq","q":"Which sentence is clearest for a workplace report?","options":["Done already yesterday by me the task.","The task was completed yesterday.","Task yesterday done.","Yesterday task done by me already."],"answer":"The task was completed yesterday."}]},{"id":"barista-basic-l2-quiz","programId":"barista","lessonId":"barista-basic-l2","title":"Basic Communication Skills Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-basic-l2-quiz-q1","type":"mcq","q":"Which behavior is the strongest sign of active listening?","options":["Interrupting to correct the speaker","Repeating back what you understood","Checking your phone","Changing the topic"],"answer":"Repeating back what you understood"},{"id":"barista-basic-l2-quiz-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"barista-basic-l2-quiz-q3","type":"id","q":"Restating a message in your own words to confirm understanding is called ______.","answer":"paraphrasing"},{"id":"barista-basic-l2-quiz-q4","type":"mcq","q":"Which tone is appropriate when writing to a customer?","options":["Sarcastic","Professional and courteous","Aggressive","Overly casual"],"answer":"Professional and courteous"}]},{"id":"barista-basic-l3-quiz","programId":"barista","lessonId":"barista-basic-l3","title":"Basic Digital Literacy Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-basic-l3-quiz-q1","type":"mcq","q":"Which of these is an email application?","options":["Gmail","Excel","Photoshop","VLC"],"answer":"Gmail"},{"id":"barista-basic-l3-quiz-q2","type":"tf","q":"A strong password should be shared with co-workers so they can open your files.","answer":false},{"id":"barista-basic-l3-quiz-q3","type":"id","q":"The key combination Ctrl + C is used to ______ the selected text.","answer":"copy"},{"id":"barista-basic-l3-quiz-q4","type":"mcq","q":"What should you do before opening an attachment from an unknown sender?","options":["Open it immediately","Verify the sender and scan it for malware","Forward it to all staff","Reply with your password"],"answer":"Verify the sender and scan it for malware"}]},{"id":"barista-basic-l4-quiz","programId":"barista","lessonId":"barista-basic-l4","title":"Workplace Behavior & Professionalism Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-basic-l4-quiz-q1","type":"mcq","q":"What does punctuality at work demonstrate?","options":["Reliability and respect for others","That you are overworked","That you dislike the job","Nothing important"],"answer":"Reliability and respect for others"},{"id":"barista-basic-l4-quiz-q2","type":"tf","q":"Personal social media accounts may be used to discuss confidential client information.","answer":false},{"id":"barista-basic-l4-quiz-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"barista-basic-l4-quiz-q4","type":"mcq","q":"A colleague keeps arriving late. What is the professional response?","options":["Post about it online","Raise it with the supervisor privately","Ignore your own work","Confront them in front of clients"],"answer":"Raise it with the supervisor privately"}]},{"id":"barista-common-l1-quiz","programId":"barista","lessonId":"barista-common-l1","title":"Workplace Communication Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-common-l1-quiz-q1","type":"mcq","q":"Which channel is best for reporting an urgent safety incident?","options":["A memo next week","A call or direct message to the supervisor","A suggestion box","A social media post"],"answer":"A call or direct message to the supervisor"},{"id":"barista-common-l1-quiz-q2","type":"tf","q":"Incident reports should be written as soon as possible after the event.","answer":true},{"id":"barista-common-l1-quiz-q3","type":"id","q":"The written record of what was discussed in a meeting is called the ______.","answer":"minutes"},{"id":"barista-common-l1-quiz-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"}]},{"id":"barista-common-l2-quiz","programId":"barista","lessonId":"barista-common-l2","title":"Workplace Safety & Emergency Procedures Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-common-l2-quiz-q1","type":"mcq","q":"What does OSH stand for?","options":["Occupational Safety and Health","Office Staff Handbook","Operational Service Hours","Organized Safety Help"],"answer":"Occupational Safety and Health"},{"id":"barista-common-l2-quiz-q2","type":"tf","q":"Fire exits must be kept clear of boxes and equipment at all times.","answer":true},{"id":"barista-common-l2-quiz-q3","type":"id","q":"Gear worn to protect a worker from hazards is called ______ equipment.","answer":"personal protective"},{"id":"barista-common-l2-quiz-q4","type":"mcq","q":"During an earthquake while indoors you should:","options":["Run to the elevator","Duck, cover and hold","Stand near the windows","Call clients first"],"answer":"Duck, cover and hold"}]},{"id":"barista-common-l3-quiz","programId":"barista","lessonId":"barista-common-l3","title":"Customer Service Excellence Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-common-l3-quiz-q1","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"barista-common-l3-quiz-q2","type":"tf","q":"Customer expectations are met only when the service is free of charge.","answer":false},{"id":"barista-common-l3-quiz-q3","type":"id","q":"The measure of how happy customers are with a service is customer ______.","answer":"satisfaction"},{"id":"barista-common-l3-quiz-q4","type":"mcq","q":"A customer is angry about a delayed order. What should you say first?","options":["That is not our problem.","I understand — let me check the status for you.","You should have ordered earlier.","Call again tomorrow."],"answer":"I understand — let me check the status for you."}]},{"id":"barista-common-l4-quiz","programId":"barista","lessonId":"barista-common-l4","title":"Working with Others & Time Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-common-l4-quiz-q1","type":"mcq","q":"Which practice helps a team meet deadlines?","options":["Working without a plan","Setting priorities and tracking tasks","Avoiding updates","Doing everything at the last minute"],"answer":"Setting priorities and tracking tasks"},{"id":"barista-common-l4-quiz-q2","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"barista-common-l4-quiz-q3","type":"id","q":"Arranging tasks from most to least important is called ______.","answer":"prioritizing"},{"id":"barista-common-l4-quiz-q4","type":"mcq","q":"A teammate is behind on a shared task. What is the best action?","options":["Ignore it","Offer help and inform the lead","Complain about it later","Take over without telling anyone"],"answer":"Offer help and inform the lead"}]},{"id":"barista-core-u1-l1-quiz","programId":"barista","lessonId":"barista-core-u1-l1","title":"Introduction to Coffee Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-core-u1-l1-quiz-q1","type":"mcq","q":"Which coffee species is known for higher acidity and complex flavor?","options":["Robusta","Arabica","Liberica","Excelsa"],"answer":"Arabica"},{"id":"barista-core-u1-l1-quiz-q2","type":"tf","q":"Roast level has no effect on the flavor of coffee.","answer":false},{"id":"barista-core-u1-l1-quiz-q3","type":"id","q":"The two main commercial coffee species are Arabica and ______.","answer":"robusta"},{"id":"barista-core-u1-l1-quiz-q4","type":"mcq","q":"The processing method mainly affects:","options":["The color of the cup","The flavor profile of the bean","The price of the machine","The size of the grinder"],"answer":"The flavor profile of the bean"}]},{"id":"barista-core-u1-l2-quiz","programId":"barista","lessonId":"barista-core-u1-l2","title":"Coffee Roasting & Grinding Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-core-u1-l2-quiz-q1","type":"mcq","q":"Which roast is the darkest?","options":["Light","Medium","Dark","Cinnamon"],"answer":"Dark"},{"id":"barista-core-u1-l2-quiz-q2","type":"tf","q":"A fine grind is used for espresso.","answer":true},{"id":"barista-core-u1-l2-quiz-q3","type":"id","q":"A coarse grind suits a ______ press brewer.","answer":"french"},{"id":"barista-core-u1-l2-quiz-q4","type":"mcq","q":"What happens when coffee is ground too fine for a drip brewer?","options":["It brews faster","It over-extracts and tastes bitter","Nothing changes","It becomes decaf"],"answer":"It over-extracts and tastes bitter"}]},{"id":"barista-core-u2-l1-quiz","programId":"barista","lessonId":"barista-core-u2-l1","title":"The Espresso Machine Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-core-u2-l1-quiz-q1","type":"mcq","q":"What is the standard brew pressure for espresso?","options":["3 bar","9 bar","15 bar","20 bar"],"answer":"9 bar"},{"id":"barista-core-u2-l1-quiz-q2","type":"tf","q":"The group head is backflushed as part of daily cleaning.","answer":true},{"id":"barista-core-u2-l1-quiz-q3","type":"id","q":"The part that holds the portafilter during extraction is the ______ head.","answer":"group"},{"id":"barista-core-u2-l1-quiz-q4","type":"mcq","q":"Which routine keeps a grinder performing well?","options":["Washing it with water","Brushing the burrs and removing oils regularly","Running rice through it daily","Never cleaning it"],"answer":"Brushing the burrs and removing oils regularly"}]},{"id":"barista-core-u2-l2-quiz","programId":"barista","lessonId":"barista-core-u2-l2","title":"Dialing In the Shot Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-core-u2-l2-quiz-q1","type":"mcq","q":"A shot that pours too fast and tastes sour is usually:","options":["Over-extracted","Under-extracted","Perfectly dialed","Decaffeinated"],"answer":"Under-extracted"},{"id":"barista-core-u2-l2-quiz-q2","type":"tf","q":"Adjusting the grind is the main way to change extraction time.","answer":true},{"id":"barista-core-u2-l2-quiz-q3","type":"id","q":"The amount of coffee used in the basket is called the ______.","answer":"dose"},{"id":"barista-core-u2-l2-quiz-q4","type":"mcq","q":"A bitter, slow-pouring shot suggests:","options":["The grind is too coarse","The grind is too fine","The water is too cold only","The basket is too large"],"answer":"The grind is too fine"}]},{"id":"barista-core-u3-l1-quiz","programId":"barista","lessonId":"barista-core-u3-l1","title":"Milk Texturing Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-core-u3-l1-quiz-q1","type":"mcq","q":"Microfoam is created by:","options":["Boiling the milk rapidly","Adding air, then folding it into the milk","Adding cream","Shaking the pitcher"],"answer":"Adding air, then folding it into the milk"},{"id":"barista-core-u3-l1-quiz-q2","type":"tf","q":"Milk is usually steamed to about 60-65 degrees Celsius for espresso drinks.","answer":true},{"id":"barista-core-u3-l1-quiz-q3","type":"id","q":"The glossy, velvety milk used for latte art is called ______.","answer":"microfoam"},{"id":"barista-core-u3-l1-quiz-q4","type":"mcq","q":"Which milk is hardest to texture because of its low fat content?","options":["Whole milk","Skim milk","Oat milk","Cream"],"answer":"Skim milk"}]},{"id":"barista-core-u3-l2-quiz","programId":"barista","lessonId":"barista-core-u3-l2","title":"Basic Latte Art Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-core-u3-l2-quiz-q1","type":"mcq","q":"Which pattern comes from pouring a steady stream while moving the pitcher side to side?","options":["Heart","Rosetta","Tulip","Swan"],"answer":"Rosetta"},{"id":"barista-core-u3-l2-quiz-q2","type":"tf","q":"A clean, dry pitcher improves foam quality.","answer":true},{"id":"barista-core-u3-l2-quiz-q3","type":"id","q":"Pouring art straight from the pitcher without tools is called a ______ pour.","answer":"free"},{"id":"barista-core-u3-l2-quiz-q4","type":"mcq","q":"Consistent latte art depends mostly on:","options":["Very hot milk","Controlled pitcher height and flow","A large cup","Stirring the crema"],"answer":"Controlled pitcher height and flow"}]},{"id":"barista-core-u4-l1-quiz","programId":"barista","lessonId":"barista-core-u4-l1","title":"Building the Beverage Menu Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"barista-core-u4-l1-quiz-q1","type":"mcq","q":"A traditional cappuccino is:","options":["Mostly milk","Equal parts espresso, steamed milk and foam","Espresso with no milk","Only foam"],"answer":"Equal parts espresso, steamed milk and foam"},{"id":"barista-core-u4-l1-quiz-q2","type":"tf","q":"An Americano is espresso diluted with hot water.","answer":true},{"id":"barista-core-u4-l1-quiz-q3","type":"id","q":"A latte uses more steamed ______ than foam.","answer":"milk"},{"id":"barista-core-u4-l1-quiz-q4","type":"mcq","q":"Why are standard recipes important?","options":["They slow down service","They keep taste and cost consistent","They replace training","They reduce the cup size"],"answer":"They keep taste and cost consistent"}]}],"exams":[{"id":"barista-exam-1","programId":"barista","title":"Barista NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"barista-exam-1-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"barista-exam-1-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"barista-exam-1-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"barista-exam-1-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"},{"id":"barista-exam-1-q5","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"barista-exam-1-q6","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"barista-exam-1-q7","type":"id","q":"A coarse grind suits a ______ press brewer.","answer":"french"},{"id":"barista-exam-1-q8","type":"mcq","q":"Which routine keeps a grinder performing well?","options":["Washing it with water","Brushing the burrs and removing oils regularly","Running rice through it daily","Never cleaning it"],"answer":"Brushing the burrs and removing oils regularly"},{"id":"barista-exam-1-q9","type":"mcq","q":"Microfoam is created by:","options":["Boiling the milk rapidly","Adding air, then folding it into the milk","Adding cream","Shaking the pitcher"],"answer":"Adding air, then folding it into the milk"},{"id":"barista-exam-1-q10","type":"tf","q":"A clean, dry pitcher improves foam quality.","answer":true}],"questionCount":10,"timeLimit":60,"passing":75,"date":"2026-11-25","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('hilot', 'HIL-306', 'Hilot (Wellness Massage) NC II', 'tr-003', $prog${"id":"hilot","code":"HIL-306","title":"Hilot (Wellness Massage) NC II","category":"Health & Wellness","level":"NC II","special":false,"enrollable":false,"description":"Learn traditional Filipino hilot and therapeutic massage techniques for wellness and spa establishments.","overview":"The Hilot (Wellness Massage) NC II program trains individuals in the art and science of Filipino hilot and therapeutic massage. It covers anatomy and physiology, massage techniques, full-body massage sequences, and professional client care and spa operations.","duration":"3 months","hours":150,"fee":9000,"color":"from-emerald-500 to-teal-600","image":"/courses/hilot.jpg","coverBackground":false,"requirements":["At least 18 years old","High School graduate or ALS equivalent","Physically fit (medical certificate)","Negative skin test / health clearance","Birth certificate (PSA)","2 pcs. 2x2 ID picture"],"trainerId":"tr-003","competencies":[{"id":"hilot-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"hilot-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"hilot-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"hilot-basic-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"hilot-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"hilot-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"hilot-basic-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"hilot-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"hilot-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"hilot-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"hilot-basic-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"hilot-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"hilot-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"hilot-basic-l4-quiz"}]},{"id":"hilot-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"hilot-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"hilot-common-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"hilot-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"hilot-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"hilot-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"hilot-common-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"hilot-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"hilot-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"hilot-common-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"hilot-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"hilot-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"hilot-common-l4-quiz"}]},{"id":"hilot-core","type":"Core","title":"Core Competency","description":"Core competencies of Hilot NC II: anatomy and physiology, hilot techniques, full-body massage sequence, and client care.","lessons":[],"units":[{"id":"hilot-core-u1","title":"Anatomy & Physiology Fundamentals","description":"Understand the human body systems relevant to massage therapy.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u1-l1","title":"Skeletal & Muscular System","description":"Identify major bones, muscles and joints of the human body.","duration":55,"video":"Skeletal & Muscular System","materials":[{"id":"hilot-core-u1-l1-m1","name":"Anatomy Charts.pdf","type":"pdf","url":""}],"content":"Learn the structure of the skeletal and muscular systems, muscle groups, and how they relate to massage techniques.","quizId":"hilot-core-u1-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"hilot-core-u1-l2","title":"Circulatory & Lymphatic Systems","description":"Understand circulation and lymph flow for therapeutic massage.","duration":45,"video":"Circulatory & Lymphatic Systems","materials":[{"id":"hilot-core-u1-l2-m1","name":"Circulatory System Notes.pdf","type":"pdf","url":""}],"content":"Understand how massage affects blood circulation and lymphatic drainage, and why direction of strokes matters.","quizId":"hilot-core-u1-l2-quiz"}]},{"id":"hilot-core-u2","title":"Hilot Techniques & Fundamentals","description":"Apply traditional Filipino hilot massage techniques.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u2-l1","title":"Introduction to Hilot","description":"Understand the history and philosophy of Filipino hilot.","duration":45,"video":"Introduction to Hilot","materials":[{"id":"hilot-core-u2-l1-m1","name":"Hilot History & Ethics.pdf","type":"pdf","url":""}],"content":"Explore the traditional Filipino healing art of hilot, its cultural roots, and its modern therapeutic application.","quizId":"hilot-core-u2-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"hilot-core-u2-l2","title":"Basic Massage Strokes","description":"Perform effleurage, petrissage, tapotement and friction.","duration":60,"video":"Basic Massage Strokes","materials":[{"id":"hilot-core-u2-l2-m1","name":"Massage Strokes Guide.pdf","type":"pdf","url":""}],"content":"Learn the five fundamental massage strokes, correct hand placement, pressure application, and rhythm.","quizId":"hilot-core-u2-l2-quiz"}]},{"id":"hilot-core-u3","title":"Full Body Massage Sequence","description":"Perform a complete therapeutic full-body massage.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u3-l1","title":"Back, Shoulder & Neck Massage","description":"Perform massage on the back, shoulders and neck.","duration":55,"video":"Back, Shoulder & Neck Massage","materials":[{"id":"hilot-core-u3-l1-m1","name":"Back Massage Sequence.pdf","type":"pdf","url":""}],"content":"Learn the sequence for the back, shoulders and neck including draping, pressure points and finishing strokes.","quizId":"hilot-core-u3-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"hilot-core-u3-l2","title":"Limb & Foot Massage","description":"Perform massage on arms, hands, legs and feet.","duration":50,"video":"Limb & Foot Massage","materials":[{"id":"hilot-core-u3-l2-m1","name":"Limb Massage Guide.pdf","type":"pdf","url":""}],"content":"Complete the full-body sequence with arm, hand, leg and foot massage, including reflexology basics.","quizId":"hilot-core-u3-l2-quiz"}]},{"id":"hilot-core-u4","title":"Client Care & Spa Operations","description":"Manage client consultation, hygiene and spa protocols.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u4-l1","title":"Client Consultation & Contraindications","description":"Assess client needs and identify contraindications to massage.","duration":45,"video":"Client Consultation & Contraindications","materials":[{"id":"hilot-core-u4-l1-m1","name":"Client Intake Form.pdf","type":"pdf","url":""}],"content":"Learn intake consultation, contraindications, informed consent, and adapting treatments to client needs.","quizId":"hilot-core-u4-l1-quiz"}]}]}],"quizzes":[{"id":"hilot-basic-l1-quiz","programId":"hilot","lessonId":"hilot-basic-l1","title":"Reading, Writing & Comprehension Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-basic-l1-quiz-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"hilot-basic-l1-quiz-q2","type":"tf","q":"When reading workplace instructions, it is fine to skip the steps you think are unnecessary.","answer":false},{"id":"hilot-basic-l1-quiz-q3","type":"id","q":"The central point of a paragraph is called the ______ idea.","answer":"main"},{"id":"hilot-basic-l1-quiz-q4","type":"mcq","q":"Which sentence is clearest for a workplace report?","options":["Done already yesterday by me the task.","The task was completed yesterday.","Task yesterday done.","Yesterday task done by me already."],"answer":"The task was completed yesterday."}]},{"id":"hilot-basic-l2-quiz","programId":"hilot","lessonId":"hilot-basic-l2","title":"Basic Communication Skills Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-basic-l2-quiz-q1","type":"mcq","q":"Which behavior is the strongest sign of active listening?","options":["Interrupting to correct the speaker","Repeating back what you understood","Checking your phone","Changing the topic"],"answer":"Repeating back what you understood"},{"id":"hilot-basic-l2-quiz-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"hilot-basic-l2-quiz-q3","type":"id","q":"Restating a message in your own words to confirm understanding is called ______.","answer":"paraphrasing"},{"id":"hilot-basic-l2-quiz-q4","type":"mcq","q":"Which tone is appropriate when writing to a customer?","options":["Sarcastic","Professional and courteous","Aggressive","Overly casual"],"answer":"Professional and courteous"}]},{"id":"hilot-basic-l3-quiz","programId":"hilot","lessonId":"hilot-basic-l3","title":"Basic Digital Literacy Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-basic-l3-quiz-q1","type":"mcq","q":"Which of these is an email application?","options":["Gmail","Excel","Photoshop","VLC"],"answer":"Gmail"},{"id":"hilot-basic-l3-quiz-q2","type":"tf","q":"A strong password should be shared with co-workers so they can open your files.","answer":false},{"id":"hilot-basic-l3-quiz-q3","type":"id","q":"The key combination Ctrl + C is used to ______ the selected text.","answer":"copy"},{"id":"hilot-basic-l3-quiz-q4","type":"mcq","q":"What should you do before opening an attachment from an unknown sender?","options":["Open it immediately","Verify the sender and scan it for malware","Forward it to all staff","Reply with your password"],"answer":"Verify the sender and scan it for malware"}]},{"id":"hilot-basic-l4-quiz","programId":"hilot","lessonId":"hilot-basic-l4","title":"Workplace Behavior & Professionalism Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-basic-l4-quiz-q1","type":"mcq","q":"What does punctuality at work demonstrate?","options":["Reliability and respect for others","That you are overworked","That you dislike the job","Nothing important"],"answer":"Reliability and respect for others"},{"id":"hilot-basic-l4-quiz-q2","type":"tf","q":"Personal social media accounts may be used to discuss confidential client information.","answer":false},{"id":"hilot-basic-l4-quiz-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"hilot-basic-l4-quiz-q4","type":"mcq","q":"A colleague keeps arriving late. What is the professional response?","options":["Post about it online","Raise it with the supervisor privately","Ignore your own work","Confront them in front of clients"],"answer":"Raise it with the supervisor privately"}]},{"id":"hilot-common-l1-quiz","programId":"hilot","lessonId":"hilot-common-l1","title":"Workplace Communication Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-common-l1-quiz-q1","type":"mcq","q":"Which channel is best for reporting an urgent safety incident?","options":["A memo next week","A call or direct message to the supervisor","A suggestion box","A social media post"],"answer":"A call or direct message to the supervisor"},{"id":"hilot-common-l1-quiz-q2","type":"tf","q":"Incident reports should be written as soon as possible after the event.","answer":true},{"id":"hilot-common-l1-quiz-q3","type":"id","q":"The written record of what was discussed in a meeting is called the ______.","answer":"minutes"},{"id":"hilot-common-l1-quiz-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"}]},{"id":"hilot-common-l2-quiz","programId":"hilot","lessonId":"hilot-common-l2","title":"Workplace Safety & Emergency Procedures Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-common-l2-quiz-q1","type":"mcq","q":"What does OSH stand for?","options":["Occupational Safety and Health","Office Staff Handbook","Operational Service Hours","Organized Safety Help"],"answer":"Occupational Safety and Health"},{"id":"hilot-common-l2-quiz-q2","type":"tf","q":"Fire exits must be kept clear of boxes and equipment at all times.","answer":true},{"id":"hilot-common-l2-quiz-q3","type":"id","q":"Gear worn to protect a worker from hazards is called ______ equipment.","answer":"personal protective"},{"id":"hilot-common-l2-quiz-q4","type":"mcq","q":"During an earthquake while indoors you should:","options":["Run to the elevator","Duck, cover and hold","Stand near the windows","Call clients first"],"answer":"Duck, cover and hold"}]},{"id":"hilot-common-l3-quiz","programId":"hilot","lessonId":"hilot-common-l3","title":"Customer Service Excellence Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-common-l3-quiz-q1","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"hilot-common-l3-quiz-q2","type":"tf","q":"Customer expectations are met only when the service is free of charge.","answer":false},{"id":"hilot-common-l3-quiz-q3","type":"id","q":"The measure of how happy customers are with a service is customer ______.","answer":"satisfaction"},{"id":"hilot-common-l3-quiz-q4","type":"mcq","q":"A customer is angry about a delayed order. What should you say first?","options":["That is not our problem.","I understand — let me check the status for you.","You should have ordered earlier.","Call again tomorrow."],"answer":"I understand — let me check the status for you."}]},{"id":"hilot-common-l4-quiz","programId":"hilot","lessonId":"hilot-common-l4","title":"Working with Others & Time Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-common-l4-quiz-q1","type":"mcq","q":"Which practice helps a team meet deadlines?","options":["Working without a plan","Setting priorities and tracking tasks","Avoiding updates","Doing everything at the last minute"],"answer":"Setting priorities and tracking tasks"},{"id":"hilot-common-l4-quiz-q2","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"hilot-common-l4-quiz-q3","type":"id","q":"Arranging tasks from most to least important is called ______.","answer":"prioritizing"},{"id":"hilot-common-l4-quiz-q4","type":"mcq","q":"A teammate is behind on a shared task. What is the best action?","options":["Ignore it","Offer help and inform the lead","Complain about it later","Take over without telling anyone"],"answer":"Offer help and inform the lead"}]},{"id":"hilot-core-u1-l1-quiz","programId":"hilot","lessonId":"hilot-core-u1-l1","title":"Skeletal & Muscular System Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-core-u1-l1-quiz-q1","type":"mcq","q":"Which system provides the framework and protection for the body?","options":["Skeletal","Digestive","Endocrine","Respiratory"],"answer":"Skeletal"},{"id":"hilot-core-u1-l1-quiz-q2","type":"tf","q":"Muscles work in pairs to move a joint.","answer":true},{"id":"hilot-core-u1-l1-quiz-q3","type":"id","q":"The point where two bones meet is called a ______.","answer":"joint"},{"id":"hilot-core-u1-l1-quiz-q4","type":"mcq","q":"Which muscle group is at the back of the upper arm?","options":["Biceps","Triceps","Deltoid","Pectoral"],"answer":"Triceps"}]},{"id":"hilot-core-u1-l2-quiz","programId":"hilot","lessonId":"hilot-core-u1-l2","title":"Circulatory & Lymphatic Systems Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-core-u1-l2-quiz-q1","type":"mcq","q":"Massage strokes directed toward the heart mainly support:","options":["Bone growth","Venous return and lymph flow","Hair growth","Fat digestion"],"answer":"Venous return and lymph flow"},{"id":"hilot-core-u1-l2-quiz-q2","type":"tf","q":"The lymphatic system helps remove waste and supports immunity.","answer":true},{"id":"hilot-core-u1-l2-quiz-q3","type":"id","q":"The fluid that carries oxygen through the body is ______.","answer":"blood"},{"id":"hilot-core-u1-l2-quiz-q4","type":"mcq","q":"In which direction should effleurage generally be applied?","options":["Away from the heart","Toward the heart","In circles only","In random directions"],"answer":"Toward the heart"}]},{"id":"hilot-core-u2-l1-quiz","programId":"hilot","lessonId":"hilot-core-u2-l1","title":"Introduction to Hilot Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-core-u2-l1-quiz-q1","type":"mcq","q":"Hilot is best described as:","options":["A modern gym workout","A traditional Filipino healing art","A type of surgery","A beauty treatment only"],"answer":"A traditional Filipino healing art"},{"id":"hilot-core-u2-l1-quiz-q2","type":"tf","q":"Hilot has cultural roots in Filipino communities.","answer":true},{"id":"hilot-core-u2-l1-quiz-q3","type":"id","q":"The traditional Filipino healer who practices hilot is the ______.","answer":"manghihilot"},{"id":"hilot-core-u2-l1-quiz-q4","type":"mcq","q":"Modern hilot practice mainly aims to:","options":["Replace medical care","Relieve muscle pain and stress","Perform only spiritual rituals","Sell herbal products"],"answer":"Relieve muscle pain and stress"}]},{"id":"hilot-core-u2-l2-quiz","programId":"hilot","lessonId":"hilot-core-u2-l2","title":"Basic Massage Strokes Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-core-u2-l2-quiz-q1","type":"mcq","q":"Which stroke uses light, gliding movements?","options":["Effleurage","Petrissage","Tapotement","Friction"],"answer":"Effleurage"},{"id":"hilot-core-u2-l2-quiz-q2","type":"tf","q":"Tapotement is a rhythmic percussion stroke.","answer":true},{"id":"hilot-core-u2-l2-quiz-q3","type":"id","q":"Kneading and squeezing of muscle tissue is called ______.","answer":"petrissage"},{"id":"hilot-core-u2-l2-quiz-q4","type":"mcq","q":"How should massage pressure be applied?","options":["Always at maximum","Adjusted to the client's comfort","Only with the elbows","The same for every client"],"answer":"Adjusted to the client's comfort"}]},{"id":"hilot-core-u3-l1-quiz","programId":"hilot","lessonId":"hilot-core-u3-l1","title":"Back, Shoulder & Neck Massage Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-core-u3-l1-quiz-q1","type":"mcq","q":"What must be done before starting a back massage?","options":["Apply oil to the hair","Drape the client and check comfort","Ask the client to stand","Turn up the lights"],"answer":"Drape the client and check comfort"},{"id":"hilot-core-u3-l1-quiz-q2","type":"tf","q":"Strong pressure should be applied directly to the throat during a neck massage.","answer":false},{"id":"hilot-core-u3-l1-quiz-q3","type":"id","q":"Covering the client with a sheet to protect privacy is called ______.","answer":"draping"},{"id":"hilot-core-u3-l1-quiz-q4","type":"mcq","q":"Which area commonly holds tension in office workers?","options":["Shoulders and upper back","Knees","Ankles","Elbows"],"answer":"Shoulders and upper back"}]},{"id":"hilot-core-u3-l2-quiz","programId":"hilot","lessonId":"hilot-core-u3-l2","title":"Limb & Foot Massage Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-core-u3-l2-quiz-q1","type":"mcq","q":"Reflexology focuses on:","options":["Pressure points on the feet","Bone setting","Hair treatment","Skin whitening"],"answer":"Pressure points on the feet"},{"id":"hilot-core-u3-l2-quiz-q2","type":"tf","q":"Limb massage generally follows the direction of blood flow toward the heart.","answer":true},{"id":"hilot-core-u3-l2-quiz-q3","type":"id","q":"Massaging the feet with thumb pressure on specific points is called ______.","answer":"reflexology"},{"id":"hilot-core-u3-l2-quiz-q4","type":"mcq","q":"Which precaution applies to a client with varicose veins?","options":["Deep pressure on the veins","Gentle strokes and medical clearance","Skip massage forever","Use hot stones"],"answer":"Gentle strokes and medical clearance"}]},{"id":"hilot-core-u4-l1-quiz","programId":"hilot","lessonId":"hilot-core-u4-l1","title":"Client Consultation & Contraindications Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"hilot-core-u4-l1-quiz-q1","type":"mcq","q":"Which condition is a contraindication for massage?","options":["Mild stress","Fever or an open skin infection","Muscle stiffness","Desk work"],"answer":"Fever or an open skin infection"},{"id":"hilot-core-u4-l1-quiz-q2","type":"tf","q":"Informed consent is obtained before the session begins.","answer":true},{"id":"hilot-core-u4-l1-quiz-q3","type":"id","q":"A condition in which massage must be avoided is called a ______.","answer":"contraindication"},{"id":"hilot-core-u4-l1-quiz-q4","type":"mcq","q":"The main purpose of the intake consultation is to:","options":["Sell products","Understand the client's needs and health risks","Shorten the session","Replace the therapist"],"answer":"Understand the client's needs and health risks"}]}],"exams":[{"id":"hilot-exam-1","programId":"hilot","title":"Hilot (Wellness Massage) NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"hilot-exam-1-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"hilot-exam-1-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"hilot-exam-1-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"hilot-exam-1-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"},{"id":"hilot-exam-1-q5","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"hilot-exam-1-q6","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"hilot-exam-1-q7","type":"id","q":"The fluid that carries oxygen through the body is ______.","answer":"blood"},{"id":"hilot-exam-1-q8","type":"mcq","q":"Modern hilot practice mainly aims to:","options":["Replace medical care","Relieve muscle pain and stress","Perform only spiritual rituals","Sell herbal products"],"answer":"Relieve muscle pain and stress"},{"id":"hilot-exam-1-q9","type":"mcq","q":"What must be done before starting a back massage?","options":["Apply oil to the hair","Drape the client and check comfort","Ask the client to stand","Turn up the lights"],"answer":"Drape the client and check comfort"},{"id":"hilot-exam-1-q10","type":"tf","q":"Limb massage generally follows the direction of blood flow toward the heart.","answer":true}],"questionCount":10,"timeLimit":60,"passing":75,"date":"2026-12-01","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('event-management', 'EVT-408', 'Event Management Services NC II', 'tr-004', $prog${"id":"event-management","code":"EVT-408","title":"Event Management Services NC II","category":"Tourism & Hospitality","level":"NC II","special":false,"enrollable":false,"description":"Plan, organize and execute events including budgeting, logistics, stage production and post-event evaluation.","overview":"The Event Management Services NC II program prepares trainees to plan and deliver successful events. It covers event conceptualization, budgeting, logistics and supplier coordination, event-day production, and post-event evaluation and reporting.","duration":"3 months","hours":140,"fee":8800,"color":"from-fuchsia-500 to-purple-600","image":"/courses/event-management.jpg","coverBackground":false,"requirements":["At least 18 years old","High School graduate or ALS equivalent","Good communication skills","Birth certificate (PSA)","2 pcs. 2x2 ID picture","Barangay clearance"],"trainerId":"tr-004","competencies":[{"id":"event-management-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"event-management-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"event-management-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"event-management-basic-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"event-management-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"event-management-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"event-management-basic-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"event-management-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"event-management-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"event-management-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"event-management-basic-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"event-management-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"event-management-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"event-management-basic-l4-quiz"}]},{"id":"event-management-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"event-management-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"event-management-common-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"event-management-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"event-management-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"event-management-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"event-management-common-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"event-management-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"event-management-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"event-management-common-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"event-management-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"event-management-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"event-management-common-l4-quiz"}]},{"id":"event-management-core","type":"Core","title":"Core Competency","description":"Core competencies of Event Management NC II: event planning, budgeting and logistics, event execution and production, and post-event evaluation.","lessons":[],"units":[{"id":"event-management-core-u1","title":"Event Planning Fundamentals","description":"Plan events from concept to execution.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u1-l1","title":"Introduction to Event Management","description":"Understand the event industry, types of events and roles.","duration":45,"video":"Introduction to Event Management","materials":[{"id":"event-management-core-u1-l1-m1","name":"Event Industry Overview.pdf","type":"pdf","url":""}],"content":"Learn about corporate, social, and MICE events, and the roles within an event team from planner to coordinator.","quizId":"event-management-core-u1-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"event-management-core-u1-l2","title":"Event Conceptualization & Theming","description":"Develop event concepts, themes and objectives.","duration":50,"video":"Event Conceptualization & Theming","materials":[{"id":"event-management-core-u1-l2-m1","name":"Concept Development Worksheet.pdf","type":"pdf","url":""}],"content":"Translate client goals into a cohesive event concept, including theme, mood board, and creative direction.","quizId":"event-management-core-u1-l2-quiz"}]},{"id":"event-management-core-u2","title":"Budgeting & Logistics","description":"Prepare event budgets and coordinate logistics.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u2-l1","title":"Event Budgeting","description":"Create and manage an event budget and cost sheet.","duration":50,"video":"Event Budgeting","materials":[{"id":"event-management-core-u2-l1-m1","name":"Event Budget Template.xlsx","type":"xls","url":""}],"content":"Learn to build a line-item budget, estimate costs, negotiate with suppliers, and track expenses.","quizId":"event-management-core-u2-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"event-management-core-u2-l2","title":"Venue & Supplier Coordination","description":"Select venues and coordinate with suppliers and vendors.","duration":45,"video":"Venue & Supplier Coordination","materials":[{"id":"event-management-core-u2-l2-m1","name":"Supplier Checklist.pdf","type":"pdf","url":""}],"content":"Evaluate venue capacity, layout and accessibility; coordinate catering, AV, decor and other suppliers.","quizId":"event-management-core-u2-l2-quiz"}]},{"id":"event-management-core-u3","title":"Event Execution & Production","description":"Run event day operations and stage production.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u3-l1","title":"Program Flow & Stage Management","description":"Create program flow and manage stage production.","duration":55,"video":"Program Flow & Stage Management","materials":[{"id":"event-management-core-u3-l1-m1","name":"Program Flow Template.pdf","type":"pdf","url":""}],"content":"Build a minute-by-minute program flow, manage cues, and coordinate backstage with the technical team.","quizId":"event-management-core-u3-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"event-management-core-u3-l2","title":"Event Day Operations","description":"Manage registration, ushering and on-site coordination.","duration":50,"video":"Event Day Operations","materials":[{"id":"event-management-core-u3-l2-m1","name":"Event Day Run Sheet.pdf","type":"pdf","url":""}],"content":"Handle registration, guest management, ushering, and contingency planning during the event.","quizId":"event-management-core-u3-l2-quiz"}]},{"id":"event-management-core-u4","title":"Post-Event Evaluation","description":"Evaluate events and prepare post-event reports.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u4-l1","title":"Post-Event Reporting","description":"Prepare post-event reports and client debriefs.","duration":40,"video":"Post-Event Reporting","materials":[{"id":"event-management-core-u4-l1-m1","name":"Post-Event Report Template.pdf","type":"pdf","url":""}],"content":"Compile attendance, financials and feedback into a post-event report, and conduct a client debrief.","quizId":"event-management-core-u4-l1-quiz"}]}]}],"quizzes":[{"id":"event-management-basic-l1-quiz","programId":"event-management","lessonId":"event-management-basic-l1","title":"Reading, Writing & Comprehension Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-basic-l1-quiz-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"event-management-basic-l1-quiz-q2","type":"tf","q":"When reading workplace instructions, it is fine to skip the steps you think are unnecessary.","answer":false},{"id":"event-management-basic-l1-quiz-q3","type":"id","q":"The central point of a paragraph is called the ______ idea.","answer":"main"},{"id":"event-management-basic-l1-quiz-q4","type":"mcq","q":"Which sentence is clearest for a workplace report?","options":["Done already yesterday by me the task.","The task was completed yesterday.","Task yesterday done.","Yesterday task done by me already."],"answer":"The task was completed yesterday."}]},{"id":"event-management-basic-l2-quiz","programId":"event-management","lessonId":"event-management-basic-l2","title":"Basic Communication Skills Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-basic-l2-quiz-q1","type":"mcq","q":"Which behavior is the strongest sign of active listening?","options":["Interrupting to correct the speaker","Repeating back what you understood","Checking your phone","Changing the topic"],"answer":"Repeating back what you understood"},{"id":"event-management-basic-l2-quiz-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"event-management-basic-l2-quiz-q3","type":"id","q":"Restating a message in your own words to confirm understanding is called ______.","answer":"paraphrasing"},{"id":"event-management-basic-l2-quiz-q4","type":"mcq","q":"Which tone is appropriate when writing to a customer?","options":["Sarcastic","Professional and courteous","Aggressive","Overly casual"],"answer":"Professional and courteous"}]},{"id":"event-management-basic-l3-quiz","programId":"event-management","lessonId":"event-management-basic-l3","title":"Basic Digital Literacy Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-basic-l3-quiz-q1","type":"mcq","q":"Which of these is an email application?","options":["Gmail","Excel","Photoshop","VLC"],"answer":"Gmail"},{"id":"event-management-basic-l3-quiz-q2","type":"tf","q":"A strong password should be shared with co-workers so they can open your files.","answer":false},{"id":"event-management-basic-l3-quiz-q3","type":"id","q":"The key combination Ctrl + C is used to ______ the selected text.","answer":"copy"},{"id":"event-management-basic-l3-quiz-q4","type":"mcq","q":"What should you do before opening an attachment from an unknown sender?","options":["Open it immediately","Verify the sender and scan it for malware","Forward it to all staff","Reply with your password"],"answer":"Verify the sender and scan it for malware"}]},{"id":"event-management-basic-l4-quiz","programId":"event-management","lessonId":"event-management-basic-l4","title":"Workplace Behavior & Professionalism Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-basic-l4-quiz-q1","type":"mcq","q":"What does punctuality at work demonstrate?","options":["Reliability and respect for others","That you are overworked","That you dislike the job","Nothing important"],"answer":"Reliability and respect for others"},{"id":"event-management-basic-l4-quiz-q2","type":"tf","q":"Personal social media accounts may be used to discuss confidential client information.","answer":false},{"id":"event-management-basic-l4-quiz-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"event-management-basic-l4-quiz-q4","type":"mcq","q":"A colleague keeps arriving late. What is the professional response?","options":["Post about it online","Raise it with the supervisor privately","Ignore your own work","Confront them in front of clients"],"answer":"Raise it with the supervisor privately"}]},{"id":"event-management-common-l1-quiz","programId":"event-management","lessonId":"event-management-common-l1","title":"Workplace Communication Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-common-l1-quiz-q1","type":"mcq","q":"Which channel is best for reporting an urgent safety incident?","options":["A memo next week","A call or direct message to the supervisor","A suggestion box","A social media post"],"answer":"A call or direct message to the supervisor"},{"id":"event-management-common-l1-quiz-q2","type":"tf","q":"Incident reports should be written as soon as possible after the event.","answer":true},{"id":"event-management-common-l1-quiz-q3","type":"id","q":"The written record of what was discussed in a meeting is called the ______.","answer":"minutes"},{"id":"event-management-common-l1-quiz-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"}]},{"id":"event-management-common-l2-quiz","programId":"event-management","lessonId":"event-management-common-l2","title":"Workplace Safety & Emergency Procedures Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-common-l2-quiz-q1","type":"mcq","q":"What does OSH stand for?","options":["Occupational Safety and Health","Office Staff Handbook","Operational Service Hours","Organized Safety Help"],"answer":"Occupational Safety and Health"},{"id":"event-management-common-l2-quiz-q2","type":"tf","q":"Fire exits must be kept clear of boxes and equipment at all times.","answer":true},{"id":"event-management-common-l2-quiz-q3","type":"id","q":"Gear worn to protect a worker from hazards is called ______ equipment.","answer":"personal protective"},{"id":"event-management-common-l2-quiz-q4","type":"mcq","q":"During an earthquake while indoors you should:","options":["Run to the elevator","Duck, cover and hold","Stand near the windows","Call clients first"],"answer":"Duck, cover and hold"}]},{"id":"event-management-common-l3-quiz","programId":"event-management","lessonId":"event-management-common-l3","title":"Customer Service Excellence Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-common-l3-quiz-q1","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"event-management-common-l3-quiz-q2","type":"tf","q":"Customer expectations are met only when the service is free of charge.","answer":false},{"id":"event-management-common-l3-quiz-q3","type":"id","q":"The measure of how happy customers are with a service is customer ______.","answer":"satisfaction"},{"id":"event-management-common-l3-quiz-q4","type":"mcq","q":"A customer is angry about a delayed order. What should you say first?","options":["That is not our problem.","I understand — let me check the status for you.","You should have ordered earlier.","Call again tomorrow."],"answer":"I understand — let me check the status for you."}]},{"id":"event-management-common-l4-quiz","programId":"event-management","lessonId":"event-management-common-l4","title":"Working with Others & Time Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-common-l4-quiz-q1","type":"mcq","q":"Which practice helps a team meet deadlines?","options":["Working without a plan","Setting priorities and tracking tasks","Avoiding updates","Doing everything at the last minute"],"answer":"Setting priorities and tracking tasks"},{"id":"event-management-common-l4-quiz-q2","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"event-management-common-l4-quiz-q3","type":"id","q":"Arranging tasks from most to least important is called ______.","answer":"prioritizing"},{"id":"event-management-common-l4-quiz-q4","type":"mcq","q":"A teammate is behind on a shared task. What is the best action?","options":["Ignore it","Offer help and inform the lead","Complain about it later","Take over without telling anyone"],"answer":"Offer help and inform the lead"}]},{"id":"event-management-core-u1-l1-quiz","programId":"event-management","lessonId":"event-management-core-u1-l1","title":"Introduction to Event Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-core-u1-l1-quiz-q1","type":"mcq","q":"MICE stands for:","options":["Meetings, Incentives, Conferences, Exhibitions","Music, Ideas, Catering, Events","Meetings, Invitations, Costs, Exhibits","Management, Industry, Culture, Events"],"answer":"Meetings, Incentives, Conferences, Exhibitions"},{"id":"event-management-core-u1-l1-quiz-q2","type":"tf","q":"A wedding is an example of a social event.","answer":true},{"id":"event-management-core-u1-l1-quiz-q3","type":"id","q":"The person responsible for the overall planning of an event is the event ______.","answer":"planner"},{"id":"event-management-core-u1-l1-quiz-q4","type":"mcq","q":"Which role coordinates suppliers on the event day?","options":["Event coordinator","Guest","Photographer","Sponsor"],"answer":"Event coordinator"}]},{"id":"event-management-core-u1-l2-quiz","programId":"event-management","lessonId":"event-management-core-u1-l2","title":"Event Conceptualization & Theming Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-core-u1-l2-quiz-q1","type":"mcq","q":"A mood board is used to:","options":["Track the budget","Communicate the visual direction","List suppliers","Record attendance"],"answer":"Communicate the visual direction"},{"id":"event-management-core-u1-l2-quiz-q2","type":"tf","q":"The event concept should reflect the client's objectives and audience.","answer":true},{"id":"event-management-core-u1-l2-quiz-q3","type":"id","q":"The overall visual and emotional direction of an event is its ______.","answer":"theme"},{"id":"event-management-core-u1-l2-quiz-q4","type":"mcq","q":"What should guide the concept of a corporate launch?","options":["The planner's personal taste","The client's brand and goals","The cheapest supplier","The venue's wallpaper"],"answer":"The client's brand and goals"}]},{"id":"event-management-core-u2-l1-quiz","programId":"event-management","lessonId":"event-management-core-u2-l1","title":"Event Budgeting Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-core-u2-l1-quiz-q1","type":"mcq","q":"Which is a fixed cost in an event budget?","options":["Venue rental","Extra chairs rented on the day","Overtime crew","Emergency repairs"],"answer":"Venue rental"},{"id":"event-management-core-u2-l1-quiz-q2","type":"tf","q":"A budget includes a contingency line for unexpected costs.","answer":true},{"id":"event-management-core-u2-l1-quiz-q3","type":"id","q":"The amount set aside for unexpected expenses is the ______.","answer":"contingency"},{"id":"event-management-core-u2-l1-quiz-q4","type":"mcq","q":"Why should expenses be tracked during the event?","options":["To avoid overspending","To delay payments","To raise supplier rates","To reduce attendance"],"answer":"To avoid overspending"}]},{"id":"event-management-core-u2-l2-quiz","programId":"event-management","lessonId":"event-management-core-u2-l2","title":"Venue & Supplier Coordination Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-core-u2-l2-quiz-q1","type":"mcq","q":"Which factor matters most when choosing a venue?","options":["Capacity and accessibility for guests","The color of the walls","Distance from the planner's home","Free parking for staff only"],"answer":"Capacity and accessibility for guests"},{"id":"event-management-core-u2-l2-quiz-q2","type":"tf","q":"Supplier contracts should state deliverables, deadlines and payment terms.","answer":true},{"id":"event-management-core-u2-l2-quiz-q3","type":"id","q":"The document that binds a supplier to deliver services is a ______.","answer":"contract"},{"id":"event-management-core-u2-l2-quiz-q4","type":"mcq","q":"Why is a site visit done?","options":["To confirm layout and logistics","To sign the guest list","To choose the menu only","To pay the deposit only"],"answer":"To confirm layout and logistics"}]},{"id":"event-management-core-u3-l1-quiz","programId":"event-management","lessonId":"event-management-core-u3-l1","title":"Program Flow & Stage Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-core-u3-l1-quiz-q1","type":"mcq","q":"A program flow is:","options":["A minute-by-minute schedule of activities","A list of guests","The venue map","The budget summary"],"answer":"A minute-by-minute schedule of activities"},{"id":"event-management-core-u3-l1-quiz-q2","type":"tf","q":"Cues are coordinated with the technical team before the event.","answer":true},{"id":"event-management-core-u3-l1-quiz-q3","type":"id","q":"The person who signals lights and sound cues is the stage ______.","answer":"manager"},{"id":"event-management-core-u3-l1-quiz-q4","type":"mcq","q":"Why are time buffers built into a program flow?","options":["To fill empty time","To absorb delays","To lengthen the event","To reduce costs"],"answer":"To absorb delays"}]},{"id":"event-management-core-u3-l2-quiz","programId":"event-management","lessonId":"event-management-core-u3-l2","title":"Event Day Operations Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-core-u3-l2-quiz-q1","type":"mcq","q":"Registration desks should be:","options":["Hidden from guests","Clearly signposted and staffed","Closed until noon","Manned by suppliers only"],"answer":"Clearly signposted and staffed"},{"id":"event-management-core-u3-l2-quiz-q2","type":"tf","q":"A contingency plan should cover bad weather and supplier no-shows.","answer":true},{"id":"event-management-core-u3-l2-quiz-q3","type":"id","q":"Directing guests to their seats is called ______.","answer":"ushering"},{"id":"event-management-core-u3-l2-quiz-q4","type":"mcq","q":"What is the first action when a supplier fails to arrive?","options":["Cancel the event","Activate the contingency plan and inform the client","Argue with the supplier","Leave the venue"],"answer":"Activate the contingency plan and inform the client"}]},{"id":"event-management-core-u4-l1-quiz","programId":"event-management","lessonId":"event-management-core-u4-l1","title":"Post-Event Reporting Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"event-management-core-u4-l1-quiz-q1","type":"mcq","q":"A post-event report usually contains:","options":["Attendance, financials and feedback","Photos only","The guest list only","Supplier contacts only"],"answer":"Attendance, financials and feedback"},{"id":"event-management-core-u4-l1-quiz-q2","type":"tf","q":"A client debrief helps identify improvements for future events.","answer":true},{"id":"event-management-core-u4-l1-quiz-q3","type":"id","q":"Gathering client comments after an event is called collecting ______.","answer":"feedback"},{"id":"event-management-core-u4-l1-quiz-q4","type":"mcq","q":"When should the post-event report be delivered?","options":["Within an agreed short period after the event","Six months later","Before the event","Only if the client asks"],"answer":"Within an agreed short period after the event"}]}],"exams":[{"id":"event-management-exam-1","programId":"event-management","title":"Event Management Services NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"event-management-exam-1-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"event-management-exam-1-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"event-management-exam-1-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"event-management-exam-1-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"},{"id":"event-management-exam-1-q5","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"event-management-exam-1-q6","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"event-management-exam-1-q7","type":"id","q":"The overall visual and emotional direction of an event is its ______.","answer":"theme"},{"id":"event-management-exam-1-q8","type":"mcq","q":"Why should expenses be tracked during the event?","options":["To avoid overspending","To delay payments","To raise supplier rates","To reduce attendance"],"answer":"To avoid overspending"},{"id":"event-management-exam-1-q9","type":"mcq","q":"A program flow is:","options":["A minute-by-minute schedule of activities","A list of guests","The venue map","The budget summary"],"answer":"A minute-by-minute schedule of activities"},{"id":"event-management-exam-1-q10","type":"tf","q":"A contingency plan should cover bad weather and supplier no-shows.","answer":true}],"questionCount":10,"timeLimit":60,"passing":75,"date":"2026-12-05","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('virtual-assistant', 'VA-510', 'Virtual Assistant NC II', 'tr-005', $prog${"id":"virtual-assistant","code":"VA-510","title":"Virtual Assistant NC II","category":"Information Technology","level":"NC II","special":false,"enrollable":false,"description":"Become a professional virtual assistant: admin support, communication, social media management and tool proficiency.","overview":"The Virtual Assistant NC II program prepares trainees for remote work as a VA. It covers the VA profession, remote work setup, administrative support, client communication, customer support, social media management, and tool proficiency — including a proctored typing test evaluation.","duration":"8 Weeks","hours":100,"fee":5000,"color":"from-indigo-500 to-violet-600","image":"/courses/virtual-assistant.jpg","coverBackground":false,"requirements":["At least 18 years old","High School graduate or ALS equivalent","Own laptop/computer with webcam","Stable internet connection (min. 5 Mbps)","Birth certificate (PSA)","2 pcs. 2x2 ID picture"],"trainerId":"tr-005","competencies":[{"id":"virtual-assistant-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"virtual-assistant-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"virtual-assistant-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"virtual-assistant-basic-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"virtual-assistant-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"virtual-assistant-basic-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"virtual-assistant-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"virtual-assistant-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"virtual-assistant-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"virtual-assistant-basic-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"virtual-assistant-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"virtual-assistant-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"virtual-assistant-basic-l4-quiz"}]},{"id":"virtual-assistant-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"virtual-assistant-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"virtual-assistant-common-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"virtual-assistant-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"virtual-assistant-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"virtual-assistant-common-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"virtual-assistant-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"virtual-assistant-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"virtual-assistant-common-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"virtual-assistant-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"virtual-assistant-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"virtual-assistant-common-l4-quiz"}]},{"id":"virtual-assistant-core","type":"Core","title":"Core Competency","description":"Core competencies of the Virtual Assistant program: VA fundamentals, administrative support, communication and customer support, and social media & tool proficiency.","lessons":[],"units":[{"id":"virtual-assistant-core-u1","title":"Introduction to Virtual Assistance","description":"Understand the VA industry, roles and remote work fundamentals.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u1-l1","title":"The Virtual Assistant Profession","description":"Understand what a VA does, niches, and client relationships.","duration":45,"video":"The Virtual Assistant Profession","materials":[{"id":"virtual-assistant-core-u1-l1-m1","name":"VA Career Guide.pdf","type":"pdf","url":""}],"content":"Learn about the different VA niches (admin, social media, e-commerce, real estate), rates, and building client relationships.","quizId":"virtual-assistant-core-u1-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u1-l2","title":"Remote Work Setup & Productivity","description":"Set up a home office and manage remote productivity.","duration":40,"video":"Remote Work Setup & Productivity","materials":[{"id":"virtual-assistant-core-u1-l2-m1","name":"Remote Setup Checklist.pdf","type":"pdf","url":""}],"content":"Configure your workstation, internet, backup power, and time-zone management for reliable remote work.","quizId":"virtual-assistant-core-u1-l2-quiz"}]},{"id":"virtual-assistant-core-u2","title":"Administrative Support","description":"Provide email, calendar and document management support.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u2-l1","title":"Email & Calendar Management","description":"Manage inboxes, filters and shared calendars.","duration":50,"video":"Email & Calendar Management","materials":[{"id":"virtual-assistant-core-u2-l1-m1","name":"Email Management Guide.pdf","type":"pdf","url":""}],"content":"Learn inbox zero techniques, labeling, canned responses, scheduling, and calendar coordination.","quizId":"virtual-assistant-core-u2-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u2-l2","title":"Document & Data Management","description":"Create documents, spreadsheets and manage cloud files.","duration":50,"video":"Document & Data Management","materials":[{"id":"virtual-assistant-core-u2-l2-m1","name":"Document Templates.zip","type":"zip","url":""}],"content":"Work with Google Workspace and Microsoft 365 to create documents, spreadsheets, and organized cloud folders.","quizId":"virtual-assistant-core-u2-l2-quiz"}]},{"id":"virtual-assistant-core-u3","title":"Communication & Customer Support","description":"Handle client communication and customer support tasks.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u3-l1","title":"Professional Client Communication","description":"Communicate professionally via email, chat and video.","duration":45,"video":"Professional Client Communication","materials":[{"id":"virtual-assistant-core-u3-l1-m1","name":"Client Email Templates.pdf","type":"pdf","url":""}],"content":"Draft professional emails, run meetings, and manage client communication tools like Slack and Zoom.","quizId":"virtual-assistant-core-u3-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u3-l2","title":"Customer Support Basics","description":"Provide helpdesk and customer support using ticketing tools.","duration":50,"video":"Customer Support Basics","materials":[{"id":"virtual-assistant-core-u3-l2-m1","name":"Support Playbook.pdf","type":"pdf","url":""}],"content":"Learn ticketing systems, response templates, escalation, and measuring customer satisfaction.","quizId":"virtual-assistant-core-u3-l2-quiz"}]},{"id":"virtual-assistant-core-u4","title":"Social Media & Tool Proficiency","description":"Manage social media and master common VA tools.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u4-l1","title":"Social Media Management","description":"Schedule and manage content across social platforms.","duration":50,"video":"Social Media Management","materials":[{"id":"virtual-assistant-core-u4-l1-m1","name":"Content Calendar.xlsx","type":"xls","url":""}],"content":"Use scheduling tools, content calendars and analytics to manage social media accounts.","quizId":"virtual-assistant-core-u4-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u4-l2","title":"Typing Proficiency & Data Entry","description":"Develop fast and accurate typing for data entry tasks.","duration":40,"video":"Typing Proficiency & Data Entry","materials":[{"id":"virtual-assistant-core-u4-l2-m1","name":"Typing Practice Guide.pdf","type":"pdf","url":""}],"content":"Practice touch typing, accuracy drills, and efficient data entry. Complete the timed typing assessment.","quizId":"virtual-assistant-core-u4-l2-quiz"}]}]}],"quizzes":[{"id":"virtual-assistant-basic-l1-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-basic-l1","title":"Reading, Writing & Comprehension Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-basic-l1-quiz-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"virtual-assistant-basic-l1-quiz-q2","type":"tf","q":"When reading workplace instructions, it is fine to skip the steps you think are unnecessary.","answer":false},{"id":"virtual-assistant-basic-l1-quiz-q3","type":"id","q":"The central point of a paragraph is called the ______ idea.","answer":"main"},{"id":"virtual-assistant-basic-l1-quiz-q4","type":"mcq","q":"Which sentence is clearest for a workplace report?","options":["Done already yesterday by me the task.","The task was completed yesterday.","Task yesterday done.","Yesterday task done by me already."],"answer":"The task was completed yesterday."}]},{"id":"virtual-assistant-basic-l2-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-basic-l2","title":"Basic Communication Skills Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-basic-l2-quiz-q1","type":"mcq","q":"Which behavior is the strongest sign of active listening?","options":["Interrupting to correct the speaker","Repeating back what you understood","Checking your phone","Changing the topic"],"answer":"Repeating back what you understood"},{"id":"virtual-assistant-basic-l2-quiz-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"virtual-assistant-basic-l2-quiz-q3","type":"id","q":"Restating a message in your own words to confirm understanding is called ______.","answer":"paraphrasing"},{"id":"virtual-assistant-basic-l2-quiz-q4","type":"mcq","q":"Which tone is appropriate when writing to a customer?","options":["Sarcastic","Professional and courteous","Aggressive","Overly casual"],"answer":"Professional and courteous"}]},{"id":"virtual-assistant-basic-l3-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-basic-l3","title":"Basic Digital Literacy Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-basic-l3-quiz-q1","type":"mcq","q":"Which of these is an email application?","options":["Gmail","Excel","Photoshop","VLC"],"answer":"Gmail"},{"id":"virtual-assistant-basic-l3-quiz-q2","type":"tf","q":"A strong password should be shared with co-workers so they can open your files.","answer":false},{"id":"virtual-assistant-basic-l3-quiz-q3","type":"id","q":"The key combination Ctrl + C is used to ______ the selected text.","answer":"copy"},{"id":"virtual-assistant-basic-l3-quiz-q4","type":"mcq","q":"What should you do before opening an attachment from an unknown sender?","options":["Open it immediately","Verify the sender and scan it for malware","Forward it to all staff","Reply with your password"],"answer":"Verify the sender and scan it for malware"}]},{"id":"virtual-assistant-basic-l4-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-basic-l4","title":"Workplace Behavior & Professionalism Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-basic-l4-quiz-q1","type":"mcq","q":"What does punctuality at work demonstrate?","options":["Reliability and respect for others","That you are overworked","That you dislike the job","Nothing important"],"answer":"Reliability and respect for others"},{"id":"virtual-assistant-basic-l4-quiz-q2","type":"tf","q":"Personal social media accounts may be used to discuss confidential client information.","answer":false},{"id":"virtual-assistant-basic-l4-quiz-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"virtual-assistant-basic-l4-quiz-q4","type":"mcq","q":"A colleague keeps arriving late. What is the professional response?","options":["Post about it online","Raise it with the supervisor privately","Ignore your own work","Confront them in front of clients"],"answer":"Raise it with the supervisor privately"}]},{"id":"virtual-assistant-common-l1-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-common-l1","title":"Workplace Communication Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-common-l1-quiz-q1","type":"mcq","q":"Which channel is best for reporting an urgent safety incident?","options":["A memo next week","A call or direct message to the supervisor","A suggestion box","A social media post"],"answer":"A call or direct message to the supervisor"},{"id":"virtual-assistant-common-l1-quiz-q2","type":"tf","q":"Incident reports should be written as soon as possible after the event.","answer":true},{"id":"virtual-assistant-common-l1-quiz-q3","type":"id","q":"The written record of what was discussed in a meeting is called the ______.","answer":"minutes"},{"id":"virtual-assistant-common-l1-quiz-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"}]},{"id":"virtual-assistant-common-l2-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-common-l2","title":"Workplace Safety & Emergency Procedures Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-common-l2-quiz-q1","type":"mcq","q":"What does OSH stand for?","options":["Occupational Safety and Health","Office Staff Handbook","Operational Service Hours","Organized Safety Help"],"answer":"Occupational Safety and Health"},{"id":"virtual-assistant-common-l2-quiz-q2","type":"tf","q":"Fire exits must be kept clear of boxes and equipment at all times.","answer":true},{"id":"virtual-assistant-common-l2-quiz-q3","type":"id","q":"Gear worn to protect a worker from hazards is called ______ equipment.","answer":"personal protective"},{"id":"virtual-assistant-common-l2-quiz-q4","type":"mcq","q":"During an earthquake while indoors you should:","options":["Run to the elevator","Duck, cover and hold","Stand near the windows","Call clients first"],"answer":"Duck, cover and hold"}]},{"id":"virtual-assistant-common-l3-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-common-l3","title":"Customer Service Excellence Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-common-l3-quiz-q1","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"virtual-assistant-common-l3-quiz-q2","type":"tf","q":"Customer expectations are met only when the service is free of charge.","answer":false},{"id":"virtual-assistant-common-l3-quiz-q3","type":"id","q":"The measure of how happy customers are with a service is customer ______.","answer":"satisfaction"},{"id":"virtual-assistant-common-l3-quiz-q4","type":"mcq","q":"A customer is angry about a delayed order. What should you say first?","options":["That is not our problem.","I understand — let me check the status for you.","You should have ordered earlier.","Call again tomorrow."],"answer":"I understand — let me check the status for you."}]},{"id":"virtual-assistant-common-l4-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-common-l4","title":"Working with Others & Time Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-common-l4-quiz-q1","type":"mcq","q":"Which practice helps a team meet deadlines?","options":["Working without a plan","Setting priorities and tracking tasks","Avoiding updates","Doing everything at the last minute"],"answer":"Setting priorities and tracking tasks"},{"id":"virtual-assistant-common-l4-quiz-q2","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"virtual-assistant-common-l4-quiz-q3","type":"id","q":"Arranging tasks from most to least important is called ______.","answer":"prioritizing"},{"id":"virtual-assistant-common-l4-quiz-q4","type":"mcq","q":"A teammate is behind on a shared task. What is the best action?","options":["Ignore it","Offer help and inform the lead","Complain about it later","Take over without telling anyone"],"answer":"Offer help and inform the lead"}]},{"id":"virtual-assistant-core-u1-l1-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u1-l1","title":"The Virtual Assistant Profession Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u1-l1-quiz-q1","type":"mcq","q":"A VA niche is:","options":["A specialized service area such as admin or social media","A type of laptop","A time zone","A payment method"],"answer":"A specialized service area such as admin or social media"},{"id":"virtual-assistant-core-u1-l1-quiz-q2","type":"tf","q":"Virtual assistants usually work remotely for clients in different locations.","answer":true},{"id":"virtual-assistant-core-u1-l1-quiz-q3","type":"id","q":"A self-employed professional serving several clients is a ______.","answer":"freelancer"},{"id":"virtual-assistant-core-u1-l1-quiz-q4","type":"mcq","q":"Which builds long-term client relationships?","options":["Missing deadlines","Clear communication and reliability","Overpromising","Ignoring feedback"],"answer":"Clear communication and reliability"}]},{"id":"virtual-assistant-core-u1-l2-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u1-l2","title":"Remote Work Setup & Productivity Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u1-l2-quiz-q1","type":"mcq","q":"Why is a backup power source important for remote work?","options":["To decorate the desk","To avoid downtime during outages","To increase internet speed","To store files"],"answer":"To avoid downtime during outages"},{"id":"virtual-assistant-core-u1-l2-quiz-q2","type":"tf","q":"Time-zone differences should be considered when scheduling client meetings.","answer":true},{"id":"virtual-assistant-core-u1-l2-quiz-q3","type":"id","q":"A dedicated space for working at home is a home ______.","answer":"office"},{"id":"virtual-assistant-core-u1-l2-quiz-q4","type":"mcq","q":"Which habit improves remote productivity?","options":["Working twelve hours without breaks","Planning the day and blocking focus time","Keeping notifications on all night","Skipping task lists"],"answer":"Planning the day and blocking focus time"}]},{"id":"virtual-assistant-core-u2-l1-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u2-l1","title":"Email & Calendar Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u2-l1-quiz-q1","type":"mcq","q":"Inbox zero means:","options":["Deleting all email","Every message is processed or filed","Never checking email","Reading email once a week"],"answer":"Every message is processed or filed"},{"id":"virtual-assistant-core-u2-l1-quiz-q2","type":"tf","q":"Canned responses help answer recurring emails consistently.","answer":true},{"id":"virtual-assistant-core-u2-l1-quiz-q3","type":"id","q":"Automatically sorting incoming messages into folders uses email ______.","answer":"filters"},{"id":"virtual-assistant-core-u2-l1-quiz-q4","type":"mcq","q":"What should you check before scheduling a meeting?","options":["The client's availability and time zone","The largest free slot","Nothing at all","Only your own calendar"],"answer":"The client's availability and time zone"}]},{"id":"virtual-assistant-core-u2-l2-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u2-l2","title":"Document & Data Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u2-l2-quiz-q1","type":"mcq","q":"Which tool is best for creating a budget spreadsheet?","options":["Google Sheets","Google Docs","Canva","Slack"],"answer":"Google Sheets"},{"id":"virtual-assistant-core-u2-l2-quiz-q2","type":"tf","q":"Cloud folders should follow a consistent naming convention.","answer":true},{"id":"virtual-assistant-core-u2-l2-quiz-q3","type":"id","q":"Saving files online so they are reachable anywhere is called ______ storage.","answer":"cloud"},{"id":"virtual-assistant-core-u2-l2-quiz-q4","type":"mcq","q":"Why should access permissions be set on shared folders?","options":["To protect confidential files","To slow downloads","To use more storage","To change file colors"],"answer":"To protect confidential files"}]},{"id":"virtual-assistant-core-u3-l1-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u3-l1","title":"Professional Client Communication Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u3-l1-quiz-q1","type":"mcq","q":"Which subject line is most professional?","options":["hey","Meeting request: Project Kickoff - Oct 24","URGENT!!!","(no subject)"],"answer":"Meeting request: Project Kickoff - Oct 24"},{"id":"virtual-assistant-core-u3-l1-quiz-q2","type":"tf","q":"A video call should start by checking audio and camera settings.","answer":true},{"id":"virtual-assistant-core-u3-l1-quiz-q3","type":"id","q":"Written workplace messages should keep a professional ______.","answer":"tone"},{"id":"virtual-assistant-core-u3-l1-quiz-q4","type":"mcq","q":"A client asks for a change you cannot deliver today. What is the best reply?","options":["Ignore the message","Acknowledge it and give a realistic timeline","Say yes and delay silently","Blame the team"],"answer":"Acknowledge it and give a realistic timeline"}]},{"id":"virtual-assistant-core-u3-l2-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u3-l2","title":"Customer Support Basics Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u3-l2-quiz-q1","type":"mcq","q":"A ticketing system is used to:","options":["Track and resolve customer requests","Send marketing email","Design logos","Host video calls"],"answer":"Track and resolve customer requests"},{"id":"virtual-assistant-core-u3-l2-quiz-q2","type":"tf","q":"Issues that cannot be resolved should be escalated with complete details.","answer":true},{"id":"virtual-assistant-core-u3-l2-quiz-q3","type":"id","q":"The measure of how happy customers are is customer ______.","answer":"satisfaction"},{"id":"virtual-assistant-core-u3-l2-quiz-q4","type":"mcq","q":"What makes a support reply effective?","options":["Long paragraphs of jargon","Clear, empathetic and specific answers","Copy-paste without reading","Delaying until the customer gives up"],"answer":"Clear, empathetic and specific answers"}]},{"id":"virtual-assistant-core-u4-l1-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u4-l1","title":"Social Media Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u4-l1-quiz-q1","type":"mcq","q":"A content calendar helps to:","options":["Plan and schedule posts in advance","Increase internet speed","Store passwords","Replace analytics"],"answer":"Plan and schedule posts in advance"},{"id":"virtual-assistant-core-u4-l1-quiz-q2","type":"tf","q":"Analytics show which posts perform best.","answer":true},{"id":"virtual-assistant-core-u4-l1-quiz-q3","type":"id","q":"Tools that publish posts at set times are called ______ tools.","answer":"scheduling"},{"id":"virtual-assistant-core-u4-l1-quiz-q4","type":"mcq","q":"Before posting on a client account you should:","options":["Follow the approved content plan","Post whatever you like","Share the password publicly","Ignore brand guidelines"],"answer":"Follow the approved content plan"}]},{"id":"virtual-assistant-core-u4-l2-quiz","programId":"virtual-assistant","lessonId":"virtual-assistant-core-u4-l2","title":"Typing Proficiency & Data Entry Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"virtual-assistant-core-u4-l2-quiz-q1","type":"mcq","q":"Touch typing means typing:","options":["With two fingers","Without looking at the keyboard","With the right hand only","Using voice input"],"answer":"Without looking at the keyboard"},{"id":"virtual-assistant-core-u4-l2-quiz-q2","type":"tf","q":"Accuracy matters more than speed when entering client data.","answer":true},{"id":"virtual-assistant-core-u4-l2-quiz-q3","type":"id","q":"Typing speed is measured in words per ______.","answer":"minute"},{"id":"virtual-assistant-core-u4-l2-quiz-q4","type":"mcq","q":"Which practice reduces data entry errors?","options":["Double-checking entries against the source","Typing as fast as possible","Skipping verification","Copy-pasting everything"],"answer":"Double-checking entries against the source"}]}],"exams":[{"id":"virtual-assistant-exam-1","programId":"virtual-assistant","title":"Virtual Assistant NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"virtual-assistant-exam-1-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"virtual-assistant-exam-1-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"virtual-assistant-exam-1-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"virtual-assistant-exam-1-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"},{"id":"virtual-assistant-exam-1-q5","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"virtual-assistant-exam-1-q6","type":"tf","q":"Virtual assistants usually work remotely for clients in different locations.","answer":true},{"id":"virtual-assistant-exam-1-q7","type":"id","q":"A dedicated space for working at home is a home ______.","answer":"office"},{"id":"virtual-assistant-exam-1-q8","type":"mcq","q":"Why should access permissions be set on shared folders?","options":["To protect confidential files","To slow downloads","To use more storage","To change file colors"],"answer":"To protect confidential files"},{"id":"virtual-assistant-exam-1-q9","type":"mcq","q":"Which subject line is most professional?","options":["hey","Meeting request: Project Kickoff - Oct 24","URGENT!!!","(no subject)"],"answer":"Meeting request: Project Kickoff - Oct 24"},{"id":"virtual-assistant-exam-1-q10","type":"tf","q":"Analytics show which posts perform best.","answer":true}],"questionCount":10,"timeLimit":60,"passing":75,"date":"2026-11-30","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('bookkeeping', 'BK-612', 'Bookkeeping NC III', null, $prog${"id":"bookkeeping","code":"BK-612","title":"Bookkeeping NC III","category":"Business & Finance","level":"NC III","special":false,"enrollable":false,"description":"Record business transactions, maintain ledgers, prepare trial balances and produce financial statements for small and medium enterprises.","overview":"The Bookkeeping NC III program prepares trainees to keep complete and accurate books of accounts. It covers accounting fundamentals, journalizing and posting, the trial balance and adjusting entries, and the preparation of financial statements, bank reconciliation and payroll records for a business enterprise.","duration":"3 months","hours":180,"fee":9000,"color":"from-slate-700 to-slate-900","image":"/courses/bookkeeping.jpg","coverBackground":true,"requirements":["At least 18 years old","High School graduate or ALS equivalent","Basic numeracy and computer skills","Birth certificate (PSA)","2 pcs. 2x2 ID picture","Barangay clearance"],"trainerId":null,"competencies":[{"id":"bookkeeping-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"bookkeeping-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"bookkeeping-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"bookkeeping-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"bookkeeping-basic-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"bookkeeping-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"bookkeeping-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"bookkeeping-basic-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"bookkeeping-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"bookkeeping-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"bookkeeping-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"bookkeeping-basic-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"bookkeeping-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"bookkeeping-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"bookkeeping-basic-l4-quiz"}]},{"id":"bookkeeping-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"bookkeeping-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"bookkeeping-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"bookkeeping-common-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"bookkeeping-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"bookkeeping-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"bookkeeping-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"bookkeeping-common-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"bookkeeping-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"bookkeeping-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"bookkeeping-common-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"bookkeeping-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"bookkeeping-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"bookkeeping-common-l4-quiz"}]},{"id":"bookkeeping-core","type":"Core","title":"Core Competency","description":"Core competencies of Bookkeeping NC III: accounting fundamentals, recording business transactions, posting and the trial balance, and preparing financial reports.","lessons":[],"units":[{"id":"bookkeeping-core-u1","title":"Accounting Fundamentals","description":"Understand the purpose of bookkeeping and the principles behind every recorded transaction.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"bookkeeping-core-u1-l1","title":"Introduction to Bookkeeping & Accounting","description":"Distinguish bookkeeping from accounting and identify the duties of a bookkeeper.","duration":45,"video":"Introduction to Bookkeeping & Accounting","materials":[{"id":"bookkeeping-core-u1-l1-m1","name":"Bookkeeping Overview.pdf","type":"pdf","url":""}],"content":"Bookkeeping is the systematic recording of business transactions. This lesson covers the duties of a bookkeeper, the stages of the accounting cycle, the users of financial information, and the business records that must be kept.","quizId":"bookkeeping-core-u1-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"bookkeeping-core-u1-l2","title":"The Accounting Equation & Double-Entry System","description":"Apply the accounting equation and the rules of debit and credit.","duration":55,"video":"The Accounting Equation & Double-Entry System","materials":[{"id":"bookkeeping-core-u1-l2-m1","name":"Accounting Equation Worksheet.xlsx","type":"xls","url":""},{"id":"bookkeeping-core-u1-l2-m2","name":"Debit and Credit Rules.pdf","type":"pdf","url":""}],"content":"Every transaction keeps the accounting equation (Assets = Liabilities + Equity) in balance. Learn the rules of debit and credit for assets, liabilities, equity, revenue and expenses, and analyze transactions using the double-entry system.","quizId":"bookkeeping-core-u1-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"bookkeeping-core-u1-l3","title":"Accounting Concepts & the Accounting Cycle","description":"Identify the assumptions, principles and steps that guide financial recording.","duration":50,"video":"Accounting Concepts & the Accounting Cycle","materials":[{"id":"bookkeeping-core-u1-l3-m1","name":"Accounting Cycle Diagram.pdf","type":"pdf","url":""}],"content":"Study the fundamental concepts — accrual, going concern, matching, consistency and materiality — and walk through the full accounting cycle from source documents to the closing entries.","quizId":"bookkeeping-core-u1-l3-quiz"}]},{"id":"bookkeeping-core-u2","title":"Recording Business Transactions","description":"Analyze source documents and record transactions in the books of accounts.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"bookkeeping-core-u2-l1","title":"Source Documents & the Chart of Accounts","description":"Verify business documents and classify accounts correctly.","duration":50,"video":"Source Documents & the Chart of Accounts","materials":[{"id":"bookkeeping-core-u2-l1-m1","name":"Sample Source Documents.pdf","type":"pdf","url":""}],"content":"Learn to check invoices, receipts, vouchers and statements for completeness and accuracy, then assign each transaction to the proper account using a well-designed chart of accounts.","quizId":"bookkeeping-core-u2-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"bookkeeping-core-u2-l2","title":"Journalizing in the General Journal","description":"Record transactions chronologically with correct debits and credits.","duration":60,"video":"Journalizing in the General Journal","materials":[{"id":"bookkeeping-core-u2-l2-m1","name":"General Journal Template.xlsx","type":"xls","url":""}],"content":"Practice recording entries in the general journal: date, account titles, debit and credit amounts, and a short explanation. Covers compound entries and correcting entries.","quizId":"bookkeeping-core-u2-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"bookkeeping-core-u2-l3","title":"Special Journals & Subsidiary Ledgers","description":"Use special journals and subsidiary records for high-volume transactions.","duration":55,"video":"Special Journals & Subsidiary Ledgers","materials":[{"id":"bookkeeping-core-u2-l3-m1","name":"Special Journals Guide.pdf","type":"pdf","url":""}],"content":"Learn how the sales, purchases, cash receipts and cash payments journals simplify recording, and how subsidiary ledgers track individual customers and suppliers.","quizId":"bookkeeping-core-u2-l3-quiz"}]},{"id":"bookkeeping-core-u3","title":"Posting & the Trial Balance","description":"Transfer journal entries to the ledger and prove the accuracy of the records.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"bookkeeping-core-u3-l1","title":"Posting to the General Ledger","description":"Post journal entries to the correct ledger accounts.","duration":55,"video":"Posting to the General Ledger","materials":[{"id":"bookkeeping-core-u3-l1-m1","name":"Ledger Posting Practice.xlsx","type":"xls","url":""}],"content":"Follow the posting procedure: locate the account, enter the date, amount and journal reference, then update the running balance for each account.","quizId":"bookkeeping-core-u3-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"bookkeeping-core-u3-l2","title":"Preparing the Trial Balance","description":"Prepare a trial balance and locate errors when it does not balance.","duration":45,"video":"Preparing the Trial Balance","materials":[{"id":"bookkeeping-core-u3-l2-m1","name":"Trial Balance Worksheet.xlsx","type":"xls","url":""}],"content":"Prepare an unadjusted trial balance listing every account and its balance, then apply techniques such as recomputing, checking postings and tracing entries to find errors.","quizId":"bookkeeping-core-u3-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"bookkeeping-core-u3-l3","title":"Adjusting Entries & the Worksheet","description":"Record accruals, deferrals, depreciation and other period-end adjustments.","duration":60,"video":"Adjusting Entries & the Worksheet","materials":[{"id":"bookkeeping-core-u3-l3-m1","name":"Adjusting Entries Guide.pdf","type":"pdf","url":""}],"content":"Adjust the records at period end for accrued revenues and expenses, prepayments, unearned income, depreciation and inventory, and complete a worksheet to produce the adjusted trial balance.","quizId":"bookkeeping-core-u3-l3-quiz"}]},{"id":"bookkeeping-core-u4","title":"Financial Reports & Compliance","description":"Prepare financial statements and keep records compliant with reporting requirements.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"bookkeeping-core-u4-l1","title":"Preparing the Income Statement","description":"Compute gross profit, operating income and net income.","duration":55,"video":"Preparing the Income Statement","materials":[{"id":"bookkeeping-core-u4-l1-m1","name":"Income Statement Template.xlsx","type":"xls","url":""}],"content":"Prepare a single-step and multi-step income statement, classify revenues and expenses, and compute gross profit, operating income and net income for the period.","quizId":"bookkeeping-core-u4-l1-quiz"},{"videoUrl":"","published":true,"order":2,"id":"bookkeeping-core-u4-l2","title":"Preparing the Statement of Financial Position","description":"Classify and present assets, liabilities and equity.","duration":55,"video":"Preparing the Statement of Financial Position","materials":[{"id":"bookkeeping-core-u4-l2-m1","name":"Statement of Financial Position Template.xlsx","type":"xls","url":""}],"content":"Prepare the statement of financial position using the classified format, distinguishing current from non-current items and presenting equity for sole proprietorships, partnerships and corporations.","quizId":"bookkeeping-core-u4-l2-quiz"},{"videoUrl":"","published":true,"order":3,"id":"bookkeeping-core-u4-l3","title":"Bank Reconciliation & Internal Control","description":"Reconcile the cash book with the bank statement and apply basic controls.","duration":50,"video":"Bank Reconciliation & Internal Control","materials":[{"id":"bookkeeping-core-u4-l3-m1","name":"Bank Reconciliation Form.xlsx","type":"xls","url":""}],"content":"Prepare a bank reconciliation by adjusting for deposits in transit, outstanding checks, bank charges and errors. Discuss segregation of duties, authorization and documentation as basic internal controls.","quizId":"bookkeeping-core-u4-l3-quiz"},{"videoUrl":"","published":true,"order":4,"id":"bookkeeping-core-u4-l4","title":"Payroll, Taxes & Record Keeping","description":"Maintain payroll records and keep books compliant and audit-ready.","duration":45,"video":"Payroll, Taxes & Record Keeping","materials":[{"id":"bookkeeping-core-u4-l4-m1","name":"Payroll Register Template.xlsx","type":"xls","url":""},{"id":"bookkeeping-core-u4-l4-m2","name":"Record Keeping Checklist.pdf","type":"pdf","url":""}],"content":"Compute gross and net pay with statutory deductions, record payroll entries, and learn the retention, safekeeping and reporting requirements for business books and records.","quizId":"bookkeeping-core-u4-l4-quiz"}]}]}],"quizzes":[{"id":"bookkeeping-basic-l1-quiz","programId":"bookkeeping","lessonId":"bookkeeping-basic-l1","title":"Reading, Writing & Comprehension Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-basic-l1-quiz-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"bookkeeping-basic-l1-quiz-q2","type":"tf","q":"When reading workplace instructions, it is fine to skip the steps you think are unnecessary.","answer":false},{"id":"bookkeeping-basic-l1-quiz-q3","type":"id","q":"The central point of a paragraph is called the ______ idea.","answer":"main"},{"id":"bookkeeping-basic-l1-quiz-q4","type":"mcq","q":"Which sentence is clearest for a workplace report?","options":["Done already yesterday by me the task.","The task was completed yesterday.","Task yesterday done.","Yesterday task done by me already."],"answer":"The task was completed yesterday."}]},{"id":"bookkeeping-basic-l2-quiz","programId":"bookkeeping","lessonId":"bookkeeping-basic-l2","title":"Basic Communication Skills Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-basic-l2-quiz-q1","type":"mcq","q":"Which behavior is the strongest sign of active listening?","options":["Interrupting to correct the speaker","Repeating back what you understood","Checking your phone","Changing the topic"],"answer":"Repeating back what you understood"},{"id":"bookkeeping-basic-l2-quiz-q2","type":"tf","q":"Eye contact and posture are part of communication.","answer":true},{"id":"bookkeeping-basic-l2-quiz-q3","type":"id","q":"Restating a message in your own words to confirm understanding is called ______.","answer":"paraphrasing"},{"id":"bookkeeping-basic-l2-quiz-q4","type":"mcq","q":"Which tone is appropriate when writing to a customer?","options":["Sarcastic","Professional and courteous","Aggressive","Overly casual"],"answer":"Professional and courteous"}]},{"id":"bookkeeping-basic-l3-quiz","programId":"bookkeeping","lessonId":"bookkeeping-basic-l3","title":"Basic Digital Literacy Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-basic-l3-quiz-q1","type":"mcq","q":"Which of these is an email application?","options":["Gmail","Excel","Photoshop","VLC"],"answer":"Gmail"},{"id":"bookkeeping-basic-l3-quiz-q2","type":"tf","q":"A strong password should be shared with co-workers so they can open your files.","answer":false},{"id":"bookkeeping-basic-l3-quiz-q3","type":"id","q":"The key combination Ctrl + C is used to ______ the selected text.","answer":"copy"},{"id":"bookkeeping-basic-l3-quiz-q4","type":"mcq","q":"What should you do before opening an attachment from an unknown sender?","options":["Open it immediately","Verify the sender and scan it for malware","Forward it to all staff","Reply with your password"],"answer":"Verify the sender and scan it for malware"}]},{"id":"bookkeeping-basic-l4-quiz","programId":"bookkeeping","lessonId":"bookkeeping-basic-l4","title":"Workplace Behavior & Professionalism Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-basic-l4-quiz-q1","type":"mcq","q":"What does punctuality at work demonstrate?","options":["Reliability and respect for others","That you are overworked","That you dislike the job","Nothing important"],"answer":"Reliability and respect for others"},{"id":"bookkeeping-basic-l4-quiz-q2","type":"tf","q":"Personal social media accounts may be used to discuss confidential client information.","answer":false},{"id":"bookkeeping-basic-l4-quiz-q3","type":"id","q":"The set of rules that guides acceptable behavior in the workplace is the code of ______.","answer":"conduct"},{"id":"bookkeeping-basic-l4-quiz-q4","type":"mcq","q":"A colleague keeps arriving late. What is the professional response?","options":["Post about it online","Raise it with the supervisor privately","Ignore your own work","Confront them in front of clients"],"answer":"Raise it with the supervisor privately"}]},{"id":"bookkeeping-common-l1-quiz","programId":"bookkeeping","lessonId":"bookkeeping-common-l1","title":"Workplace Communication Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-common-l1-quiz-q1","type":"mcq","q":"Which channel is best for reporting an urgent safety incident?","options":["A memo next week","A call or direct message to the supervisor","A suggestion box","A social media post"],"answer":"A call or direct message to the supervisor"},{"id":"bookkeeping-common-l1-quiz-q2","type":"tf","q":"Incident reports should be written as soon as possible after the event.","answer":true},{"id":"bookkeeping-common-l1-quiz-q3","type":"id","q":"The written record of what was discussed in a meeting is called the ______.","answer":"minutes"},{"id":"bookkeeping-common-l1-quiz-q4","type":"mcq","q":"What is the best way to confirm instructions you received verbally?","options":["Assume you understood","Write them down and repeat them back","Wait for a written complaint","Ask a client instead"],"answer":"Write them down and repeat them back"}]},{"id":"bookkeeping-common-l2-quiz","programId":"bookkeeping","lessonId":"bookkeeping-common-l2","title":"Workplace Safety & Emergency Procedures Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-common-l2-quiz-q1","type":"mcq","q":"What does OSH stand for?","options":["Occupational Safety and Health","Office Staff Handbook","Operational Service Hours","Organized Safety Help"],"answer":"Occupational Safety and Health"},{"id":"bookkeeping-common-l2-quiz-q2","type":"tf","q":"Fire exits must be kept clear of boxes and equipment at all times.","answer":true},{"id":"bookkeeping-common-l2-quiz-q3","type":"id","q":"Gear worn to protect a worker from hazards is called ______ equipment.","answer":"personal protective"},{"id":"bookkeeping-common-l2-quiz-q4","type":"mcq","q":"During an earthquake while indoors you should:","options":["Run to the elevator","Duck, cover and hold","Stand near the windows","Call clients first"],"answer":"Duck, cover and hold"}]},{"id":"bookkeeping-common-l3-quiz","programId":"bookkeeping","lessonId":"bookkeeping-common-l3","title":"Customer Service Excellence Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-common-l3-quiz-q1","type":"mcq","q":"What is the first step in handling a customer complaint?","options":["Defend the company","Listen without interrupting","Offer a refund immediately","Blame another staff member"],"answer":"Listen without interrupting"},{"id":"bookkeeping-common-l3-quiz-q2","type":"tf","q":"Customer expectations are met only when the service is free of charge.","answer":false},{"id":"bookkeeping-common-l3-quiz-q3","type":"id","q":"The measure of how happy customers are with a service is customer ______.","answer":"satisfaction"},{"id":"bookkeeping-common-l3-quiz-q4","type":"mcq","q":"A customer is angry about a delayed order. What should you say first?","options":["That is not our problem.","I understand — let me check the status for you.","You should have ordered earlier.","Call again tomorrow."],"answer":"I understand — let me check the status for you."}]},{"id":"bookkeeping-common-l4-quiz","programId":"bookkeeping","lessonId":"bookkeeping-common-l4","title":"Working with Others & Time Management Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-common-l4-quiz-q1","type":"mcq","q":"Which practice helps a team meet deadlines?","options":["Working without a plan","Setting priorities and tracking tasks","Avoiding updates","Doing everything at the last minute"],"answer":"Setting priorities and tracking tasks"},{"id":"bookkeeping-common-l4-quiz-q2","type":"tf","q":"A task list should be reviewed and updated as work progresses.","answer":true},{"id":"bookkeeping-common-l4-quiz-q3","type":"id","q":"Arranging tasks from most to least important is called ______.","answer":"prioritizing"},{"id":"bookkeeping-common-l4-quiz-q4","type":"mcq","q":"A teammate is behind on a shared task. What is the best action?","options":["Ignore it","Offer help and inform the lead","Complain about it later","Take over without telling anyone"],"answer":"Offer help and inform the lead"}]},{"id":"bookkeeping-core-u1-l1-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u1-l1","title":"Introduction to Bookkeeping & Accounting Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u1-l1-quiz-q1","type":"mcq","q":"Bookkeeping is best described as:","options":["The systematic recording of business transactions","Auditing financial statements","Managing investments","Filing tax returns only"],"answer":"The systematic recording of business transactions"},{"id":"bookkeeping-core-u1-l1-quiz-q2","type":"tf","q":"Accounting is broader than bookkeeping because it includes analysis and reporting.","answer":true},{"id":"bookkeeping-core-u1-l1-quiz-q3","type":"id","q":"The sequence of steps from transaction to financial statements is the accounting ______.","answer":"cycle"},{"id":"bookkeeping-core-u1-l1-quiz-q4","type":"mcq","q":"Who uses financial information?","options":["The owner only","Owners, lenders, government and investors","Auditors only","Customers only"],"answer":"Owners, lenders, government and investors"}]},{"id":"bookkeeping-core-u1-l2-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u1-l2","title":"The Accounting Equation & Double-Entry System Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u1-l2-quiz-q1","type":"mcq","q":"The accounting equation is:","options":["Assets = Liabilities + Equity","Assets = Equity - Liabilities","Equity = Assets + Liabilities","Liabilities = Assets + Equity"],"answer":"Assets = Liabilities + Equity"},{"id":"bookkeeping-core-u1-l2-quiz-q2","type":"tf","q":"Every transaction affects at least two accounts.","answer":true},{"id":"bookkeeping-core-u1-l2-quiz-q3","type":"id","q":"Increases in assets are recorded as ______.","answer":"debits"},{"id":"bookkeeping-core-u1-l2-quiz-q4","type":"mcq","q":"A debit increases which account?","options":["Revenue","Expense","Liability","Equity"],"answer":"Expense"}]},{"id":"bookkeeping-core-u1-l3-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u1-l3","title":"Accounting Concepts & the Accounting Cycle Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u1-l3-quiz-q1","type":"mcq","q":"Under the accrual concept, revenue is recorded when:","options":["Cash is received","It is earned","The year ends","The customer requests it"],"answer":"It is earned"},{"id":"bookkeeping-core-u1-l3-quiz-q2","type":"tf","q":"The going concern assumption means the business is expected to keep operating.","answer":true},{"id":"bookkeeping-core-u1-l3-quiz-q3","type":"id","q":"Matching expenses with the revenue they helped earn is the ______ principle.","answer":"matching"},{"id":"bookkeeping-core-u1-l3-quiz-q4","type":"mcq","q":"Which is the last step of the accounting cycle?","options":["Journalizing","Posting","Preparing the trial balance","Closing the books"],"answer":"Closing the books"}]},{"id":"bookkeeping-core-u2-l1-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u2-l1","title":"Source Documents & the Chart of Accounts Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u2-l1-quiz-q1","type":"mcq","q":"Which document proves a sale on credit?","options":["Sales invoice","Bank statement","Payroll register","Petty cash voucher"],"answer":"Sales invoice"},{"id":"bookkeeping-core-u2-l1-quiz-q2","type":"tf","q":"The chart of accounts lists every account the business uses.","answer":true},{"id":"bookkeeping-core-u2-l1-quiz-q3","type":"id","q":"The document a seller issues to a buyer for goods delivered is an ______.","answer":"invoice"},{"id":"bookkeeping-core-u2-l1-quiz-q4","type":"mcq","q":"Why must source documents be verified?","options":["To ensure accuracy and legitimacy","To increase sales","To delay recording","To replace the ledger"],"answer":"To ensure accuracy and legitimacy"}]},{"id":"bookkeeping-core-u2-l2-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u2-l2","title":"Journalizing in the General Journal Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u2-l2-quiz-q1","type":"mcq","q":"In what order does the general journal record transactions?","options":["Alphabetical","Chronological","By amount","By account number"],"answer":"Chronological"},{"id":"bookkeeping-core-u2-l2-quiz-q2","type":"tf","q":"The debit entry is written before the credit entry in a journal.","answer":true},{"id":"bookkeeping-core-u2-l2-quiz-q3","type":"id","q":"A journal entry with more than one debit or credit is a ______ entry.","answer":"compound"},{"id":"bookkeeping-core-u2-l2-quiz-q4","type":"mcq","q":"Which details belong in a journal entry?","options":["Date, accounts, amounts and explanation","The amount only","The account title only","The date only"],"answer":"Date, accounts, amounts and explanation"}]},{"id":"bookkeeping-core-u2-l3-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u2-l3","title":"Special Journals & Subsidiary Ledgers Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u2-l3-quiz-q1","type":"mcq","q":"Which special journal records sales on account?","options":["Sales journal","Cash receipts journal","Purchases journal","General journal"],"answer":"Sales journal"},{"id":"bookkeeping-core-u2-l3-quiz-q2","type":"tf","q":"Subsidiary ledgers show the balance of each individual customer or supplier.","answer":true},{"id":"bookkeeping-core-u2-l3-quiz-q3","type":"id","q":"The ledger summarizing all customer accounts receivable is the ______ ledger.","answer":"subsidiary"},{"id":"bookkeeping-core-u2-l3-quiz-q4","type":"mcq","q":"Special journals are used mainly to:","options":["Handle high volumes of similar transactions","Replace the trial balance","Record adjusting entries","Compute payroll tax"],"answer":"Handle high volumes of similar transactions"}]},{"id":"bookkeeping-core-u3-l1-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u3-l1","title":"Posting to the General Ledger Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u3-l1-quiz-q1","type":"mcq","q":"Posting means transferring entries from:","options":["The journal to the ledger","The ledger to the journal","The trial balance to the journal","The bank to the books"],"answer":"The journal to the ledger"},{"id":"bookkeeping-core-u3-l1-quiz-q2","type":"tf","q":"Each ledger account keeps a running balance.","answer":true},{"id":"bookkeeping-core-u3-l1-quiz-q3","type":"id","q":"The journal page number written in the ledger is the ______ reference.","answer":"folio"},{"id":"bookkeeping-core-u3-l1-quiz-q4","type":"mcq","q":"What is posted to the ledger for each entry?","options":["The total only","The date, amount and journal reference","The account title only","The explanation only"],"answer":"The date, amount and journal reference"}]},{"id":"bookkeeping-core-u3-l2-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u3-l2","title":"Preparing the Trial Balance Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u3-l2-quiz-q1","type":"mcq","q":"A trial balance lists:","options":["Every account and its balance","Revenue accounts only","Cash transactions only","The chart of accounts"],"answer":"Every account and its balance"},{"id":"bookkeeping-core-u3-l2-quiz-q2","type":"tf","q":"If a trial balance does not balance, an error definitely exists.","answer":true},{"id":"bookkeeping-core-u3-l2-quiz-q3","type":"id","q":"The trial balance prepared before adjustments is the ______ trial balance.","answer":"unadjusted"},{"id":"bookkeeping-core-u3-l2-quiz-q4","type":"mcq","q":"Which technique helps locate trial balance errors?","options":["Recomputing balances and tracing postings","Ignoring the difference","Deleting entries","Changing the fiscal year"],"answer":"Recomputing balances and tracing postings"}]},{"id":"bookkeeping-core-u3-l3-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u3-l3","title":"Adjusting Entries & the Worksheet Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u3-l3-quiz-q1","type":"mcq","q":"Which of these is an adjusting entry?","options":["Recording depreciation for the period","Recording a cash sale","Paying a supplier","Opening a bank account"],"answer":"Recording depreciation for the period"},{"id":"bookkeeping-core-u3-l3-quiz-q2","type":"tf","q":"Unearned revenue is a liability until the service is performed.","answer":true},{"id":"bookkeeping-core-u3-l3-quiz-q3","type":"id","q":"Expenses already incurred but not yet paid are accrued ______.","answer":"expenses"},{"id":"bookkeeping-core-u3-l3-quiz-q4","type":"mcq","q":"The worksheet is used to produce which output?","options":["The adjusted trial balance","The bank statement","The payroll register","The purchase order"],"answer":"The adjusted trial balance"}]},{"id":"bookkeeping-core-u4-l1-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u4-l1","title":"Preparing the Income Statement Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u4-l1-quiz-q1","type":"mcq","q":"Gross profit equals:","options":["Net sales - cost of goods sold","Net sales - operating expenses","Revenue + expenses","Assets - liabilities"],"answer":"Net sales - cost of goods sold"},{"id":"bookkeeping-core-u4-l1-quiz-q2","type":"tf","q":"A multi-step income statement separates operating from non-operating items.","answer":true},{"id":"bookkeeping-core-u4-l1-quiz-q3","type":"id","q":"The profit left after all expenses are deducted is ______ income.","answer":"net"},{"id":"bookkeeping-core-u4-l1-quiz-q4","type":"mcq","q":"Which account appears on the income statement?","options":["Service revenue","Accounts receivable","Owner's capital","Equipment"],"answer":"Service revenue"}]},{"id":"bookkeeping-core-u4-l2-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u4-l2","title":"Preparing the Statement of Financial Position Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u4-l2-quiz-q1","type":"mcq","q":"Which of these is a current asset?","options":["Cash","Building","Equipment","Patent"],"answer":"Cash"},{"id":"bookkeeping-core-u4-l2-quiz-q2","type":"tf","q":"The statement of financial position reports assets, liabilities and equity at a point in time.","answer":true},{"id":"bookkeeping-core-u4-l2-quiz-q3","type":"id","q":"Assets minus liabilities equals ______.","answer":"equity"},{"id":"bookkeeping-core-u4-l2-quiz-q4","type":"mcq","q":"Which item is a non-current liability?","options":["Loan payable after five years","Accounts payable","Accrued wages","Prepaid rent"],"answer":"Loan payable after five years"}]},{"id":"bookkeeping-core-u4-l3-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u4-l3","title":"Bank Reconciliation & Internal Control Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u4-l3-quiz-q1","type":"mcq","q":"A deposit in transit is:","options":["Recorded in the books but not yet on the bank statement","A bank error","An outstanding check","A service charge"],"answer":"Recorded in the books but not yet on the bank statement"},{"id":"bookkeeping-core-u4-l3-quiz-q2","type":"tf","q":"Outstanding checks are deducted from the bank balance in a reconciliation.","answer":true},{"id":"bookkeeping-core-u4-l3-quiz-q3","type":"id","q":"Separating duties among employees is a form of internal ______.","answer":"control"},{"id":"bookkeeping-core-u4-l3-quiz-q4","type":"mcq","q":"Which is a good internal control for cash?","options":["One person handles and records all cash","Segregation of duties and regular reconciliation","No documentation","An annual audit only"],"answer":"Segregation of duties and regular reconciliation"}]},{"id":"bookkeeping-core-u4-l4-quiz","programId":"bookkeeping","lessonId":"bookkeeping-core-u4-l4","title":"Payroll, Taxes & Record Keeping Quiz","passing":75,"timeLimit":15,"published":true,"questions":[{"id":"bookkeeping-core-u4-l4-quiz-q1","type":"mcq","q":"Net pay equals:","options":["Gross pay minus deductions","Gross pay plus deductions","Gross pay only","Deductions minus gross pay"],"answer":"Gross pay minus deductions"},{"id":"bookkeeping-core-u4-l4-quiz-q2","type":"tf","q":"Business records must be kept for the period required by law.","answer":true},{"id":"bookkeeping-core-u4-l4-quiz-q3","type":"id","q":"Deductions required by law such as SSS and PhilHealth are ______ deductions.","answer":"statutory"},{"id":"bookkeeping-core-u4-l4-quiz-q4","type":"mcq","q":"Which document supports the payroll entries?","options":["Payroll register","Sales invoice","Bank statement","Delivery receipt"],"answer":"Payroll register"}]}],"exams":[{"id":"bookkeeping-exam-1","programId":"bookkeeping","title":"Bookkeeping NC III - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"bookkeeping-exam-1-q1","type":"mcq","q":"Which document would you use to formally request time off from work?","options":["Leave request form","Sales invoice","Delivery receipt","Purchase order"],"answer":"Leave request form"},{"id":"bookkeeping-exam-1-q2","type":"tf","q":"A strong password should be shared with co-workers so they can open your files.","answer":false},{"id":"bookkeeping-exam-1-q3","type":"id","q":"The written record of what was discussed in a meeting is called the ______.","answer":"minutes"},{"id":"bookkeeping-exam-1-q4","type":"mcq","q":"A customer is angry about a delayed order. What should you say first?","options":["That is not our problem.","I understand — let me check the status for you.","You should have ordered earlier.","Call again tomorrow."],"answer":"I understand — let me check the status for you."},{"id":"bookkeeping-exam-1-q5","type":"mcq","q":"Bookkeeping is best described as:","options":["The systematic recording of business transactions","Auditing financial statements","Managing investments","Filing tax returns only"],"answer":"The systematic recording of business transactions"},{"id":"bookkeeping-exam-1-q6","type":"tf","q":"The going concern assumption means the business is expected to keep operating.","answer":true},{"id":"bookkeeping-exam-1-q7","type":"id","q":"A journal entry with more than one debit or credit is a ______ entry.","answer":"compound"},{"id":"bookkeeping-exam-1-q8","type":"mcq","q":"What is posted to the ledger for each entry?","options":["The total only","The date, amount and journal reference","The account title only","The explanation only"],"answer":"The date, amount and journal reference"},{"id":"bookkeeping-exam-1-q9","type":"mcq","q":"Which of these is an adjusting entry?","options":["Recording depreciation for the period","Recording a cash sale","Paying a supplier","Opening a bank account"],"answer":"Recording depreciation for the period"},{"id":"bookkeeping-exam-1-q10","type":"tf","q":"The statement of financial position reports assets, liabilities and equity at a point in time.","answer":true}],"questionCount":10,"timeLimit":60,"passing":75,"date":"2026-12-10","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

-- ===========================================================================
-- TRAINER MANAGEMENT + SUPER ADMIN MFA  (supabase/migrations/*.sql)
-- ---------------------------------------------------------------------------
-- Everything below is the same content as supabase/migrations/, appended here
-- so that pasting this single file into the SQL Editor sets up the whole
-- backend. All statements are idempotent.
-- ===========================================================================

-- ###########################################################################
-- ## supabase/migrations/001_extensions.sql
-- ###########################################################################
-- ===========================================================================
-- 001_extensions.sql
-- ---------------------------------------------------------------------------
-- Required PostgreSQL extensions.
--   pgcrypto -> gen_random_uuid(), gen_random_bytes(), crypt()/gen_salt()
--   citext   -> case-insensitive email comparisons (optional, guarded)
-- Idempotent: safe to run repeatedly.
-- ===========================================================================

create extension if not exists pgcrypto;

-- citext is optional; only created when available (managed Postgres ships it).
do $$
begin
  create extension if not exists citext;
exception
  when insufficient_privilege then null;
  when undefined_file then null;
end $$;

-- ###########################################################################
-- ## supabase/migrations/002_profiles.sql
-- ###########################################################################
-- ===========================================================================
-- 002_profiles.sql
-- ---------------------------------------------------------------------------
-- Extends the existing public.profiles table with the trainer / administrator
-- profile fields required by the trainer-management feature.
--
-- DESIGN NOTE
--   The existing LMS stores a display name in `name` and a free-form bag in
--   `data jsonb`. Those are kept untouched so the current frontend keeps
--   working. The columns added here are the authoritative, first-class fields.
--
-- ROLE VALUES
--   The existing frontend hard-codes the Super Admin role string as 'admin'
--   (see src/config/navigation.js -> roleMeta.admin). To avoid breaking it we
--   keep 'admin' as the stored value for the Super Admin and accept
--   'super_admin' as an equivalent alias everywhere in the backend.
--
-- Idempotent: safe to run repeatedly.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists first_name        text;
alter table public.profiles add column if not exists last_name         text;
alter table public.profiles add column if not exists phone             text;
alter table public.profiles add column if not exists address           text;
alter table public.profiles add column if not exists date_of_birth     date;
alter table public.profiles add column if not exists profile_image_url text;
alter table public.profiles add column if not exists position          text;
alter table public.profiles add column if not exists specialization    text;   -- display value
alter table public.profiles add column if not exists specialization_id uuid;   -- FK added in 019
alter table public.profiles add column if not exists status            text;
alter table public.profiles add column if not exists is_activated      boolean;
alter table public.profiles add column if not exists mfa_enforced      boolean not null default false;
alter table public.profiles add column if not exists last_login_at     timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Backfill existing rows so the NOT NULL / CHECK constraints can be added
-- ---------------------------------------------------------------------------
update public.profiles
   set first_name = coalesce(first_name, nullif(split_part(coalesce(name, ''), ' ', 1), ''))
 where first_name is null;

update public.profiles
   set last_name = coalesce(
         last_name,
         nullif(trim(substr(coalesce(name, ''), length(split_part(coalesce(name, ''), ' ', 1)) + 1)), '')
       )
 where last_name is null;

update public.profiles set status       = 'active' where status is null;
update public.profiles set is_activated = true     where is_activated is null;

-- Any existing Super Admin must be active + activated.
update public.profiles
   set status = 'active', is_activated = true
 where role in ('admin', 'super_admin')
   and (status <> 'active' or is_activated is not true);

alter table public.profiles alter column status       set default 'active';
alter table public.profiles alter column status       set not null;
alter table public.profiles alter column is_activated set default true;
alter table public.profiles alter column is_activated set not null;

-- ---------------------------------------------------------------------------
-- 3. Constraints
-- ---------------------------------------------------------------------------
do $$
begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('super_admin', 'admin', 'trainer', 'trainee'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_status_check
    check (status in ('pending_activation', 'active', 'inactive', 'suspended'));
exception when duplicate_object then null;
end $$;

-- Normalise emails to lower-case (profiles.email already has a UNIQUE index).
update public.profiles set email = lower(email) where email <> lower(email);

-- ---------------------------------------------------------------------------
-- 4. updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Protect privileged columns from self-service updates
--    A trainer / trainee may edit their own profile, but must never be able to
--    change role, status, activation, email or the controlled specialization.
--    Super Admins and the service_role (Edge Functions) bypass the guard.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / definer context has no JWT -> allow (Edge Functions).
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  -- Super Admins may change anything.
  if public.is_super_admin() then
    return new;
  end if;

  -- A trainer may self-activate their own account (pending_activation -> active).
  -- This is the ONLY protected change they are allowed to make to their own row.
  if new.id = old.id
     and old.auth_user_id = auth.uid()
     and old.status = 'pending_activation'
     and new.status = 'active'
     and old.is_activated = false
     and new.is_activated = true
     and new.role = old.role
     and new.mfa_enforced is not distinct from old.mfa_enforced
     and new.email is not distinct from old.email
     and new.specialization_id is not distinct from old.specialization_id then
    return new;
  end if;

  if new.role            is distinct from old.role
     or new.status            is distinct from old.status
     or new.is_activated      is distinct from old.is_activated
     or new.mfa_enforced      is distinct from old.mfa_enforced
     or new.email             is distinct from old.email
     or new.specialization_id is distinct from old.specialization_id then
    raise exception 'You are not allowed to change protected profile fields (role, status, activation, email, specialization).'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ###########################################################################
-- ## supabase/migrations/017_functions.sql
-- ###########################################################################
-- ===========================================================================
-- 017_functions.sql
-- ---------------------------------------------------------------------------
-- Authorization + identity helper functions.
--
-- All of these are SECURITY DEFINER and read `public.profiles` directly so that
-- RLS policies never recurse into the very table they are protecting. The
-- functions are owned by the schema owner (postgres) which is the table owner,
-- so RLS is bypassed inside them.
--
-- The current user is ALWAYS derived from auth.uid() (the verified JWT), never
-- from anything the frontend sends.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- current_profile_id() -> the caller's public.profiles.id (text), or null
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- current_role() -> the caller's role (text), or null
-- (kept for backwards compatibility with the original schema)
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- get_current_user_role() -> explicit alias used by the trainer feature
-- ---------------------------------------------------------------------------
create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- is_super_admin()
--   auth.uid() -> profiles.id -> role in ('admin','super_admin')
--   AND the account is active and activated.
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where auth_user_id = auth.uid()
       and role in ('admin', 'super_admin')
       and status = 'active'
       and is_activated = true
  )
$$;

-- ---------------------------------------------------------------------------
-- current_aal() -> the Authenticator Assurance Level of the current session.
--   'aal1' = password only, 'aal2' = password + verified MFA factor.
-- ---------------------------------------------------------------------------
create or replace function public.current_aal()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1')
$$;

-- ---------------------------------------------------------------------------
-- mfa_satisfied() -> true when the session reached AAL2 (MFA completed).
-- ---------------------------------------------------------------------------
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
as $$
  select public.current_aal() = 'aal2'
$$;

-- ---------------------------------------------------------------------------
-- has_verified_mfa_factor() -> does the caller have an enrolled + verified MFA
-- factor (Supabase Auth TOTP)?
-- ---------------------------------------------------------------------------
create or replace function public.has_verified_mfa_factor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from auth.mfa_factors
     where user_id = auth.uid()
       and status = 'verified'
  )
$$;

-- ---------------------------------------------------------------------------
-- require_mfa() -> raises unless the session is at AAL2.
-- Used by every sensitive Super Admin RPC / Edge Function.
-- ---------------------------------------------------------------------------
create or replace function public.require_mfa()
returns void
language plpgsql
stable
as $$
begin
  if not public.mfa_satisfied() then
    raise exception 'Multi-factor authentication is required for this operation. Complete the MFA challenge and try again.'
      using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- is_super_admin_mfa() -> Super Admin AND AAL2. The gate for sensitive actions.
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin_mfa()
returns boolean
language sql
stable
as $$
  select public.is_super_admin() and public.mfa_satisfied()
$$;

-- ---------------------------------------------------------------------------
-- is_active_trainer() -> role = trainer AND status = active AND activated.
-- A suspended / pending trainer is never "active".
-- ---------------------------------------------------------------------------
create or replace function public.is_active_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where auth_user_id = auth.uid()
       and role = 'trainer'
       and status = 'active'
       and is_activated = true
  )
$$;

-- ---------------------------------------------------------------------------
-- is_trainer_assigned_to_program(program_id)
--   true when the caller is an active trainer assigned to the program through
--   trainer_programs (authoritative), or is the program's primary trainer.
--
--   plpgsql (not sql) on purpose: `trainer_programs` is created in a later
--   migration, and plpgsql defers relation resolution to first execution.
-- ---------------------------------------------------------------------------
create or replace function public.is_trainer_assigned_to_program(p_program_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_trainer() then
    return false;
  end if;

  return exists (
      select 1
        from public.trainer_programs tp
       where tp.trainer_id = public.current_profile_id()
         and tp.program_id = p_program_id
         and tp.status = 'active'
    )
    or exists (
      select 1
        from public.programs p
       where p.id = p_program_id
         and p.trainer_id = public.current_profile_id()
    );
end $$;

-- ---------------------------------------------------------------------------
-- generate_temp_password(len)
--   Cryptographically secure temporary password (uses gen_random_bytes).
--   Ambiguous characters (0/O, 1/l/I) are excluded. Never stored in plaintext.
-- ---------------------------------------------------------------------------
create or replace function public.generate_temp_password(p_len int default 12)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charset text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*';
  v_result  text := '';
  v_bytes   bytea;
  i         int;
begin
  if p_len is null or p_len < 12 then
    p_len := 12;
  end if;

  -- Guarantee at least one of each class, then fill the rest.
  v_result := v_result
    || substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + (get_byte(gen_random_bytes(1), 0) % 24), 1)
    || substr('abcdefghijkmnopqrstuvwxyz', 1 + (get_byte(gen_random_bytes(1), 0) % 23), 1)
    || substr('23456789', 1 + (get_byte(gen_random_bytes(1), 0) % 8), 1)
    || substr('!@#$%*', 1 + (get_byte(gen_random_bytes(1), 0) % 6), 1);

  for i in (length(v_result) + 1)..p_len loop
    v_bytes  := gen_random_bytes(1);
    v_result := v_result || substr(v_charset, 1 + (get_byte(v_bytes, 0) % length(v_charset)), 1);
  end loop;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- get_my_auth_state()
--   A single, safe snapshot the frontend can use to drive the MFA challenge
--   and route guards. Contains no secrets.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_auth_state()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'profile_id',      p.id,
    'role',            p.role,
    'status',          p.status,
    'is_activated',    p.is_activated,
    'mfa_enforced',    p.mfa_enforced,
    'mfa_enrolled',    public.has_verified_mfa_factor(),
    'current_aal',     public.current_aal(),
    'mfa_satisfied',   public.mfa_satisfied(),
    'requires_mfa',    (p.mfa_enforced or p.role in ('admin','super_admin'))
                        and not public.mfa_satisfied()
  )
  from public.profiles p
 where p.auth_user_id = auth.uid()
 limit 1
$$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
revoke all on function public.generate_temp_password(int) from public, anon, authenticated;
revoke all on function public.require_mfa()                    from public, anon;

grant execute on function public.current_profile_id()                 to authenticated;
grant execute on function public.current_role()                       to authenticated;
grant execute on function public.get_current_user_role()              to authenticated;
grant execute on function public.is_super_admin()                     to authenticated;
grant execute on function public.is_super_admin_mfa()                 to authenticated;
grant execute on function public.is_active_trainer()                  to authenticated;
grant execute on function public.is_trainer_assigned_to_program(text) to authenticated;
grant execute on function public.current_aal()                        to authenticated;
grant execute on function public.mfa_satisfied()                      to authenticated;
grant execute on function public.has_verified_mfa_factor()            to authenticated;
grant execute on function public.get_my_auth_state()                  to authenticated;

-- ###########################################################################
-- ## supabase/migrations/018_rls_policies.sql
-- ###########################################################################
-- ===========================================================================
-- 018_rls_policies.sql
-- ---------------------------------------------------------------------------
-- Row Level Security for the EXISTING tables.
--
-- Compatibility note
--   The single-page frontend loads the whole catalog and gates the UI by role,
--   so broad *read* access for authenticated users is intentionally preserved
--   for catalog/content tables (programs, schedules, enrollments, ...).
--   Writes, however, are locked down: a trainer may only write content that
--   belongs to a program they are assigned to; only a Super Admin may write
--   anywhere.
--
-- Policies for the NEW tables (trainer_programs, specializations,
-- trainer_invitations, audit_logs) live in their own migration files, created
-- right after the tables themselves.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles
--   Read: broad (names are shown across the app).
--   Write: self, or Super Admin. Privileged columns are additionally guarded
--          by the trigger in 002_profiles.sql.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (auth_user_id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_super_admin())
  with check (auth_user_id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- programs
--   Trainer may only create/update/delete rows for programs assigned to them.
--   (Programs are normally created by the Super Admin.)
-- ---------------------------------------------------------------------------
drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs
  for select to authenticated using (true);

drop policy if exists programs_write on public.programs;
create policy programs_write on public.programs
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(id));

-- ---------------------------------------------------------------------------
-- schedules / attendance / evaluations
--   All carry a program_id -> a trainer may only write rows for assigned
--   programs. Reads stay broad for the shared calendar / roster views.
-- ---------------------------------------------------------------------------
drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules
  for select to authenticated using (true);

drop policy if exists schedules_write on public.schedules;
create policy schedules_write on public.schedules
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id));

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated using (true);

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id));

drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated using (true);

drop policy if exists evaluations_write on public.evaluations;
create policy evaluations_write on public.evaluations
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id));

-- ---------------------------------------------------------------------------
-- Deliberately left as-is (broad read + authenticated write), to keep the
-- existing learner experience working:
--   enrollments, quiz_attempts, exam_attempts, typing_tests,
--   announcements, settings.
-- See docs/BACKEND.md "Security considerations" for the rationale.
-- ---------------------------------------------------------------------------

-- ###########################################################################
-- ## supabase/migrations/019_trainer_management.sql
-- ###########################################################################
-- ===========================================================================
-- 019_trainer_management.sql
-- ---------------------------------------------------------------------------
-- Controlled specializations + many-to-many trainer <-> program assignments.
--
--   specializations   : the controlled list of trainer specializations
--                       (the database is the source of truth, not the UI).
--   trainer_programs  : one row per (trainer, program) assignment.
--
-- The existing LMS stores a single `programs.trainer_id` (primary trainer) and
-- a `user.programs` array inside jsonb. trainer_programs is the AUTHORITATIVE
-- many-to-many model used for access control; the legacy fields are kept for
-- frontend display only and are backfilled here.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. specializations
-- ---------------------------------------------------------------------------
create table if not exists public.specializations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.specializations enable row level security;

drop trigger if exists specializations_touch_updated_at on public.specializations;
create trigger specializations_touch_updated_at
  before update on public.specializations
  for each row execute function public.touch_updated_at();

-- Seed the controlled list (upsert by slug so re-running is safe).
insert into public.specializations (name, slug, sort_order) values
  ('Housekeeping',       'housekeeping',       1),
  ('Barista',            'barista',            2),
  ('Hilot / Massage',    'hilot-massage',      3),
  ('Event Management',   'event-management',   4),
  ('Virtual Assistant',  'virtual-assistant',  5),
  ('Bookkeeping',        'bookkeeping',        6),
  ('Multiple Programs',  'multiple-programs',  7),
  ('Other',              'other',              99)
on conflict (slug) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- RLS: everyone authenticated can read the list; only Super Admin may change it.
drop policy if exists specializations_select on public.specializations;
create policy specializations_select on public.specializations
  for select to authenticated using (true);

drop policy if exists specializations_write on public.specializations;
create policy specializations_write on public.specializations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Link profiles.specialization_id -> specializations.id
do $$
begin
  alter table public.profiles
    add constraint profiles_specialization_id_fkey
    foreign key (specialization_id) references public.specializations(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. trainer_programs  (many-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.trainer_programs (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  text not null references public.profiles(id) on delete cascade,
  program_id  text not null references public.programs(id) on delete cascade,
  assigned_by text references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  status      text not null default 'active',
  unique (trainer_id, program_id)
);

do $$
begin
  alter table public.trainer_programs
    add constraint trainer_programs_status_check
    check (status in ('active', 'inactive', 'revoked'));
exception when duplicate_object then null;
end $$;

create index if not exists trainer_programs_trainer_idx on public.trainer_programs (trainer_id);
create index if not exists trainer_programs_program_idx on public.trainer_programs (program_id);

alter table public.trainer_programs enable row level security;

-- RLS: a trainer may READ only their own assignments. Only Super Admin writes.
drop policy if exists trainer_programs_select on public.trainer_programs;
create policy trainer_programs_select on public.trainer_programs
  for select to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id());

drop policy if exists trainer_programs_write on public.trainer_programs;
create policy trainer_programs_write on public.trainer_programs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 3. Backfill trainer_programs from the legacy programs.trainer_id
-- ---------------------------------------------------------------------------
insert into public.trainer_programs (trainer_id, program_id, status)
select p.trainer_id, p.id, 'active'
  from public.programs p
  join public.profiles pr on pr.id = p.trainer_id and pr.role = 'trainer'
 where p.trainer_id is not null
on conflict (trainer_id, program_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. GRANTS
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.specializations  to authenticated;
grant select, insert, update, delete on public.trainer_programs to authenticated;

-- ###########################################################################
-- ## supabase/migrations/020_trainer_invitations.sql
-- ###########################################################################
-- ===========================================================================
-- 020_trainer_invitations.sql
-- ---------------------------------------------------------------------------
-- Trainer invitation / activation.
--
-- SECURITY
--   We deliberately lean on Supabase Auth's own secure invitation + password
--   recovery links. The raw activation link is generated server-side by the
--   Auth Admin API and is NEVER stored here. If a custom token were ever
--   required, only its SHA-256 hash would live in `token_hash` -- never the
--   raw value.
--
--   This table is the audit/state trail for invitations:
--     invitation_status : pending | sent | activated | expired | revoked | failed
--     sent_at / expires_at / activated_at
-- ===========================================================================

create table if not exists public.trainer_invitations (
  id                uuid primary key default gen_random_uuid(),
  trainer_id        text not null references public.profiles(id) on delete cascade,
  email             text not null,
  token_hash        text,                       -- only if a custom token is used
  invitation_status text not null default 'pending',
  provider          text not null default 'supabase_auth',
  expires_at        timestamptz,
  sent_at           timestamptz,
  used_at           timestamptz,
  activated_at      timestamptz,
  created_by        text references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  metadata          jsonb not null default '{}'::jsonb
);

do $$
begin
  alter table public.trainer_invitations
    add constraint trainer_invitations_status_check
    check (invitation_status in ('pending','sent','activated','expired','revoked','failed'));
exception when duplicate_object then null;
end $$;

create index if not exists trainer_invitations_trainer_idx on public.trainer_invitations (trainer_id);
create index if not exists trainer_invitations_email_idx   on public.trainer_invitations (lower(email));

-- At most ONE live (unused, not revoked) invitation per trainer at a time.
create unique index if not exists trainer_invitations_active_unique
  on public.trainer_invitations (trainer_id)
  where used_at is null and invitation_status in ('pending', 'sent');

alter table public.trainer_invitations enable row level security;

-- RLS: Super Admin sees everything; a trainer may see their own invitation rows.
drop policy if exists trainer_invitations_select on public.trainer_invitations;
create policy trainer_invitations_select on public.trainer_invitations
  for select to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id());

-- All writes happen through SECURITY DEFINER functions / Edge Functions only.
-- (No insert/update/delete policy => no direct client writes.)

-- ---------------------------------------------------------------------------
-- Activation: when a pending trainer confirms their email or sets a password,
-- flip the profile to active. This runs on auth.users UPDATE so it works even
-- though the existing frontend has no dedicated activation screen.
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user_activation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile_id text;
begin
  -- Activation signals: email just confirmed, or password just (re)set.
  if (new.email_confirmed_at is not null and old.email_confirmed_at is null)
     or (new.encrypted_password is distinct from old.encrypted_password) then

    select id into v_profile_id
      from public.profiles
     where auth_user_id = new.id
       and status = 'pending_activation'
     limit 1;

    if v_profile_id is not null then
      update public.profiles
         set status = 'active', is_activated = true, updated_at = now()
       where id = v_profile_id;

      update public.trainer_invitations
         set invitation_status = 'activated',
             used_at = now(),
             activated_at = now()
       where trainer_id = v_profile_id
         and used_at is null;

      insert into public.audit_logs (user_id, actor_profile_id, action, target_type, target_id, metadata)
      values (new.id, v_profile_id, 'TRAINER_ACTIVATED', 'trainer', v_profile_id,
              jsonb_build_object('email', new.email));
    end if;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_activation on auth.users;
create trigger on_auth_user_activation
  after update on auth.users
  for each row execute function public.handle_auth_user_activation();

-- ---------------------------------------------------------------------------
-- activate_my_account()
--   Fallback the frontend may call immediately after a trainer sets their own
--   password. Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.activate_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1;

  if v_profile.id is null then
    raise exception 'No profile is linked to the current account.' using errcode = '42501';
  end if;

  if v_profile.role <> 'trainer' then
    raise exception 'Only trainer accounts can be activated through this endpoint.' using errcode = '42501';
  end if;

  if v_profile.status <> 'pending_activation' then
    return jsonb_build_object('ok', true, 'status', v_profile.status, 'already_active', true);
  end if;

  update public.profiles
     set status = 'active', is_activated = true, updated_at = now()
   where id = v_profile.id;

  update public.trainer_invitations
     set invitation_status = 'activated', used_at = now(), activated_at = now()
   where trainer_id = v_profile.id and used_at is null;

  insert into public.audit_logs (user_id, actor_profile_id, action, target_type, target_id, metadata)
  values (auth.uid(), v_profile.id, 'TRAINER_ACTIVATED', 'trainer', v_profile.id,
          jsonb_build_object('self_service', true));

  return jsonb_build_object('ok', true, 'status', 'active');
end $$;

grant execute on function public.activate_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant select on public.trainer_invitations to authenticated;

-- ###########################################################################
-- ## supabase/migrations/021_audit_logs.sql
-- ###########################################################################
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

-- ###########################################################################
-- ## supabase/migrations/022_super_admin_mfa.sql
-- ###########################################################################
-- ===========================================================================
-- 022_super_admin_mfa.sql
-- ---------------------------------------------------------------------------
-- 1. Promote the designated Super Admin account
--       globalinstitutehyt@gmail.com
-- 2. Demote any other Super Admin left over from the original seed.
-- 3. Harden the legacy admin RPCs so they require Super Admin + MFA (AAL2).
-- 4. Expose a small MFA status RPC.
--
-- IMPORTANT: no password is ever written here. The Auth account must already
-- exist (create it with scripts/create-super-admin.mjs, the Dashboard, or the
-- create-user Edge Function). This migration only links the profile.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 + 2. Designated Super Admin
-- ---------------------------------------------------------------------------
do $$
declare
  v_email text := 'globalinstitutehyt@gmail.com';
  v_uid   uuid;
  v_has_provider_id boolean;
begin
  select id into v_uid from auth.users where lower(email) = v_email limit 1;

  if v_uid is null then
    raise notice '[022] Auth user % does not exist yet. Create it, then re-run this migration to link the Super Admin profile.', v_email;
    return;
  end if;

  -- Ensure the profile exists and is a full Super Admin.
  insert into public.profiles (id, auth_user_id, role, email, name, status, is_activated, mfa_enforced, data)
  values (
    'sa-hyt', v_uid, 'admin', v_email, 'Super Administrator', 'active', true, true,
    jsonb_build_object('position', 'Super Administrator', 'since', to_char(now(), 'YYYY-MM-DD'))
  )
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        role         = 'admin',
        email        = v_email,
        status       = 'active',
        is_activated = true,
        mfa_enforced = true,
        updated_at   = now();

  -- If a profile already exists for this auth user under a different id, fix it.
  update public.profiles
     set role = 'admin', status = 'active', is_activated = true, mfa_enforced = true, updated_at = now()
   where auth_user_id = v_uid;

  -- Demote every other account that still holds a Super Admin role.
  update public.profiles
     set role = 'trainee', status = 'inactive', is_activated = false, mfa_enforced = false, updated_at = now()
   where role in ('admin', 'super_admin')
     and lower(coalesce(email, '')) <> v_email;

  raise notice '[022] Super Admin linked to profile for %.', v_email;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Harden the legacy admin RPCs (Super Admin + AAL2 required)
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_user(
  p_email    text,
  p_password text,
  p_role     text,
  p_id       text,
  p_name     text,
  p_data     jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid             uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can create accounts.' using errcode = '42501';
  end if;

  perform public.require_mfa();

  if coalesce(p_email, '') = '' then
    raise exception 'Email is required.';
  end if;
  if coalesce(p_password, '') = '' then
    raise exception 'Password is required.';
  end if;
  if p_role not in ('super_admin', 'admin', 'trainer', 'trainee') then
    raise exception 'Invalid role: %', p_role;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'name', p_name),
    '', '', '', ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  end if;

  insert into public.profiles (id, auth_user_id, role, email, name, data, status, is_activated)
  values (p_id, v_uid, p_role, lower(p_email), p_name, coalesce(p_data, '{}'::jsonb),
          case when p_role = 'trainer' then 'pending_activation' else 'active' end,
          case when p_role = 'trainer' then false else true end)
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        role         = excluded.role,
        email        = excluded.email,
        name         = excluded.name,
        data         = excluded.data,
        updated_at   = now();

  perform public.write_audit(
    'ACCOUNT_CREATED', p_role, p_id,
    jsonb_build_object('email', lower(p_email), 'role', p_role)
  );

  return p_id;
end $$;

create or replace function public.admin_delete_user(p_id text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can delete accounts.' using errcode = '42501';
  end if;

  perform public.require_mfa();

  if p_id = public.current_profile_id() then
    raise exception 'You cannot delete your own account.' using errcode = '42501';
  end if;

  select auth_user_id into v_uid from public.profiles where id = p_id;

  perform public.write_audit('ACCOUNT_DELETED', 'account', p_id, jsonb_build_object('auth_user_id', v_uid));

  delete from public.profiles where id = p_id;
  if v_uid is not null then
    delete from auth.users where id = v_uid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. MFA status RPC
-- ---------------------------------------------------------------------------
create or replace function public.admin_mfa_status()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'is_super_admin',     public.is_super_admin(),
    'mfa_enforced',       coalesce((select mfa_enforced from public.profiles where auth_user_id = auth.uid() limit 1), false),
    'mfa_enrolled',       public.has_verified_mfa_factor(),
    'current_aal',        public.current_aal(),
    'mfa_satisfied',      public.mfa_satisfied(),
    'can_manage_trainers', public.is_super_admin() and public.mfa_satisfied()
  )
$$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
revoke all on function public.admin_create_user(text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.admin_delete_user(text) from public, anon;
revoke all on function public.admin_mfa_status() from public, anon;

grant execute on function public.admin_create_user(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_delete_user(text) to authenticated;
grant execute on function public.admin_mfa_status() to authenticated;

-- ###########################################################################
-- ## supabase/migrations/023_trainer_rpcs.sql
-- ###########################################################################
-- ===========================================================================
-- 023_trainer_rpcs.sql
-- ---------------------------------------------------------------------------
-- Trainer-management RPCs. Every RPC:
--   * derives the caller from auth.uid() (never trusts the frontend),
--   * requires is_super_admin() AND MFA (AAL2) via require_super_admin_mfa(),
--   * is transactional (a plpgsql function is a single transaction), so a
--     failure leaves no partially created trainer,
--   * writes an audit_logs row.
--
-- The *_record / *_sent functions are internal helpers callable only by the
-- service_role (used by the Edge Functions). They are revoked from clients.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Shared guard
-- ---------------------------------------------------------------------------
create or replace function public.require_super_admin_mfa()
returns void
language plpgsql
stable
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can perform this operation.' using errcode = '42501';
  end if;
  perform public.require_mfa();
end $$;

revoke all on function public.require_super_admin_mfa() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: create the auth user (+ identity). Returns the new auth uid.
-- ---------------------------------------------------------------------------
create or replace function public._create_auth_user(p_email text, p_password text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    coalesce(p_meta, '{}'::jsonb),
    '', '', '', ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  end if;

  return v_uid;
end $$;

revoke all on function public._create_auth_user(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: write profile + assignments + invitation + audit atomically.
-- Callable by the Super Admin RPC and (via service_role) the Edge Functions.
-- ---------------------------------------------------------------------------
create or replace function public.admin_finalize_trainer(
  p_auth_user_id     uuid,
  p_trainer_id       text,
  p_email            text,
  p_full_name        text,
  p_position         text,
  p_specialization_id uuid,
  p_address          text,
  p_phone            text,
  p_programs         text[],
  p_actor_profile_id text,
  p_invitation_status text default 'pending',
  p_expires_at       timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email      text := lower(trim(coalesce(p_email, '')));
  v_trainer_id text := coalesce(nullif(p_trainer_id, ''), 'tr-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_program    text;
  v_inv_id     uuid;
  v_expires    timestamptz := coalesce(p_expires_at, now() + interval '7 days');
  v_spec_name  text;
  v_assigned   text[] := '{}';
begin
  if v_email = '' then
    raise exception 'Email is required.';
  end if;

  if p_specialization_id is not null then
    select name into v_spec_name from public.specializations where id = p_specialization_id and is_active;
    if v_spec_name is null then
      raise exception 'Unknown or inactive specialization.';
    end if;
  end if;

  insert into public.profiles (
    id, auth_user_id, role, email, name, first_name, last_name,
    position, specialization, specialization_id, address, phone,
    status, is_activated, mfa_enforced, data
  ) values (
    v_trainer_id, p_auth_user_id, 'trainer', v_email,
    coalesce(nullif(trim(p_full_name), ''), v_email),
    nullif(split_part(coalesce(p_full_name, ''), ' ', 1), ''),
    nullif(trim(substr(coalesce(p_full_name, ''), length(split_part(coalesce(p_full_name, ''), ' ', 1)) + 1)), ''),
    p_position, v_spec_name, p_specialization_id, p_address, p_phone,
    'pending_activation', false, false,
    jsonb_build_object(
      'position', p_position,
      'specialization', v_spec_name,
      'address', p_address,
      'phone', p_phone,
      'programs', coalesce(p_programs, '{}'),
      'since', to_char(now(), 'YYYY-MM-DD')
    )
  );

  -- Program assignments
  if p_programs is not null then
    foreach v_program in array p_programs loop
      if not exists (select 1 from public.programs where id = v_program) then
        raise exception 'Unknown program: %', v_program;
      end if;
      insert into public.trainer_programs (trainer_id, program_id, assigned_by, status)
      values (v_trainer_id, v_program, p_actor_profile_id, 'active')
      on conflict (trainer_id, program_id) do update set status = 'active';
      v_assigned := array_append(v_assigned, v_program);
    end loop;
  end if;

  -- Invitation record
  insert into public.trainer_invitations (trainer_id, email, invitation_status, provider, expires_at, created_by, metadata)
  values (v_trainer_id, v_email, coalesce(p_invitation_status, 'pending'), 'supabase_auth', v_expires, p_actor_profile_id,
          jsonb_build_object('programs', coalesce(p_programs, '{}')))
  returning id into v_inv_id;

  -- Audit
  perform public.write_audit('TRAINER_CREATED', 'trainer', v_trainer_id,
    jsonb_build_object('email', v_email, 'position', p_position, 'specialization', v_spec_name, 'programs', v_assigned),
    p_actor_profile_id);

  return jsonb_build_object(
    'trainer_id', v_trainer_id,
    'email', v_email,
    'invitation_id', v_inv_id,
    'invitation_status', coalesce(p_invitation_status, 'pending'),
    'expires_at', v_expires
  );
end $$;

-- Client RPC calls it as a definer; service_role calls it directly.
revoke all on function public.admin_finalize_trainer(uuid, text, text, text, text, uuid, text, text, text[], text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_finalize_trainer(uuid, text, text, text, text, uuid, text, text, text[], text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- admin_create_trainer(...)  -- browser-callable (anon key), Super Admin + MFA
--   Creates the auth account with a securely generated temporary password,
--   the trainer profile (pending_activation), the program assignments and the
--   invitation record. Returns the temp password ONCE to the authenticated
--   Super Admin (it is never persisted in plaintext).
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_trainer(
  p_full_name         text,
  p_email             text,
  p_position          text default null,
  p_specialization_id uuid default null,
  p_address           text default null,
  p_phone             text default null,
  p_programs          text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_temp     text;
  v_uid      uuid;
  v_result   jsonb;
begin
  perform public.require_super_admin_mfa();

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Full name is required.';
  end if;

  -- Uniqueness (profiles.email is UNIQUE; auth.users is the source of truth).
  if exists (select 1 from public.profiles where lower(email) = v_email)
     or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An account with email % already exists.', v_email;
  end if;

  v_temp := public.generate_temp_password(12);
  v_uid  := public._create_auth_user(
              v_email, v_temp,
              jsonb_build_object('role', 'trainer', 'name', p_full_name, 'must_set_password', true)
            );

  v_result := public.admin_finalize_trainer(
    v_uid, null, v_email, p_full_name, p_position, p_specialization_id,
    p_address, p_phone, coalesce(p_programs, '{}'), public.current_profile_id(),
    'pending', now() + interval '7 days'
  );

  return v_result || jsonb_build_object('temp_password', v_temp);
end $$;

-- ---------------------------------------------------------------------------
-- admin_update_trainer(...)  -- edit profile fields + reconcile assignments
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_trainer(
  p_trainer_id        text,
  p_full_name         text default null,
  p_position          text default null,
  p_specialization_id uuid default null,
  p_address           text default null,
  p_phone             text default null,
  p_programs          text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    text := public.current_profile_id();
  v_spec     text;
  v_program  text;
  v_removed  text[];
  v_added    text[];
begin
  perform public.require_super_admin_mfa();

  if not exists (select 1 from public.profiles where id = p_trainer_id and role = 'trainer') then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;

  if p_specialization_id is not null then
    select name into v_spec from public.specializations where id = p_specialization_id and is_active;
    if v_spec is null then
      raise exception 'Unknown or inactive specialization.';
    end if;
  end if;

  update public.profiles
     set name            = coalesce(nullif(trim(p_full_name), ''), name),
         first_name      = coalesce(nullif(split_part(coalesce(p_full_name, ''), ' ', 1), ''), first_name),
         last_name       = coalesce(nullif(trim(substr(coalesce(p_full_name, ''), length(split_part(coalesce(p_full_name, ''), ' ', 1)) + 1)), ''), last_name),
         position        = coalesce(p_position, position),
         specialization  = coalesce(v_spec, specialization),
         specialization_id = coalesce(p_specialization_id, specialization_id),
         address         = coalesce(p_address, address),
         phone           = coalesce(p_phone, phone),
         updated_at      = now()
   where id = p_trainer_id;

  if p_programs is not null then
    -- Programs to remove
    select array_agg(program_id) into v_removed
      from public.trainer_programs
     where trainer_id = p_trainer_id
       and program_id <> all (p_programs);

    delete from public.trainer_programs
     where trainer_id = p_trainer_id
       and program_id <> all (p_programs);

    -- Programs to add / keep
    foreach v_program in array p_programs loop
      if not exists (select 1 from public.programs where id = v_program) then
        raise exception 'Unknown program: %', v_program;
      end if;
      insert into public.trainer_programs (trainer_id, program_id, assigned_by, status)
      values (p_trainer_id, v_program, v_actor, 'active')
      on conflict (trainer_id, program_id) do update set status = 'active', assigned_by = v_actor;
    end loop;

    select coalesce(array_agg(program_id), '{}') into v_added
      from public.trainer_programs where trainer_id = p_trainer_id;

    if v_removed is not null and array_length(v_removed, 1) > 0 then
      perform public.write_audit('TRAINER_PROGRAM_REMOVED', 'trainer', p_trainer_id,
        jsonb_build_object('programs', v_removed));
    end if;
    perform public.write_audit('TRAINER_PROGRAM_ASSIGNED', 'trainer', p_trainer_id,
      jsonb_build_object('programs', v_added));
  end if;

  perform public.write_audit('TRAINER_UPDATED', 'trainer', p_trainer_id,
    jsonb_build_object('position', p_position, 'specialization', v_spec));

  return public.admin_get_trainer(p_trainer_id);
end $$;

-- ---------------------------------------------------------------------------
-- admin_set_trainer_status(...)  -- activate / suspend / deactivate
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_trainer_status(
  p_trainer_id text,
  p_status     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  perform public.require_super_admin_mfa();

  if p_status not in ('active', 'inactive', 'suspended', 'pending_activation') then
    raise exception 'Invalid status: %', p_status;
  end if;

  if not exists (select 1 from public.profiles where id = p_trainer_id and role = 'trainer') then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;

  update public.profiles
     set status       = p_status,
         is_activated = (p_status = 'active'),
         updated_at   = now()
   where id = p_trainer_id;

  v_action := case p_status
                when 'suspended' then 'TRAINER_SUSPENDED'
                when 'inactive'  then 'TRAINER_DEACTIVATED'
                when 'active'    then 'TRAINER_REACTIVATED'
                else 'TRAINER_UPDATED'
              end;

  perform public.write_audit(v_action, 'trainer', p_trainer_id, jsonb_build_object('status', p_status));

  return public.admin_get_trainer(p_trainer_id);
end $$;

-- ---------------------------------------------------------------------------
-- admin_resend_trainer_invitation(...)  -- revoke previous, issue a new one
-- ---------------------------------------------------------------------------
create or replace function public.admin_resend_trainer_invitation(p_trainer_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  text := public.current_profile_id();
  v_email  text;
  v_status text;
  v_id     uuid;
  v_exp    timestamptz := now() + interval '7 days';
begin
  perform public.require_super_admin_mfa();

  select email, status into v_email, v_status
    from public.profiles where id = p_trainer_id and role = 'trainer';

  if v_email is null then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;
  if v_status = 'active' then
    raise exception 'Trainer % has already activated their account.', p_trainer_id;
  end if;

  -- Invalidate any live invitation.
  update public.trainer_invitations
     set invitation_status = 'revoked', used_at = now()
   where trainer_id = p_trainer_id and used_at is null;

  insert into public.trainer_invitations (trainer_id, email, invitation_status, provider, expires_at, created_by)
  values (p_trainer_id, lower(v_email), 'pending', 'supabase_auth', v_exp, v_actor)
  returning id into v_id;

  perform public.write_audit('TRAINER_INVITATION_RESENT', 'trainer', p_trainer_id,
    jsonb_build_object('email', lower(v_email), 'expires_at', v_exp));

  return jsonb_build_object('trainer_id', p_trainer_id, 'email', lower(v_email),
                            'invitation_id', v_id, 'expires_at', v_exp);
end $$;

-- ---------------------------------------------------------------------------
-- admin_get_trainer(...)  -- read model for the Super Admin UI / contract
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_trainer(p_trainer_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'name', p.name,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'position', p.position,
    'specialization', p.specialization,
    'specialization_id', p.specialization_id,
    'address', p.address,
    'phone', p.phone,
    'status', p.status,
    'is_activated', p.is_activated,
    'role', p.role,
    'created_at', p.created_at,
    'programs', coalesce((
      select jsonb_agg(jsonb_build_object('id', tp.program_id, 'status', tp.status, 'assigned_at', tp.assigned_at)
                       order by tp.program_id)
        from public.trainer_programs tp
       where tp.trainer_id = p.id and tp.status = 'active'
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ti.id, 'status', ti.invitation_status, 'sent_at', ti.sent_at,
               'expires_at', ti.expires_at, 'activated_at', ti.activated_at, 'created_at', ti.created_at)
               order by ti.created_at desc)
        from public.trainer_invitations ti
       where ti.trainer_id = p.id
    ), '[]'::jsonb)
  )
  from public.profiles p
 where p.id = p_trainer_id
   and p.role = 'trainer'
   and (public.is_super_admin() or p.id = public.current_profile_id())
$$;

-- ---------------------------------------------------------------------------
-- Service-role helpers used by the Edge Functions
-- ---------------------------------------------------------------------------
create or replace function public.admin_mark_invitation_sent(
  p_invitation_id uuid,
  p_status        text default 'sent',
  p_provider      text default 'supabase_auth'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trainer_invitations
     set invitation_status = case when p_status in ('sent','failed') then p_status else invitation_status end,
         sent_at = now(),
         provider = coalesce(p_provider, provider)
   where id = p_invitation_id;
end $$;

create or replace function public.admin_resend_invitation_record(
  p_trainer_id       text,
  p_actor_profile_id text,
  p_expires_at       timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_id    uuid;
  v_exp   timestamptz := coalesce(p_expires_at, now() + interval '7 days');
begin
  select email into v_email from public.profiles where id = p_trainer_id and role = 'trainer';
  if v_email is null then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;

  update public.trainer_invitations
     set invitation_status = 'revoked', used_at = now()
   where trainer_id = p_trainer_id and used_at is null;

  insert into public.trainer_invitations (trainer_id, email, invitation_status, provider, expires_at, created_by)
  values (p_trainer_id, lower(v_email), 'pending', 'supabase_auth', v_exp, p_actor_profile_id)
  returning id into v_id;

  perform public.write_audit('TRAINER_INVITATION_RESENT', 'trainer', p_trainer_id,
    jsonb_build_object('email', lower(v_email), 'expires_at', v_exp), p_actor_profile_id);

  return jsonb_build_object('trainer_id', p_trainer_id, 'email', lower(v_email),
                            'invitation_id', v_id, 'expires_at', v_exp);
end $$;

revoke all on function public.admin_mark_invitation_sent(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_resend_invitation_record(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_mark_invitation_sent(uuid, text, text) to service_role;
grant execute on function public.admin_resend_invitation_record(text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- GRANTS (client-callable RPCs self-check authorization internally)
-- ---------------------------------------------------------------------------
revoke all on function public.admin_create_trainer(text, text, text, uuid, text, text, text[]) from public, anon;
revoke all on function public.admin_update_trainer(text, text, text, uuid, text, text, text[]) from public, anon;
revoke all on function public.admin_set_trainer_status(text, text)                                 from public, anon;
revoke all on function public.admin_resend_trainer_invitation(text)                                from public, anon;
revoke all on function public.admin_get_trainer(text)                                              from public, anon;

grant execute on function public.admin_create_trainer(text, text, text, uuid, text, text, text[])      to authenticated;
grant execute on function public.admin_update_trainer(text, text, text, uuid, text, text, text[])      to authenticated;
grant execute on function public.admin_set_trainer_status(text, text)                                  to authenticated;
grant execute on function public.admin_resend_trainer_invitation(text)                                 to authenticated;
grant execute on function public.admin_get_trainer(text)                                               to authenticated;

-- ###########################################################################
-- ## supabase/migrations/024_mfa_settings.sql
-- ###########################################################################
-- ===========================================================================
-- 024_mfa_settings.sql
-- ---------------------------------------------------------------------------
-- Super Admin MFA on/off setting.
--
--   * mfa_enforced_for_current_user() -- the caller's own MFA requirement flag
--   * require_mfa()                    -- now only enforces when the flag is ON
--   * get_my_auth_state() / admin_mfa_status() -- report the flag
--   * admin_set_mfa_enforced(boolean)  -- the Settings toggle RPC
--
-- Behaviour:
--   MFA ON  (mfa_enforced = true)  -> sensitive RPCs require AAL2.
--   MFA OFF (mfa_enforced = false) -> sensitive RPCs accept the password
--                                     session (AAL1).
--
-- Security: turning MFA OFF while it is currently ON requires AAL2 (so a
-- stolen password alone cannot downgrade the account). Turning it ON requires
-- a verified authenticator factor to already be enrolled.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Is MFA enforced for the current user?
-- ---------------------------------------------------------------------------
create or replace function public.mfa_enforced_for_current_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select mfa_enforced from public.profiles where auth_user_id = auth.uid() limit 1),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- require_mfa() now honours the per-account flag.
-- ---------------------------------------------------------------------------
create or replace function public.require_mfa()
returns void
language plpgsql
stable
as $$
begin
  if public.mfa_enforced_for_current_user() and not public.mfa_satisfied() then
    raise exception 'Multi-factor authentication is required for this operation. Complete the MFA challenge and try again.'
      using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- get_my_auth_state() -- `requires_mfa` now follows the flag (not the role).
-- ---------------------------------------------------------------------------
create or replace function public.get_my_auth_state()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'profile_id',      p.id,
    'role',            p.role,
    'status',          p.status,
    'is_activated',    p.is_activated,
    'mfa_enforced',    p.mfa_enforced,
    'mfa_enrolled',    public.has_verified_mfa_factor(),
    'current_aal',     public.current_aal(),
    'mfa_satisfied',   public.mfa_satisfied(),
    'requires_mfa',    p.mfa_enforced and not public.mfa_satisfied()
  )
  from public.profiles p
 where p.auth_user_id = auth.uid()
 limit 1
$$;

-- ---------------------------------------------------------------------------
-- admin_mfa_status() -- reflect the flag.
-- ---------------------------------------------------------------------------
create or replace function public.admin_mfa_status()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'is_super_admin',      public.is_super_admin(),
    'mfa_enforced',        public.mfa_enforced_for_current_user(),
    'mfa_enrolled',        public.has_verified_mfa_factor(),
    'current_aal',         public.current_aal(),
    'mfa_satisfied',       public.mfa_satisfied(),
    'can_manage_trainers', public.is_super_admin()
                           and (not public.mfa_enforced_for_current_user() or public.mfa_satisfied())
  )
$$;

-- ---------------------------------------------------------------------------
-- admin_set_mfa_enforced(enabled) -- the Settings toggle.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_mfa_enforced(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id text := public.current_profile_id();
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can change MFA settings.' using errcode = '42501';
  end if;

  if p_enabled then
    -- Must have a verified authenticator factor first.
    if not public.has_verified_mfa_factor() then
      raise exception 'Enrol and verify an authenticator app before enabling MFA.' using errcode = '42501';
    end if;

    update public.profiles
       set mfa_enforced = true, updated_at = now()
     where auth_user_id = auth.uid();

    perform public.write_audit('MFA_ENABLED', 'profile', v_profile_id, '{}'::jsonb);
  else
    -- Turning MFA off while it is on requires AAL2 (prevents a password-only
    -- downgrade) — but only when an authenticator is actually enrolled, so an
    -- account that is enforced-but-not-yet-enrolled can never be locked out.
    if public.mfa_enforced_for_current_user() and public.has_verified_mfa_factor() then
      perform public.require_mfa();
    end if;

    update public.profiles
       set mfa_enforced = false, updated_at = now()
     where auth_user_id = auth.uid();

    perform public.write_audit('MFA_DISABLED', 'profile', v_profile_id, '{}'::jsonb);
  end if;

  return public.get_my_auth_state();
end $$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
revoke all on function public.mfa_enforced_for_current_user() from public, anon;
revoke all on function public.admin_set_mfa_enforced(boolean)  from public, anon;

grant execute on function public.mfa_enforced_for_current_user() to authenticated;
grant execute on function public.admin_set_mfa_enforced(boolean) to authenticated;

-- ###########################################################################
-- ## supabase/migrations/025_trainer_email_metadata.sql
-- ###########################################################################
-- ===========================================================================
-- 025_trainer_email_metadata.sql
-- ---------------------------------------------------------------------------
-- Store the temporary password in the new trainer's user_metadata so the
-- branded Supabase Auth "Reset Password" email can render it via
-- {{ .Data.temp_password }}.
--
-- Only TRAINER accounts receive the extra metadata field; every other role
-- keeps its previous metadata untouched. The value is the account's own
-- short-lived temporary password (changed on first sign-in).
-- ===========================================================================
create or replace function public.admin_create_user(
  p_email    text,
  p_password text,
  p_role     text,
  p_id       text,
  p_name     text,
  p_data     jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid             uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can create accounts.' using errcode = '42501';
  end if;

  perform public.require_mfa();

  if coalesce(p_email, '') = '' then
    raise exception 'Email is required.';
  end if;
  if coalesce(p_password, '') = '' then
    raise exception 'Password is required.';
  end if;
  if p_role not in ('super_admin', 'admin', 'trainer', 'trainee') then
    raise exception 'Invalid role: %', p_role;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'name', p_name)
      || case
           when p_role = 'trainer'
             then jsonb_build_object('temp_password', p_password, 'must_set_password', true)
           else '{}'::jsonb
         end,
    '', '', '', ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  end if;

  insert into public.profiles (id, auth_user_id, role, email, name, data, status, is_activated)
  values (p_id, v_uid, p_role, lower(p_email), p_name, coalesce(p_data, '{}'::jsonb),
          case when p_role = 'trainer' then 'pending_activation' else 'active' end,
          case when p_role = 'trainer' then false else true end)
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        role         = excluded.role,
        email        = excluded.email,
        name         = excluded.name,
        data         = excluded.data,
        updated_at   = now();

  perform public.write_audit(
    'ACCOUNT_CREATED', p_role, p_id,
    jsonb_build_object('email', lower(p_email), 'role', p_role)
  );

  return p_id;
end $$;

-- ###########################################################################
-- ## supabase/migrations/026_trainer_ratings.sql
-- ###########################################################################
-- ===========================================================================
-- 026_trainer_ratings.sql
-- ---------------------------------------------------------------------------
-- Trainee -> trainer ratings (5 stars + optional comment).
--
-- Why: a trainer's rating used to be a static number the Super Admin typed in
-- the Add/Edit Trainer form (persisted in profiles.data.rating). That is being
-- replaced: trainees rate their trainer, and every rating shown in the app is a
-- derived average of these rows. This migration also strips the legacy field.
--
-- Shape mirrors the other collections (evaluations, attendance, ...): a few
-- scalar columns plus a `data` jsonb for the nested parts (rating, comment,
-- date). One row per (trainee, trainer) — re-rating updates the same row.
--
-- RLS is author-scoped: a trainee may only write their own row; reads are broad
-- so the shared UI (admin dashboards, trainer self-view) can compute averages.
-- ===========================================================================

create table if not exists public.trainer_ratings (
  id         text primary key,
  trainee_id text references public.profiles(id) on delete cascade,
  trainer_id text references public.profiles(id) on delete cascade,
  program_id text,
  data       jsonb not null default '{}'::jsonb,
  unique (trainee_id, trainer_id)
);

-- The rating lives inside `data` jsonb; validate it when present. A missing
-- value yields NULL and passes (CHECK only fails on FALSE), so this is a guard,
-- not a NOT NULL.
do $$
begin
  alter table public.trainer_ratings
    add constraint trainer_ratings_rating_check
    check ((data->>'rating')::int between 1 and 5);
exception when duplicate_object then null;
end $$;

create index if not exists trainer_ratings_trainer_idx on public.trainer_ratings (trainer_id);
create index if not exists trainer_ratings_trainee_idx on public.trainer_ratings (trainee_id);

alter table public.trainer_ratings enable row level security;

-- Reads: broad (the average is shown in admin/trainer views).
drop policy if exists trainer_ratings_select on public.trainer_ratings;
create policy trainer_ratings_select on public.trainer_ratings
  for select to authenticated using (true);

-- Writes: a trainee authors only their own row. Upsert needs both the INSERT
-- and UPDATE policies; the Super Admin may also moderate.
drop policy if exists trainer_ratings_insert on public.trainer_ratings;
create policy trainer_ratings_insert on public.trainer_ratings
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists trainer_ratings_update on public.trainer_ratings;
create policy trainer_ratings_update on public.trainer_ratings
  for update to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin())
  with check (trainee_id = public.current_profile_id() or public.is_super_admin());

drop policy if exists trainer_ratings_delete on public.trainer_ratings;
create policy trainer_ratings_delete on public.trainer_ratings
  for delete to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin());

-- Baseline grants ran before this appended table existed, so grant explicitly
-- (same pattern as migration 019).
grant select, insert, update, delete on public.trainer_ratings to authenticated;

-- ---------------------------------------------------------------------------
-- Cleanup: drop the legacy admin-typed rating from profile data (now derived).
-- ---------------------------------------------------------------------------
update public.profiles set data = data - 'rating' where data ? 'rating';

-- ###########################################################################
-- ## supabase/migrations/027_self_service_password.sql
-- ###########################################################################
-- ===========================================================================
-- 027_self_service_password.sql
-- ---------------------------------------------------------------------------
-- Onboarding emails must read as "create your own password", not "reset
-- password". The branded Supabase Auth email (supabase/templates/recovery.html)
-- renders its onboarding copy when the account carries user_metadata
-- `must_set_password`. Migration 025 only set that flag for TRAINERS, so
-- trainees fell through to the "Reset your password" branch — which is the bug
-- this migration fixes.
--
-- It also drops the `temp_password` metadata: the onboarding email no longer
-- prints a temporary password, because the recipient now sets their own from
-- the emailed link (which lands on /welcome and sends them to their dashboard).
--
-- Scope: TRAINER and TRAINEE accounts get the flag; admin accounts do not.
-- Only redefines admin_create_user(); the signature is unchanged, so no GRANT
-- changes are needed.
-- ===========================================================================

create or replace function public.admin_create_user(
  p_email    text,
  p_password text,
  p_role     text,
  p_id       text,
  p_name     text,
  p_data     jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid             uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can create accounts.' using errcode = '42501';
  end if;

  perform public.require_mfa();

  if coalesce(p_email, '') = '' then
    raise exception 'Email is required.';
  end if;
  if coalesce(p_password, '') = '' then
    raise exception 'Password is required.';
  end if;
  if p_role not in ('super_admin', 'admin', 'trainer', 'trainee') then
    raise exception 'Invalid role: %', p_role;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'name', p_name)
      || case
           when p_role in ('trainer', 'trainee')
             then jsonb_build_object('must_set_password', true)
           else '{}'::jsonb
         end,
    '', '', '', ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  end if;

  insert into public.profiles (id, auth_user_id, role, email, name, data, status, is_activated)
  values (p_id, v_uid, p_role, lower(p_email), p_name, coalesce(p_data, '{}'::jsonb),
          case when p_role = 'trainer' then 'pending_activation' else 'active' end,
          case when p_role = 'trainer' then false else true end)
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        role         = excluded.role,
        email        = excluded.email,
        name         = excluded.name,
        data         = excluded.data,
        updated_at   = now();

  perform public.write_audit(
    'ACCOUNT_CREATED', p_role, p_id,
    jsonb_build_object('email', lower(p_email), 'role', p_role)
  );

  return p_id;
end $$;

-- ###########################################################################
-- ## supabase/migrations/028_mfa_no_lockout.sql
-- ###########################################################################
-- ===========================================================================
-- 028_mfa_no_lockout.sql
-- ---------------------------------------------------------------------------
-- require_mfa() must not lock out an account that is MFA-enforced but has NO
-- verified authenticator enrolled. Such a session can never reach AAL2, so a
-- hard block makes every protected RPC (admin_create_user, admin_delete_user,
-- …) fail permanently — which is exactly what happens right after a Super
-- Admin resets/deletes their own authenticator (mfa_enforced stays true while
-- the factor is gone).
--
-- Enforcement now applies only while a verified factor actually exists, which
-- mirrors the no-lockout guard already used by admin_set_mfa_enforced(false):
--   * enforced + enrolled + AAL1  -> blocked (MFA challenge required)
--   * enforced + NOT enrolled      -> allowed (nothing to challenge)
--   * not enforced                 -> allowed
--
-- Only redefines require_mfa(); the signature is unchanged, so no GRANT
-- changes are needed.
-- ===========================================================================

create or replace function public.require_mfa()
returns void
language plpgsql
stable
as $$
begin
  if public.mfa_enforced_for_current_user()
     and public.has_verified_mfa_factor()
     and not public.mfa_satisfied() then
    raise exception 'Multi-factor authentication is required for this operation. Complete the MFA challenge and try again.'
      using errcode = '42501';
  end if;
end $$;
-- ###########################################################################
-- ## supabase/migrations/042_trainer_feedback.sql
-- ###########################################################################
-- ============================================================================
-- 042_trainer_feedback.sql
-- ----------------------------------------------------------------------------
-- Qualitative trainee -> trainer feedback, submitted after the trainee
-- completes an enrollment. This is deliberately separate from
-- trainer_ratings (026): trainer_ratings is the 5-star average used in the
-- trainer directory, while this table stores the written evaluation that the
-- Super Admin reviews and exports.
--
-- One row per enrollment. A draft may exist (is_submitted = false) but the
-- public submission RPC writes a submitted row directly. Once submitted the
-- text is immutable; the only exception is the auditable Super Admin
-- correction path, which records the previous values in
-- trainer_feedback_revisions.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.trainer_feedback (
  id                     text primary key default ('tf-' || replace(gen_random_uuid()::text, '-', '')),
  trainee_id             text not null references public.profiles(id)    on delete restrict,
  trainer_id             text not null references public.profiles(id)    on delete restrict,
  program_id             text not null references public.programs(id)    on delete restrict,
  enrollment_id          text not null references public.enrollments(id) on delete restrict,
  feedback_text          text not null,
  learning_experience    text,
  trainer_strengths      text,
  areas_for_improvement  text,
  recommendation         text,
  rating                 smallint,
  is_submitted           boolean not null default true,
  submitted_at           timestamptz,
  corrected_at           timestamptz,
  corrected_by           text references public.profiles(id) on delete set null,
  correction_reason      text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- One feedback record per enrollment. Revisions are corrections of this row,
-- not additional rows, so the academic history stays one-to-one.
create unique index if not exists trainer_feedback_enrollment_key
  on public.trainer_feedback (enrollment_id);

create index if not exists trainer_feedback_trainer_idx
  on public.trainer_feedback (trainer_id, submitted_at desc);
create index if not exists trainer_feedback_trainee_idx
  on public.trainer_feedback (trainee_id, submitted_at desc);
create index if not exists trainer_feedback_program_idx
  on public.trainer_feedback (program_id, submitted_at desc);
create index if not exists trainer_feedback_submitted_idx
  on public.trainer_feedback (submitted_at desc)
  where is_submitted;

-- Constraints (added defensively so the migration can be re-run).
do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_rating_check
    check (rating is null or rating between 1 and 5);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_text_check
    check (length(btrim(feedback_text)) > 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_submitted_check
    check (not is_submitted or submitted_at is not null);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_no_self_check
    check (trainee_id <> trainer_id);
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Audit trail for corrections. The previous row is stored as JSON so the
-- original wording is never lost.
-- ----------------------------------------------------------------------------
create table if not exists public.trainer_feedback_revisions (
  id              uuid primary key default gen_random_uuid(),
  feedback_id     text not null references public.trainer_feedback(id) on delete restrict,
  previous_values jsonb not null,
  reason          text not null,
  corrected_by    text references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists trainer_feedback_revisions_feedback_idx
  on public.trainer_feedback_revisions (feedback_id, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
drop trigger if exists trainer_feedback_touch_updated_at on public.trainer_feedback;
create trigger trainer_feedback_touch_updated_at
  before update on public.trainer_feedback
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Immutability guard.
--   * DELETE is always rejected (history is preserved).
--   * Identity columns can never change.
--   * Once submitted, the trainee's original answers and submitted_at cannot
--     change through a normal UPDATE. The auditable correction RPC sets
--     app.feedback_correction = 'on' for its transaction.
-- ----------------------------------------------------------------------------
create or replace function public.protect_trainer_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Trainer feedback is part of the academic record and cannot be deleted.'
      using errcode = '42501';
  end if;

  -- Identity is immutable in every path.
  new.trainee_id    := old.trainee_id;
  new.trainer_id    := old.trainer_id;
  new.program_id    := old.program_id;
  new.enrollment_id := old.enrollment_id;
  new.created_at    := old.created_at;

  if coalesce(current_setting('app.feedback_correction', true), '') <> 'on' then
    if old.is_submitted then
      new.feedback_text         := old.feedback_text;
      new.learning_experience   := old.learning_experience;
      new.trainer_strengths     := old.trainer_strengths;
      new.areas_for_improvement := old.areas_for_improvement;
      new.recommendation        := old.recommendation;
      new.rating                := old.rating;
      new.is_submitted          := old.is_submitted;
      new.submitted_at          := old.submitted_at;
      new.corrected_at          := old.corrected_at;
      new.corrected_by          := old.corrected_by;
      new.correction_reason     := old.correction_reason;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trainer_feedback_immutable on public.trainer_feedback;
create trigger trainer_feedback_immutable
  before update or delete on public.trainer_feedback
  for each row execute function public.protect_trainer_feedback();

-- Direct DML is not granted: submission goes through
-- submit_trainer_feedback() and corrections through
-- admin_correct_trainer_feedback(). SELECT is granted for the RLS policies.
revoke all on public.trainer_feedback from anon, authenticated;
grant select on public.trainer_feedback to authenticated;

revoke all on public.trainer_feedback_revisions from anon, authenticated;
grant select on public.trainer_feedback_revisions to authenticated;

alter table public.trainer_feedback enable row level security;
alter table public.trainer_feedback_revisions enable row level security;
-- ###########################################################################
-- ## supabase/migrations/043_timed_assessment_fields.sql
-- ###########################################################################
-- ============================================================================
-- 043_timed_assessment_fields.sql
-- ----------------------------------------------------------------------------
-- Server-authoritative attempt clock and grading columns.
--
-- Existing rows are historical results: they get a status of 'graded' and
-- their score/total/percentage copied out of the legacy data jsonb. They do
-- NOT get an invented deadline (deadline_at stays NULL) because the old client
-- never recorded one. Only attempts started after this migration have a
-- server-issued deadline.
--
-- Safe to re-run: every backfill only touches rows whose column is still NULL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- quiz_attempts
-- ---------------------------------------------------------------------------
alter table public.quiz_attempts add column if not exists started_at             timestamptz;
alter table public.quiz_attempts add column if not exists deadline_at            timestamptz;
alter table public.quiz_attempts add column if not exists submitted_at           timestamptz;
alter table public.quiz_attempts add column if not exists time_limit_seconds     integer;
alter table public.quiz_attempts add column if not exists status                 text;
alter table public.quiz_attempts add column if not exists score                  integer;
alter table public.quiz_attempts add column if not exists total_questions        integer;
alter table public.quiz_attempts add column if not exists answered_questions     integer;
alter table public.quiz_attempts add column if not exists correct_answers        integer;
alter table public.quiz_attempts add column if not exists incorrect_answers      integer;
alter table public.quiz_attempts add column if not exists unanswered_questions   integer;
alter table public.quiz_attempts add column if not exists percentage             numeric(6,2);
alter table public.quiz_attempts add column if not exists auto_submitted         boolean not null default false;
alter table public.quiz_attempts add column if not exists created_at             timestamptz;
alter table public.quiz_attempts add column if not exists updated_at             timestamptz not null default now();

update public.quiz_attempts
   set status = 'graded'
 where status is null;

update public.quiz_attempts qa
   set started_at = coalesce(
         qa.started_at,
         nullif(qa.data->>'startedAt', '')::timestamptz
       ),
       submitted_at = coalesce(
         qa.submitted_at,
         nullif(qa.data->>'submittedAt', '')::timestamptz,
         nullif(qa.data->>'date', '')::date::timestamptz
       ),
       score = coalesce(
         qa.score,
         nullif(qa.data->>'score', '')::int,
         0
       ),
       total_questions = coalesce(
         qa.total_questions,
         nullif(qa.data->>'total', '')::int,
         case when jsonb_typeof(qa.data->'answers') = 'array'
              then jsonb_array_length(qa.data->'answers') else 0 end,
         0
       ),
       answered_questions = coalesce(
         qa.answered_questions,
         case when jsonb_typeof(qa.data->'answers') = 'array'
              then jsonb_array_length(qa.data->'answers') else 0 end,
         0
       ),
       correct_answers = coalesce(
         qa.correct_answers,
         nullif(qa.data->>'score', '')::int,
         0
       ),
       time_limit_seconds = coalesce(qa.time_limit_seconds, 1800),
       created_at = coalesce(
         qa.created_at,
         nullif(qa.data->>'submittedAt', '')::timestamptz,
         nullif(qa.data->>'date', '')::date::timestamptz,
         now()
       )
 where qa.status = 'graded';

update public.quiz_attempts qa
   set incorrect_answers = greatest(coalesce(qa.answered_questions, 0) - coalesce(qa.correct_answers, 0), 0),
       unanswered_questions = greatest(coalesce(qa.total_questions, 0) - coalesce(qa.answered_questions, 0), 0),
       percentage = coalesce(
         qa.percentage,
         case when coalesce(qa.total_questions, 0) > 0
              then round(coalesce(qa.correct_answers, 0) * 100.0 / qa.total_questions, 2)
              else 0 end
       )
 where qa.incorrect_answers is null
    or qa.unanswered_questions is null
    or qa.percentage is null;

alter table public.quiz_attempts alter column status             set default 'graded';
alter table public.quiz_attempts alter column status             set not null;
alter table public.quiz_attempts alter column score              set default 0;
alter table public.quiz_attempts alter column score              set not null;
alter table public.quiz_attempts alter column total_questions    set default 0;
alter table public.quiz_attempts alter column total_questions    set not null;
alter table public.quiz_attempts alter column answered_questions set default 0;
alter table public.quiz_attempts alter column answered_questions set not null;
alter table public.quiz_attempts alter column correct_answers    set default 0;
alter table public.quiz_attempts alter column correct_answers    set not null;
alter table public.quiz_attempts alter column incorrect_answers  set default 0;
alter table public.quiz_attempts alter column incorrect_answers  set not null;
alter table public.quiz_attempts alter column unanswered_questions set default 0;
alter table public.quiz_attempts alter column unanswered_questions set not null;
alter table public.quiz_attempts alter column created_at         set default now();
alter table public.quiz_attempts alter column created_at         set not null;

-- ---------------------------------------------------------------------------
-- exam_attempts (same shape)
-- ---------------------------------------------------------------------------
alter table public.exam_attempts add column if not exists started_at             timestamptz;
alter table public.exam_attempts add column if not exists deadline_at            timestamptz;
alter table public.exam_attempts add column if not exists submitted_at           timestamptz;
alter table public.exam_attempts add column if not exists time_limit_seconds     integer;
alter table public.exam_attempts add column if not exists status                 text;
alter table public.exam_attempts add column if not exists score                  integer;
alter table public.exam_attempts add column if not exists total_questions        integer;
alter table public.exam_attempts add column if not exists answered_questions     integer;
alter table public.exam_attempts add column if not exists correct_answers        integer;
alter table public.exam_attempts add column if not exists incorrect_answers      integer;
alter table public.exam_attempts add column if not exists unanswered_questions   integer;
alter table public.exam_attempts add column if not exists percentage             numeric(6,2);
alter table public.exam_attempts add column if not exists auto_submitted         boolean not null default false;
alter table public.exam_attempts add column if not exists created_at             timestamptz;
alter table public.exam_attempts add column if not exists updated_at             timestamptz not null default now();

update public.exam_attempts
   set status = 'graded'
 where status is null;

update public.exam_attempts ea
   set started_at = coalesce(
         ea.started_at,
         nullif(ea.data->>'startedAt', '')::timestamptz
       ),
       submitted_at = coalesce(
         ea.submitted_at,
         nullif(ea.data->>'submittedAt', '')::timestamptz,
         nullif(ea.data->>'date', '')::date::timestamptz
       ),
       score = coalesce(
         ea.score,
         nullif(ea.data->>'score', '')::int,
         0
       ),
       total_questions = coalesce(
         ea.total_questions,
         nullif(ea.data->>'total', '')::int,
         case when jsonb_typeof(ea.data->'answers') = 'array'
              then jsonb_array_length(ea.data->'answers') else 0 end,
         0
       ),
       answered_questions = coalesce(
         ea.answered_questions,
         case when jsonb_typeof(ea.data->'answers') = 'array'
              then jsonb_array_length(ea.data->'answers') else 0 end,
         0
       ),
       correct_answers = coalesce(
         ea.correct_answers,
         nullif(ea.data->>'score', '')::int,
         0
       ),
       time_limit_seconds = coalesce(ea.time_limit_seconds, 3600),
       created_at = coalesce(
         ea.created_at,
         nullif(ea.data->>'submittedAt', '')::timestamptz,
         nullif(ea.data->>'date', '')::date::timestamptz,
         now()
       )
 where ea.status = 'graded';

update public.exam_attempts ea
   set incorrect_answers = greatest(coalesce(ea.answered_questions, 0) - coalesce(ea.correct_answers, 0), 0),
       unanswered_questions = greatest(coalesce(ea.total_questions, 0) - coalesce(ea.answered_questions, 0), 0),
       percentage = coalesce(
         ea.percentage,
         case when coalesce(ea.total_questions, 0) > 0
              then round(coalesce(ea.correct_answers, 0) * 100.0 / ea.total_questions, 2)
              else 0 end
       )
 where ea.incorrect_answers is null
    or ea.unanswered_questions is null
    or ea.percentage is null;

alter table public.exam_attempts alter column status             set default 'graded';
alter table public.exam_attempts alter column status             set not null;
alter table public.exam_attempts alter column score              set default 0;
alter table public.exam_attempts alter column score              set not null;
alter table public.exam_attempts alter column total_questions    set default 0;
alter table public.exam_attempts alter column total_questions    set not null;
alter table public.exam_attempts alter column answered_questions set default 0;
alter table public.exam_attempts alter column answered_questions set not null;
alter table public.exam_attempts alter column correct_answers    set default 0;
alter table public.exam_attempts alter column correct_answers    set not null;
alter table public.exam_attempts alter column incorrect_answers  set default 0;
alter table public.exam_attempts alter column incorrect_answers  set not null;
alter table public.exam_attempts alter column unanswered_questions set default 0;
alter table public.exam_attempts alter column unanswered_questions set not null;
alter table public.exam_attempts alter column created_at         set default now();
alter table public.exam_attempts alter column created_at         set not null;

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array['quiz_attempts', 'exam_attempts'] loop
    begin
      execute format(
        'alter table public.%I add constraint %I check (status in (''in_progress'',''submitted'',''auto_submitted'',''graded''))',
        v_table, v_table || '_status_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (time_limit_seconds is null or time_limit_seconds > 0)',
        v_table, v_table || '_time_limit_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (deadline_at is null or started_at is null or deadline_at > started_at)',
        v_table, v_table || '_deadline_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (score >= 0 and total_questions >= 0 and answered_questions >= 0 and correct_answers >= 0 and incorrect_answers >= 0 and unanswered_questions >= 0)',
        v_table, v_table || '_score_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (percentage is null or (percentage >= 0 and percentage <= 100))',
        v_table, v_table || '_percentage_check');
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Efficient expiry scans + per-trainee lookups.
create index if not exists quiz_attempts_expiry_idx
  on public.quiz_attempts (deadline_at)
  where status = 'in_progress';
create index if not exists quiz_attempts_trainee_status_idx
  on public.quiz_attempts (trainee_id, status);
create index if not exists quiz_attempts_program_idx
  on public.quiz_attempts (program_id);
create index if not exists exam_attempts_expiry_idx
  on public.exam_attempts (deadline_at)
  where status = 'in_progress';
create index if not exists exam_attempts_trainee_status_idx
  on public.exam_attempts (trainee_id, status);
create index if not exists exam_attempts_program_idx
  on public.exam_attempts (program_id);

-- At most one live attempt per trainee/assessment. This is what makes
-- start_*_attempt() idempotent under concurrent calls.
create unique index if not exists quiz_attempts_one_in_progress
  on public.quiz_attempts (trainee_id, (data->>'quizId'))
  where status = 'in_progress';
create unique index if not exists exam_attempts_one_in_progress
  on public.exam_attempts (trainee_id, (data->>'examId'))
  where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- Answer storage (one row per answered question)
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_attempt_answers (
  attempt_id  text not null references public.quiz_attempts(id) on delete restrict,
  question_id text not null,
  answer      jsonb,
  is_correct  boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table if not exists public.exam_attempt_answers (
  attempt_id  text not null references public.exam_attempts(id) on delete restrict,
  question_id text not null,
  answer      jsonb,
  is_correct  boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index if not exists quiz_attempt_answers_attempt_idx
  on public.quiz_attempt_answers (attempt_id);
create index if not exists exam_attempt_answers_attempt_idx
  on public.exam_attempt_answers (attempt_id);

alter table public.quiz_attempt_answers enable row level security;
alter table public.exam_attempt_answers enable row level security;

-- ---------------------------------------------------------------------------
-- quiz_sessions: the legacy client creates one row when a quiz starts. The
-- server now owns its clock. timer_version = 1 marks rows that predate this
-- migration; the scheduled processor leaves those alone.
-- ---------------------------------------------------------------------------
alter table public.quiz_sessions add column if not exists started_at         timestamptz;
alter table public.quiz_sessions add column if not exists deadline_at        timestamptz;
alter table public.quiz_sessions add column if not exists time_limit_seconds integer;
alter table public.quiz_sessions add column if not exists timer_version      smallint not null default 2;

-- Rows that already existed when this migration first ran are legacy.
update public.quiz_sessions
   set timer_version = 1
 where timer_version = 2
   and started_at is null;

update public.quiz_sessions
   set started_at = coalesce(
         started_at,
         nullif(data->>'startedAt', '')::timestamptz,
         created_at
       ),
       time_limit_seconds = coalesce(time_limit_seconds, 1800)
 where started_at is null
    or time_limit_seconds is null;

update public.quiz_sessions
   set deadline_at = coalesce(deadline_at, started_at + make_interval(secs => time_limit_seconds))
 where deadline_at is null;

create index if not exists quiz_sessions_expiry_idx
  on public.quiz_sessions (deadline_at)
  where timer_version >= 2;
-- ###########################################################################
-- ## supabase/migrations/044_trainer_feedback_functions.sql
-- ###########################################################################
-- ============================================================================
-- 044_trainer_feedback_functions.sql
-- ----------------------------------------------------------------------------
-- Server-side completion rule, feedback eligibility, submission, Super Admin
-- retrieval/export helpers and the auditable correction path.
--
-- Everything here is SECURITY DEFINER with a fixed search_path. Authorization
-- is always derived from auth.uid() -> profiles, never from a client argument.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- All published lesson ids of a program, including lessons nested under
-- competencies[].units[].lessons.
-- ---------------------------------------------------------------------------
create or replace function public.program_lesson_ids(p_program_id text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct les.l->>'id'), array[]::text[])
  from public.programs p
  cross join lateral jsonb_array_elements(coalesce(p.data->'competencies', '[]'::jsonb)) c
  cross join lateral (
    select l.value as l
    from jsonb_array_elements(coalesce(c->'lessons', '[]'::jsonb)) as l
    union all
    select l2.value as l
    from jsonb_array_elements(coalesce(c->'units', '[]'::jsonb)) as u
    cross join lateral jsonb_array_elements(coalesce(u.value->'lessons', '[]'::jsonb)) as l2
  ) les
  where p.id = p_program_id
    and coalesce(les.l->>'id', '') <> ''
    and coalesce((les.l->>'published')::boolean, true)
$$;

-- ---------------------------------------------------------------------------
-- course_completion(enrollment_id)
--   A database-backed completion decision. It combines the enrollment status
--   with the actual progress map, every published quiz and every published
--   exam. The frontend cannot make this true by navigating to a page.
-- ---------------------------------------------------------------------------
create or replace function public.course_completion(p_enrollment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e              record;
  v_p              record;
  v_progress       jsonb;
  v_lesson_ids     text[];
  v_lessons_total  int := 0;
  v_lessons_done   int := 0;
  v_quizzes_total  int := 0;
  v_quizzes_passed int := 0;
  v_exams_total    int := 0;
  v_exams_passed   int := 0;
  v_reasons        text[] := array[]::text[];
  v_complete       boolean := false;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object(
      'complete', false,
      'status_completed', false,
      'reasons', jsonb_build_array('enrollment_not_found')
    );
  end if;

  select * into v_p from public.programs where id = v_e.program_id;
  if not found then
    return jsonb_build_object(
      'complete', false,
      'status_completed', false,
      'reasons', jsonb_build_array('program_not_found')
    );
  end if;

  v_progress   := coalesce(v_e.data->'progress', '{}'::jsonb);
  v_lesson_ids := public.program_lesson_ids(v_e.program_id);
  v_lessons_total := coalesce(array_length(v_lesson_ids, 1), 0);

  select count(*) into v_lessons_done
  from unnest(v_lesson_ids) lid
  where lower(coalesce(v_progress->>lid, '')) in ('true', 't', '1', 'yes');

  select count(*) into v_quizzes_total
  from jsonb_array_elements(coalesce(v_p.data->'quizzes', '[]'::jsonb)) q
  where coalesce((q->>'published')::boolean, true)
    and (
      coalesce(q->>'lessonId', '') = ''
      or (q->>'lessonId') = any(v_lesson_ids)
    );

  select count(*) into v_quizzes_passed
  from jsonb_array_elements(coalesce(v_p.data->'quizzes', '[]'::jsonb)) q
  where coalesce((q->>'published')::boolean, true)
    and (
      coalesce(q->>'lessonId', '') = ''
      or (q->>'lessonId') = any(v_lesson_ids)
    )
    and exists (
      select 1
      from public.quiz_attempts qa
      where qa.trainee_id = v_e.trainee_id
        and qa.program_id = v_e.program_id
        and qa.data->>'quizId' = q->>'id'
        and coalesce(
              qa.percentage,
              nullif(qa.data->>'percentage', '')::numeric,
              0
            ) >= coalesce(nullif(q->>'passing', '')::numeric, 75)
    );

  select count(*) into v_exams_total
  from jsonb_array_elements(coalesce(v_p.data->'exams', '[]'::jsonb)) e
  where coalesce((e->>'published')::boolean, true);

  select count(*) into v_exams_passed
  from jsonb_array_elements(coalesce(v_p.data->'exams', '[]'::jsonb)) e
  where coalesce((e->>'published')::boolean, true)
    and exists (
      select 1
      from public.exam_attempts ea
      where ea.trainee_id = v_e.trainee_id
        and ea.program_id = v_e.program_id
        and ea.data->>'examId' = e->>'id'
        and coalesce(
              ea.percentage,
              nullif(ea.data->>'percentage', '')::numeric,
              0
            ) >= coalesce(nullif(e->>'passing', '')::numeric, 75)
    );

  if v_e.status is distinct from 'Completed' then
    v_reasons := array_append(v_reasons, 'enrollment_not_completed');
  end if;
  if v_lessons_done < v_lessons_total then
    v_reasons := array_append(v_reasons, 'lessons_incomplete');
  end if;
  if v_quizzes_passed < v_quizzes_total then
    v_reasons := array_append(v_reasons, 'quizzes_incomplete');
  end if;
  if v_exams_passed < v_exams_total then
    v_reasons := array_append(v_reasons, 'exams_incomplete');
  end if;

  v_complete :=
    v_e.status = 'Completed'
    and v_lessons_done >= v_lessons_total
    and v_quizzes_passed >= v_quizzes_total
    and v_exams_passed >= v_exams_total;

  return jsonb_build_object(
    'complete', v_complete,
    'status_completed', v_e.status = 'Completed',
    'status', v_e.status,
    'lessons_total', v_lessons_total,
    'lessons_completed', v_lessons_done,
    'quizzes_total', v_quizzes_total,
    'quizzes_passed', v_quizzes_passed,
    'exams_total', v_exams_total,
    'exams_passed', v_exams_passed,
    'reasons', to_jsonb(v_reasons)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The trainer responsible for an enrollment. Enrollment.data.trainerId wins;
-- otherwise the single active trainer_programs assignment is used. A stale
-- programs.trainer_id is only accepted when it points at a real trainer
-- profile. Returns NULL when the answer is ambiguous.
-- ---------------------------------------------------------------------------
create or replace function public.trainer_for_enrollment(p_enrollment_id text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e       record;
  v_trainer text;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return null;
  end if;

  v_trainer := nullif(v_e.data->>'trainerId', '');
  if v_trainer is not null and not exists (
    select 1 from public.profiles where id = v_trainer and role = 'trainer'
  ) then
    v_trainer := null;
  end if;

  if v_trainer is null then
    select min(tp.trainer_id) into v_trainer
    from public.trainer_programs tp
    join public.profiles pr on pr.id = tp.trainer_id and pr.role = 'trainer'
    where tp.program_id = v_e.program_id
      and tp.status = 'active'
    having count(distinct tp.trainer_id) = 1;
  end if;

  if v_trainer is not null and not exists (
    select 1
    from public.trainer_programs tp
    where tp.program_id = v_e.program_id
      and tp.trainer_id = v_trainer
      and tp.status = 'active'
  ) and not exists (
    select 1
    from public.programs p
    join public.profiles pr on pr.id = p.trainer_id and pr.role = 'trainer'
    where p.id = v_e.program_id
      and p.trainer_id = v_trainer
  ) then
    v_trainer := null;
  end if;

  return v_trainer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Eligibility snapshot for one enrollment.
-- ---------------------------------------------------------------------------
create or replace function public.trainer_feedback_eligibility(p_enrollment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e          record;
  v_p          record;
  v_completion jsonb;
  v_trainer    text;
  v_feedback   record;
  v_status     text;
  v_eligible   boolean := false;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'status', 'not_required',
      'eligible', false,
      'reason', 'enrollment_not_found'
    );
  end if;

  select * into v_p from public.programs where id = v_e.program_id;
  v_completion := public.course_completion(p_enrollment_id);
  v_trainer    := public.trainer_for_enrollment(p_enrollment_id);

  select * into v_feedback
  from public.trainer_feedback
  where enrollment_id = p_enrollment_id;

  if found and v_feedback.is_submitted then
    v_status := 'submitted';
  elsif coalesce((v_completion->>'complete')::boolean, false) and v_trainer is not null then
    v_status := 'pending';
    v_eligible := true;
  else
    v_status := 'not_required';
  end if;

  return jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'trainee_id', v_e.trainee_id,
    'program_id', v_e.program_id,
    'program_title', coalesce(nullif(v_p.title, ''), nullif(v_p.data->>'title', ''), v_p.code, v_e.program_id),
    'trainer_id', v_trainer,
    'trainer_name', (
      select coalesce(nullif(pr.name, ''), pr.email, pr.id)
      from public.profiles pr
      where pr.id = v_trainer
    ),
    'completion', v_completion,
    'status', v_status,
    'eligible', v_eligible,
    'feedback_id', case when found then v_feedback.id else null end,
    'submitted_at', case when found then v_feedback.submitted_at else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Trainee-facing status for every enrollment. This is the only status the
-- frontend needs to decide whether to show the feedback form.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_trainer_feedback_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me   text := public.current_profile_id();
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x.row order by x.updated_at desc), '[]'::jsonb)
  into v_rows
  from (
    select e.updated_at,
           public.trainer_feedback_eligibility(e.id) as row
    from public.enrollments e
    where e.trainee_id = v_me
      and coalesce(e.status, '') not in ('Cancelled', 'Rejected')
  ) x;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_trainer_feedback(...)
--   The trainee is derived from the JWT. The trainer is derived from the
--   enrollment, so a trainee can never evaluate an unrelated trainer.
-- ---------------------------------------------------------------------------
create or replace function public.submit_trainer_feedback(
  p_enrollment_id        text,
  p_feedback_text        text,
  p_learning_experience  text default null,
  p_trainer_strengths    text default null,
  p_areas_for_improvement text default null,
  p_recommendation       text default null,
  p_rating               smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       text := public.current_profile_id();
  v_e        record;
  v_elig     jsonb;
  v_trainer  text;
  v_id       text;
begin
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_feedback_text is null or length(btrim(p_feedback_text)) = 0 then
    raise exception 'Written feedback is required.' using errcode = '22023';
  end if;

  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'Rating must be between 1 and 5.' using errcode = '22023';
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

  perform public.write_audit(
    'TRAINER_FEEDBACK_SUBMITTED',
    'trainer_feedback',
    v_id,
    jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'trainer_id', v_trainer,
      'program_id', v_e.program_id
    )
  );

  return public.trainer_feedback_eligibility(p_enrollment_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Super Admin retrieval (paged; the CSV function walks the pages).
-- Filters: trainer_id, program_id, trainee_id, enrollment_id, date_from,
-- date_to, search.
-- ---------------------------------------------------------------------------
create or replace function public.admin_trainer_feedback_page(
  p_filters jsonb default '{}'::jsonb,
  p_limit   int default 1000,
  p_offset  int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_from   timestamptz;
  v_to     timestamptz;
  v_rows   jsonb;
begin
  if not public.is_super_admin_mfa() then
    raise exception 'Super Admin access with MFA is required.' using errcode = '42501';
  end if;

  -- Date-only filters are interpreted as Asia/Manila calendar days, which is
  -- what the training centre means by "today". Full timestamps are used as-is.
  if nullif(p_filters->>'date_from', '') is not null then
    if length(p_filters->>'date_from') = 10 then
      v_from := (p_filters->>'date_from')::date::timestamp at time zone 'Asia/Manila';
    else
      v_from := (p_filters->>'date_from')::timestamptz;
    end if;
  end if;

  if nullif(p_filters->>'date_to', '') is not null then
    if length(p_filters->>'date_to') = 10 then
      v_to := ((p_filters->>'date_to')::date + 1)::timestamp at time zone 'Asia/Manila';
    else
      v_to := (p_filters->>'date_to')::timestamptz;
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.submitted_at, t.id), '[]'::jsonb)
  into v_rows
  from (
    select
      f.id,
      f.trainer_id,
      coalesce(nullif(tr.name, ''), tr.email, f.trainer_id) as trainer_name,
      f.trainee_id,
      coalesce(nullif(tn.name, ''), tn.email, f.trainee_id) as trainee_name,
      f.program_id,
      coalesce(nullif(p.title, ''), nullif(p.data->>'title', ''), p.code, f.program_id) as course_title,
      f.enrollment_id,
      f.feedback_text,
      f.learning_experience,
      f.trainer_strengths,
      f.areas_for_improvement,
      f.recommendation,
      f.rating,
      f.submitted_at,
      f.created_at,
      f.corrected_at,
      f.correction_reason
    from public.trainer_feedback f
    join public.profiles tr on tr.id = f.trainer_id
    join public.profiles tn on tn.id = f.trainee_id
    left join public.programs p on p.id = f.program_id
    where f.is_submitted
      and (nullif(p_filters->>'trainer_id', '') is null
           or f.trainer_id = p_filters->>'trainer_id')
      and (nullif(p_filters->>'program_id', '') is null
           or f.program_id = p_filters->>'program_id')
      and (nullif(p_filters->>'trainee_id', '') is null
           or f.trainee_id = p_filters->>'trainee_id')
      and (nullif(p_filters->>'enrollment_id', '') is null
           or f.enrollment_id = p_filters->>'enrollment_id')
      and (v_from is null or f.submitted_at >= v_from)
      and (v_to is null or f.submitted_at < v_to)
      and (
        nullif(p_filters->>'search', '') is null
        or f.feedback_text ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.trainer_strengths, '') ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.areas_for_improvement, '') ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.learning_experience, '') ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.recommendation, '') ilike '%' || (p_filters->>'search') || '%'
      )
    order by f.submitted_at asc, f.id asc
    limit v_limit offset v_offset
  ) t;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit helper for exports. The Edge Function calls this after building the
-- CSV, so an export can never happen without an audit row.
-- ---------------------------------------------------------------------------
create or replace function public.log_trainer_feedback_export(
  p_filters   jsonb,
  p_row_count int,
  p_format    text default 'csv'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin_mfa() then
    raise exception 'Super Admin access with MFA is required.' using errcode = '42501';
  end if;

  perform public.write_audit(
    'TRAINER_FEEDBACK_EXPORTED',
    'trainer_feedback',
    null,
    jsonb_build_object(
      'filters', coalesce(p_filters, '{}'::jsonb),
      'row_count', greatest(coalesce(p_row_count, 0), 0),
      'format', coalesce(p_format, 'csv')
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditable correction. The original values are copied into
-- trainer_feedback_revisions before the row is touched.
-- ---------------------------------------------------------------------------
create or replace function public.admin_correct_trainer_feedback(
  p_id                   text,
  p_feedback_text        text,
  p_learning_experience  text default null,
  p_trainer_strengths    text default null,
  p_areas_for_improvement text default null,
  p_recommendation       text default null,
  p_reason               text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old      record;
  v_revision uuid;
begin
  if not public.is_super_admin_mfa() then
    raise exception 'Super Admin access with MFA is required.' using errcode = '42501';
  end if;

  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A correction reason is required.' using errcode = '22023';
  end if;

  if p_feedback_text is null or length(btrim(p_feedback_text)) = 0 then
    raise exception 'Written feedback is required.' using errcode = '22023';
  end if;

  select * into v_old
  from public.trainer_feedback
  where id = p_id
  for update;

  if not found then
    raise exception 'Feedback not found.' using errcode = 'P0002';
  end if;

  insert into public.trainer_feedback_revisions (feedback_id, previous_values, reason, corrected_by)
  values (
    p_id,
    jsonb_build_object(
      'feedback_text', v_old.feedback_text,
      'learning_experience', v_old.learning_experience,
      'trainer_strengths', v_old.trainer_strengths,
      'areas_for_improvement', v_old.areas_for_improvement,
      'recommendation', v_old.recommendation,
      'rating', v_old.rating,
      'submitted_at', v_old.submitted_at
    ),
    btrim(p_reason),
    public.current_profile_id()
  )
  returning id into v_revision;

  perform set_config('app.feedback_correction', 'on', true);

  update public.trainer_feedback
     set feedback_text         = btrim(p_feedback_text),
         learning_experience   = nullif(btrim(coalesce(p_learning_experience, '')), ''),
         trainer_strengths     = nullif(btrim(coalesce(p_trainer_strengths, '')), ''),
         areas_for_improvement = nullif(btrim(coalesce(p_areas_for_improvement, '')), ''),
         recommendation        = nullif(btrim(coalesce(p_recommendation, '')), ''),
         corrected_at          = now(),
         corrected_by          = public.current_profile_id(),
         correction_reason     = btrim(p_reason),
         updated_at            = now()
   where id = p_id;

  perform set_config('app.feedback_correction', 'off', true);

  perform public.write_audit(
    'TRAINER_FEEDBACK_CORRECTED',
    'trainer_feedback',
    p_id,
    jsonb_build_object('revision_id', v_revision, 'reason', btrim(p_reason))
  );

  return jsonb_build_object(
    'id', p_id,
    'revision_id', v_revision,
    'corrected_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.program_lesson_ids(text) from public, anon, authenticated;
revoke all on function public.course_completion(text) from public, anon, authenticated;
revoke all on function public.trainer_for_enrollment(text) from public, anon, authenticated;
revoke all on function public.trainer_feedback_eligibility(text) from public, anon, authenticated;

revoke all on function public.get_my_trainer_feedback_status() from public, anon;
revoke all on function public.submit_trainer_feedback(text, text, text, text, text, text, smallint) from public, anon;
revoke all on function public.admin_trainer_feedback_page(jsonb, int, int) from public, anon;
revoke all on function public.log_trainer_feedback_export(jsonb, int, text) from public, anon;
revoke all on function public.admin_correct_trainer_feedback(text, text, text, text, text, text, text) from public, anon;

grant execute on function public.get_my_trainer_feedback_status() to authenticated;
grant execute on function public.submit_trainer_feedback(text, text, text, text, text, text, smallint) to authenticated;
grant execute on function public.admin_trainer_feedback_page(jsonb, int, int) to authenticated;
grant execute on function public.log_trainer_feedback_export(jsonb, int, text) to authenticated;
grant execute on function public.admin_correct_trainer_feedback(text, text, text, text, text, text, text) to authenticated;
-- ###########################################################################
-- ## supabase/migrations/045_feedback_rls_policies.sql
-- ###########################################################################
-- ============================================================================
-- 045_feedback_rls_policies.sql
-- ----------------------------------------------------------------------------
-- Read access only. Submission and corrections are SECURITY DEFINER RPCs, so
-- there is deliberately no INSERT/UPDATE/DELETE policy for clients.
--
--   trainee  -> own feedback
--   trainer  -> feedback about themselves (never another trainer's)
--   admin    -> all feedback, but only at AAL2 (MFA satisfied)
-- ============================================================================

alter table public.trainer_feedback enable row level security;
alter table public.trainer_feedback_revisions enable row level security;

drop policy if exists trainer_feedback_select on public.trainer_feedback;
create policy trainer_feedback_select on public.trainer_feedback
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or trainer_id = public.current_profile_id()
    or public.is_super_admin_mfa()
  );

drop policy if exists trainer_feedback_revisions_select on public.trainer_feedback_revisions;
create policy trainer_feedback_revisions_select on public.trainer_feedback_revisions
  for select to authenticated
  using (public.is_super_admin_mfa());

-- No write policies on purpose.
drop policy if exists trainer_feedback_insert on public.trainer_feedback;
drop policy if exists trainer_feedback_update on public.trainer_feedback;
drop policy if exists trainer_feedback_delete on public.trainer_feedback;
drop policy if exists trainer_feedback_revisions_insert on public.trainer_feedback_revisions;
drop policy if exists trainer_feedback_revisions_update on public.trainer_feedback_revisions;
drop policy if exists trainer_feedback_revisions_delete on public.trainer_feedback_revisions;

revoke insert, update, delete on public.trainer_feedback from anon, authenticated;
revoke insert, update, delete on public.trainer_feedback_revisions from anon, authenticated;
grant select on public.trainer_feedback to authenticated;
grant select on public.trainer_feedback_revisions to authenticated;
-- ###########################################################################
-- ## supabase/migrations/046_timed_assessment_functions.sql
-- ###########################################################################
-- ============================================================================
-- 046_timed_assessment_functions.sql
-- ----------------------------------------------------------------------------
-- Server-authoritative start / save / finalize / retrieve for timed quizzes
-- and exams, plus the compatibility triggers used by the existing frontend.
--
-- Design:
--   * The attempt row owns the clock (started_at, deadline_at, status).
--   * The deadline is issued by the database, never accepted from the client.
--   * Answers are persisted one row per question while the attempt is live.
--   * Finalization locks the attempt, grades only persisted answers, counts
--     unanswered questions as zero, and is idempotent.
--   * The legacy single-shot submission still works: a BEFORE INSERT trigger
--     replaces the client's score with a server grade and rejects a payload
--     that arrives after the stored deadline (30 second transport grace).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Configuration helpers
-- ---------------------------------------------------------------------------
create or replace function public.assessment_config(
  p_kind          text,
  p_program_id    text,
  p_assessment_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key   text;
  v_cfg   jsonb;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;

  v_key := case when p_kind = 'quiz' then 'quizzes' else 'exams' end;

  select elem into v_cfg
  from public.programs p
  cross join lateral jsonb_array_elements(coalesce(p.data->v_key, '[]'::jsonb)) elem
  where p.id = p_program_id
    and elem->>'id' = p_assessment_id
  limit 1;

  return v_cfg;
end;
$$;

create or replace function public.assessment_time_limit(p_kind text, p_config jsonb)
returns integer
language plpgsql
immutable
as $$
declare
  v_minutes numeric;
  v_default numeric := case when p_kind = 'exam' then 60 else 30 end;
begin
  v_minutes := nullif(p_config->>'timeLimit', '')::numeric;
  if v_minutes is null or v_minutes <= 0 then
    v_minutes := v_default;
  end if;
  return greatest(60, round(v_minutes * 60))::int;
end;
$$;

create or replace function public.normalize_assessment_answer(p_answer jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_answer is null or jsonb_typeof(p_answer) = 'null' then ''
    when jsonb_typeof(p_answer) = 'string' then lower(btrim(p_answer #>> '{}'))
    else lower(btrim(p_answer::text))
  end
$$;

-- ---------------------------------------------------------------------------
-- Grade a set of answers against the assessment configuration.
-- Accepts either [{questionId, given}] (legacy shape) or {questionId: given}.
-- ---------------------------------------------------------------------------
create or replace function public.grade_assessment(
  p_kind    text,
  p_config  jsonb,
  p_answers jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_questions     jsonb := coalesce(p_config->'questions', '[]'::jsonb);
  v_total         int := 0;
  v_answered      int := 0;
  v_correct       int := 0;
  v_total_points  numeric := 0;
  v_earned_points numeric := 0;
  v_map           jsonb := '{}'::jsonb;
  v_out           jsonb := '[]'::jsonb;
  v_q             jsonb;
  v_qid           text;
  v_given         jsonb;
  v_given_text    text;
  v_correct_flag  boolean;
  v_points        numeric;
begin
  if jsonb_typeof(p_answers) = 'array' then
    select coalesce(jsonb_object_agg(x->>'questionId', x->'given'), '{}'::jsonb)
    into v_map
    from jsonb_array_elements(p_answers) x
    where coalesce(x->>'questionId', '') <> '';
  elsif jsonb_typeof(p_answers) = 'object' then
    v_map := p_answers;
  end if;

  for v_q in select value from jsonb_array_elements(v_questions)
  loop
    v_qid := v_q->>'id';
    continue when v_qid is null or v_qid = '';

    v_given      := v_map->v_qid;
    v_given_text := public.normalize_assessment_answer(v_given);
    v_points     := coalesce(nullif(v_q->>'points', '')::numeric, 1);

    v_total := v_total + 1;
    v_total_points := v_total_points + v_points;

    if v_given_text <> '' then
      v_answered := v_answered + 1;
    end if;

    v_correct_flag :=
      v_given_text <> ''
      and v_given_text = public.normalize_assessment_answer(v_q->'answer');

    if v_correct_flag then
      v_correct := v_correct + 1;
      v_earned_points := v_earned_points + v_points;
    end if;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'questionId', v_qid,
        'given', coalesce(v_given, 'null'::jsonb),
        'correct', v_correct_flag
      )
    );
  end loop;

  return jsonb_build_object(
    'total', v_total,
    'answered', v_answered,
    'correct', v_correct,
    'incorrect', greatest(v_answered - v_correct, 0),
    'unanswered', greatest(v_total - v_answered, 0),
    'score', v_correct,
    'percentage', case
      when v_total_points > 0 then round(v_earned_points * 100.0 / v_total_points, 2)
      else 0
    end,
    'points_earned', v_earned_points,
    'total_points', v_total_points,
    'answers', v_out
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal state reader
-- ---------------------------------------------------------------------------
create or replace function public._assessment_state(p_kind text, p_attempt_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table   text;
  v_a       record;
  v_key     text;
  v_remain  int;
  v_payload jsonb;
begin
  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_key   := case when p_kind = 'quiz' then 'quizId' else 'examId' end;

  execute format('select * from public.%I where id = $1', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    return null;
  end if;

  v_remain := case
    when v_a.deadline_at is null then null
    else greatest(0, floor(extract(epoch from (v_a.deadline_at - now()))))::int
  end;

  v_payload := jsonb_build_object(
    'id', v_a.id,
    'kind', p_kind,
    'program_id', v_a.program_id,
    'assessment_id', v_a.data->>v_key,
    'trainee_id', v_a.trainee_id,
    'status', v_a.status,
    'started_at', v_a.started_at,
    'deadline_at', v_a.deadline_at,
    'submitted_at', v_a.submitted_at,
    'time_limit_seconds', v_a.time_limit_seconds,
    'remaining_seconds', v_remain,
    'server_time', now(),
    'score', v_a.score,
    'total_questions', v_a.total_questions,
    'answered_questions', v_a.answered_questions,
    'correct_answers', v_a.correct_answers,
    'incorrect_answers', v_a.incorrect_answers,
    'unanswered_questions', v_a.unanswered_questions,
    'percentage', v_a.percentage,
    'auto_submitted', v_a.auto_submitted
  );

  if v_a.status <> 'in_progress' then
    v_payload := v_payload || jsonb_build_object(
      'passed', coalesce((v_a.data->>'passed')::boolean, false),
      'answers', coalesce(v_a.data->'answers', '[]'::jsonb)
    );
  end if;

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start (idempotent per trainee + assessment)
-- ---------------------------------------------------------------------------
create or replace function public._start_assessment_attempt(
  p_kind          text,
  p_program_id    text,
  p_assessment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me         text := public.current_profile_id();
  v_table      text;
  v_key        text;
  v_title_key  text;
  v_config     jsonb;
  v_existing   record;
  v_limit      int;
  v_total      int;
  v_id         text;
  v_data       jsonb;
  v_count      int := 0;
  v_grant      text;
  v_start      timestamp;
  v_deadline   timestamp;
  v_now_ph     timestamp := now() at time zone 'Asia/Manila';
  v_enrollment record;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  v_table     := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_key       := case when p_kind = 'quiz' then 'quizId' else 'examId' end;
  v_title_key := case when p_kind = 'quiz' then 'quizTitle' else 'examTitle' end;

  -- The trainee must have an accessible enrollment for the program.
  select * into v_enrollment
  from public.enrollments
  where trainee_id = v_me
    and program_id = p_program_id
    and status in ('Enrolled', 'Approved', 'Completed')
  order by updated_at desc
  limit 1;

  if not found then
    raise exception 'You are not enrolled in this program.' using errcode = '42501';
  end if;

  v_config := public.assessment_config(p_kind, p_program_id, p_assessment_id);
  if v_config is null then
    raise exception 'Assessment not found.' using errcode = 'P0002';
  end if;
  if not coalesce((v_config->>'published')::boolean, true) then
    raise exception 'This assessment is not published.' using errcode = '42501';
  end if;

  v_total := jsonb_array_length(coalesce(v_config->'questions', '[]'::jsonb));
  if v_total = 0 then
    raise exception 'This assessment has no questions.' using errcode = '22023';
  end if;

  -- Trainer schedule window (Asia/Manila wall clock, same as the UI).
  if nullif(v_config->>'startDate', '') is not null then
    v_start := (v_config->>'startDate')::date
               + coalesce(nullif(v_config->>'startTime', '')::time, time '00:00');
    if v_now_ph < v_start then
      raise exception 'This assessment is not open yet.' using errcode = '42501';
    end if;
  end if;

  if nullif(v_config->>'deadlineDate', '') is not null then
    v_deadline := (v_config->>'deadlineDate')::date
                  + coalesce(nullif(v_config->>'deadlineTime', '')::time, time '23:59:59');
    if v_now_ph > v_deadline then
      raise exception 'The assessment deadline has passed.' using errcode = '42501';
    end if;
  end if;

  -- Return the live attempt instead of creating a second clock.
  execute format(
    'select * from public.%I where trainee_id = $1 and status = ''in_progress'' and data->>$2 = $3 order by started_at desc limit 1',
    v_table
  )
  into v_existing
  using v_me, v_key, p_assessment_id;

  if v_existing.id is not null then
    return public._assessment_state(p_kind, v_existing.id);
  end if;

  if p_kind = 'quiz' then
    execute format(
      'select count(*) from public.%I where trainee_id = $1 and data->>$2 = $3',
      v_table
    )
    into v_count
    using v_me, v_key, p_assessment_id;

    if v_count > 0 then
      select qr.id into v_grant
      from public.quiz_requests qr
      where qr.trainee_id = v_me
        and qr.quiz_id = p_assessment_id
        and qr.status = 'approved'
        and coalesce((qr.data->>'attemptsUsed')::int, 0)
            < coalesce((qr.data->>'attemptsGranted')::int, 1)
      order by qr.created_at desc
      limit 1;

      if v_grant is null then
        raise exception 'Quiz already attempted. Trainer approval is required for another attempt.'
          using errcode = '42501';
      end if;

      update public.quiz_requests
         set data = jsonb_set(
               data,
               '{attemptsUsed}',
               to_jsonb(coalesce((data->>'attemptsUsed')::int, 0) + 1)
             )
       where id = v_grant;
    end if;
  end if;

  v_limit := public.assessment_time_limit(p_kind, v_config);
  v_id    := case when p_kind = 'quiz' then 'qa-' else 'ea-' end
             || replace(gen_random_uuid()::text, '-', '');

  v_data := jsonb_build_object(
    v_key, p_assessment_id,
    'programId', p_program_id,
    v_title_key, v_config->>'title',
    'startedAt', to_jsonb(now()),
    'deadlineAt', to_jsonb(now() + make_interval(secs => v_limit)),
    'status', 'in_progress',
    'answers', '[]'::jsonb,
    'total', v_total,
    'score', 0,
    'percentage', 0,
    'passed', false
  );

  begin
    execute format(
      'insert into public.%I
         (id, trainee_id, program_id, data, started_at, deadline_at, time_limit_seconds,
          status, score, total_questions, answered_questions, unanswered_questions,
          percentage, auto_submitted, created_at, updated_at)
       values ($1, $2, $3, $4, now(), now() + make_interval(secs => $5), $5,
               ''in_progress'', 0, $6, 0, $6, 0, false, now(), now())',
      v_table
    )
    using v_id, v_me, p_program_id, v_data, v_limit, v_total;
  exception when unique_violation then
    execute format(
      'select * from public.%I where trainee_id = $1 and status = ''in_progress'' and data->>$2 = $3 order by started_at desc limit 1',
      v_table
    )
    into v_existing
    using v_me, v_key, p_assessment_id;
    if v_existing.id is not null then
      return public._assessment_state(p_kind, v_existing.id);
    end if;
    raise;
  end;

  return public._assessment_state(p_kind, v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Save one answer (deadline enforced with the server clock)
-- ---------------------------------------------------------------------------
create or replace function public._save_assessment_answer(
  p_kind        text,
  p_attempt_id  text,
  p_question_id text,
  p_answer      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       text := public.current_profile_id();
  v_table    text;
  v_ans      text;
  v_a        record;
  v_config   jsonb;
  v_exists   boolean;
  v_answered int;
  v_remain   int;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_ans   := case when p_kind = 'quiz' then 'quiz_attempt_answers' else 'exam_attempt_answers' end;

  execute format('select * from public.%I where id = $1 for update', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  if v_a.trainee_id is distinct from v_me then
    raise exception 'You can only answer your own attempt.' using errcode = '42501';
  end if;

  if v_a.status <> 'in_progress' then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'finalized',
      'attempt', public._assessment_state(p_kind, p_attempt_id)
    );
  end if;

  if v_a.deadline_at is not null and now() >= v_a.deadline_at then
    perform set_config('app.assessment_rpc', 'on', true);
    perform public._finalize_assessment_attempt(p_kind, p_attempt_id, true);
    return jsonb_build_object(
      'accepted', false,
      'reason', 'deadline_passed',
      'attempt', public._assessment_state(p_kind, p_attempt_id)
    );
  end if;

  v_config := public.assessment_config(p_kind, v_a.program_id, v_a.data->>(
    case when p_kind = 'quiz' then 'quizId' else 'examId' end
  ));

  select exists (
    select 1
    from jsonb_array_elements(coalesce(v_config->'questions', '[]'::jsonb)) q
    where q->>'id' = p_question_id
  ) into v_exists;

  if not v_exists then
    raise exception 'That question does not belong to this assessment.' using errcode = '22023';
  end if;

  if p_answer is not null and jsonb_typeof(p_answer) not in ('string', 'number', 'boolean', 'null') then
    raise exception 'Unsupported answer format.' using errcode = '22023';
  end if;

  perform set_config('app.assessment_rpc', 'on', true);

  if p_answer is null
     or jsonb_typeof(p_answer) = 'null'
     or public.normalize_assessment_answer(p_answer) = '' then
    execute format('delete from public.%I where attempt_id = $1 and question_id = $2', v_ans)
    using p_attempt_id, p_question_id;
  else
    execute format(
      'insert into public.%I (attempt_id, question_id, answer, is_correct, answered_at)
       values ($1, $2, $3, null, now())
       on conflict (attempt_id, question_id)
       do update set answer = excluded.answer, is_correct = null, answered_at = now()',
      v_ans
    )
    using p_attempt_id, p_question_id, p_answer;
  end if;

  execute format('select count(*) from public.%I where attempt_id = $1', v_ans)
  into v_answered
  using p_attempt_id;

  execute format(
    'update public.%I set answered_questions = $2, updated_at = now() where id = $1',
    v_table
  )
  using p_attempt_id, v_answered;

  perform set_config('app.assessment_rpc', 'off', true);

  v_remain := case
    when v_a.deadline_at is null then null
    else greatest(0, floor(extract(epoch from (v_a.deadline_at - now()))))::int
  end;

  return jsonb_build_object(
    'accepted', true,
    'attempt_id', p_attempt_id,
    'question_id', p_question_id,
    'answered_questions', v_answered,
    'remaining_seconds', v_remain,
    'status', 'in_progress'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalize (idempotent, concurrency-safe)
-- ---------------------------------------------------------------------------
create or replace function public._finalize_assessment_attempt(
  p_kind       text,
  p_attempt_id text,
  p_auto       boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       text := public.current_profile_id();
  v_table    text;
  v_ans      text;
  v_a        record;
  v_config   jsonb;
  v_answers  jsonb := '{}'::jsonb;
  v_grade    jsonb;
  v_auto     boolean;
  v_status   text;
  v_passed   boolean;
  v_patch    jsonb;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;

  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_ans   := case when p_kind = 'quiz' then 'quiz_attempt_answers' else 'exam_attempt_answers' end;

  execute format('select * from public.%I where id = $1 for update', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  -- Authorization: the owner, the assigned trainer, or a Super Admin. Cron
  -- and service_role calls have no auth.uid() and are allowed.
  if v_me is not null then
    if v_a.trainee_id is distinct from v_me
       and not public.is_super_admin()
       and not public.is_trainer_assigned_to_program(v_a.program_id) then
      raise exception 'You cannot finalize this attempt.' using errcode = '42501';
    end if;
  end if;

  -- Idempotent: a terminal attempt is returned unchanged.
  if v_a.status <> 'in_progress' then
    return public._assessment_state(p_kind, p_attempt_id);
  end if;

  v_config := public.assessment_config(
    p_kind,
    v_a.program_id,
    v_a.data->>(case when p_kind = 'quiz' then 'quizId' else 'examId' end)
  );

  execute format(
    'select coalesce(jsonb_object_agg(question_id, answer), ''{}''::jsonb) from public.%I where attempt_id = $1',
    v_ans
  )
  into v_answers
  using p_attempt_id;

  -- Compatibility: an attempt created outside the RPC flow may carry its
  -- answers in data.answers instead of the answer table.
  if v_answers = '{}'::jsonb
     and jsonb_typeof(v_a.data->'answers') = 'array'
     and jsonb_array_length(v_a.data->'answers') > 0 then
    v_answers := v_a.data->'answers';
  end if;

  v_grade := public.grade_assessment(p_kind, coalesce(v_config, '{}'::jsonb), v_answers);

  v_auto := coalesce(p_auto, v_a.deadline_at is not null and now() >= v_a.deadline_at);
  v_status := case when v_auto then 'auto_submitted' else 'submitted' end;
  v_passed := coalesce((v_grade->>'percentage')::numeric, 0)
              >= coalesce(nullif(v_config->>'passing', '')::numeric, 75);

  v_patch := jsonb_build_object(
    'score', (v_grade->>'score')::int,
    'total', (v_grade->>'total')::int,
    'percentage', (v_grade->>'percentage')::numeric,
    'passed', v_passed,
    'answers', v_grade->'answers',
    'status', v_status,
    'submittedAt', to_jsonb(now()),
    'autoSubmitted', v_auto
  );

  perform set_config('app.assessment_rpc', 'on', true);

  execute format(
    'update public.%I
        set status = $2,
            submitted_at = now(),
            auto_submitted = $3,
            score = $4,
            total_questions = $5,
            answered_questions = $6,
            correct_answers = $7,
            incorrect_answers = $8,
            unanswered_questions = $9,
            percentage = $10,
            updated_at = now(),
            data = coalesce(data, ''{}''::jsonb) || $11
      where id = $1',
    v_table
  )
  using
    p_attempt_id,
    v_status,
    v_auto,
    (v_grade->>'score')::int,
    (v_grade->>'total')::int,
    (v_grade->>'answered')::int,
    (v_grade->>'correct')::int,
    (v_grade->>'incorrect')::int,
    (v_grade->>'unanswered')::int,
    (v_grade->>'percentage')::numeric,
    v_patch;

  perform set_config('app.assessment_rpc', 'off', true);

  return public._assessment_state(p_kind, p_attempt_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Retrieve (auto-finalizes an expired live attempt)
-- ---------------------------------------------------------------------------
create or replace function public._get_assessment_attempt(p_kind text, p_attempt_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me     text := public.current_profile_id();
  v_table  text;
  v_a      record;
begin
  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;

  execute format('select * from public.%I where id = $1', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  if v_me is not null
     and v_a.trainee_id is distinct from v_me
     and not public.is_super_admin()
     and not public.is_trainer_assigned_to_program(v_a.program_id) then
    raise exception 'You cannot view this attempt.' using errcode = '42501';
  end if;

  if v_a.status = 'in_progress'
     and v_a.deadline_at is not null
     and now() >= v_a.deadline_at then
    return public._finalize_assessment_attempt(p_kind, p_attempt_id, true);
  end if;

  return public._assessment_state(p_kind, p_attempt_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_program_id text, p_quiz_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._start_assessment_attempt('quiz', p_program_id, p_quiz_id) $$;

create or replace function public.save_quiz_answer(p_attempt_id text, p_question_id text, p_answer jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select public._save_assessment_answer('quiz', p_attempt_id, p_question_id, p_answer) $$;

create or replace function public.finalize_quiz_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._finalize_assessment_attempt('quiz', p_attempt_id, null) $$;

create or replace function public.get_quiz_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._get_assessment_attempt('quiz', p_attempt_id) $$;

create or replace function public.start_exam_attempt(p_program_id text, p_exam_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._start_assessment_attempt('exam', p_program_id, p_exam_id) $$;

create or replace function public.save_exam_answer(p_attempt_id text, p_question_id text, p_answer jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select public._save_assessment_answer('exam', p_attempt_id, p_question_id, p_answer) $$;

create or replace function public.finalize_exam_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._finalize_assessment_attempt('exam', p_attempt_id, null) $$;

create or replace function public.get_exam_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._get_assessment_attempt('exam', p_attempt_id) $$;

-- ---------------------------------------------------------------------------
-- Compatibility trigger: grade legacy single-shot submissions on insert.
-- The existing QuizRunner/ExamRunner send the whole attempt once. The server
-- replaces score/percentage/answers with its own grade and enforces the
-- deadline derived from the quiz session (quiz) or the recorded startedAt.
-- ---------------------------------------------------------------------------
create or replace function public.grade_legacy_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind     text := tg_argv[0];
  v_config   jsonb;
  v_session  record;
  v_started  timestamptz;
  v_deadline timestamptz;
  v_limit    int;
  v_grade    jsonb;
  v_auto     boolean;
  v_status   text;
  v_key      text;
begin
  -- RPC-created attempts and server-authored forfeiture rows already carry a
  -- server clock; never re-grade or deadline-check them here.
  if coalesce(current_setting('app.assessment_rpc', true), '') = 'on' then
    return new;
  end if;

  if new.status = 'in_progress' and new.deadline_at is not null then
    return new;
  end if;

  v_key := case when v_kind = 'quiz' then 'quizId' else 'examId' end;
  v_config := public.assessment_config(v_kind, new.program_id, new.data->>v_key);

  if v_config is null then
    -- Unknown/legacy assessment: keep the old behaviour, but stamp the row.
    new.submitted_at := coalesce(new.submitted_at, now());
    new.status := coalesce(nullif(new.status, ''), 'graded');
    return new;
  end if;

  if v_kind = 'quiz' then
    select * into v_session
    from public.quiz_sessions
    where trainee_id = new.trainee_id
      and quiz_id = new.data->>'quizId'
    order by created_at desc
    limit 1;

    v_started := coalesce(
      v_session.started_at,
      nullif(new.data->>'startedAt', '')::timestamptz,
      now()
    );
  else
    v_started := coalesce(
      nullif(new.data->>'startedAt', '')::timestamptz,
      now()
    );
  end if;

  if v_started > now() then
    v_started := now();
  end if;

  v_limit := public.assessment_time_limit(v_kind, v_config);
  v_deadline := case
    when v_kind = 'quiz' and v_session.deadline_at is not null then v_session.deadline_at
    else v_started + make_interval(secs => v_limit)
  end;

  -- 30 seconds of transport tolerance for a submission that left the browser
  -- at 00:00. Anything later is refused; the attempt is not reopened.
  if now() > v_deadline + interval '30 seconds' then
    raise exception 'The assessment deadline has passed. This attempt cannot be accepted.'
      using errcode = 'check_violation';
  end if;

  v_grade := public.grade_assessment(v_kind, v_config, new.data->'answers');
  v_auto := now() >= v_deadline;
  v_status := case when v_auto then 'auto_submitted' else 'submitted' end;

  new.started_at := v_started;
  new.deadline_at := v_deadline;
  new.submitted_at := now();
  new.time_limit_seconds := v_limit;
  new.status := v_status;
  new.auto_submitted := v_auto;
  new.score := (v_grade->>'score')::int;
  new.total_questions := (v_grade->>'total')::int;
  new.answered_questions := (v_grade->>'answered')::int;
  new.correct_answers := (v_grade->>'correct')::int;
  new.incorrect_answers := (v_grade->>'incorrect')::int;
  new.unanswered_questions := (v_grade->>'unanswered')::int;
  new.percentage := (v_grade->>'percentage')::numeric;
  new.updated_at := now();

  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
    'score', new.score,
    'total', new.total_questions,
    'percentage', new.percentage,
    'passed', new.percentage >= coalesce(nullif(v_config->>'passing', '')::numeric, 75),
    'answers', v_grade->'answers',
    'status', v_status,
    'startedAt', to_jsonb(v_started),
    'deadlineAt', to_jsonb(v_deadline),
    'submittedAt', to_jsonb(now()),
    'autoSubmitted', v_auto
  );

  return new;
end;
$$;

drop trigger if exists quiz_attempts_grade_legacy on public.quiz_attempts;
create trigger quiz_attempts_grade_legacy
  before insert on public.quiz_attempts
  for each row execute function public.grade_legacy_attempt('quiz');

drop trigger if exists exam_attempts_grade_legacy on public.exam_attempts;
create trigger exam_attempts_grade_legacy
  before insert on public.exam_attempts
  for each row execute function public.grade_legacy_attempt('exam');

-- The session has served its purpose once the attempt is stored.
create or replace function public.clear_quiz_session_after_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'in_progress' then
    delete from public.quiz_sessions
    where trainee_id = new.trainee_id
      and quiz_id = new.data->>'quizId';
  end if;
  return new;
end;
$$;

drop trigger if exists quiz_attempts_clear_session on public.quiz_attempts;
create trigger quiz_attempts_clear_session
  after insert on public.quiz_attempts
  for each row execute function public.clear_quiz_session_after_attempt();

-- ---------------------------------------------------------------------------
-- Immutability: clients may re-send an attempt (idempotent retry), but the
-- trigger forces every protected field back to its stored value. Only the
-- SECURITY DEFINER RPCs set app.assessment_rpc to 'on'.
-- ---------------------------------------------------------------------------
create or replace function public.protect_assessment_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.assessment_rpc', true), '') = 'on' then
    new.updated_at := now();
    return new;
  end if;

  new.id := old.id;
  new.trainee_id := old.trainee_id;
  new.program_id := old.program_id;
  new.data := old.data;
  new.started_at := old.started_at;
  new.deadline_at := old.deadline_at;
  new.submitted_at := old.submitted_at;
  new.time_limit_seconds := old.time_limit_seconds;
  new.status := old.status;
  new.score := old.score;
  new.total_questions := old.total_questions;
  new.answered_questions := old.answered_questions;
  new.correct_answers := old.correct_answers;
  new.incorrect_answers := old.incorrect_answers;
  new.unanswered_questions := old.unanswered_questions;
  new.percentage := old.percentage;
  new.auto_submitted := old.auto_submitted;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quiz_attempts_protect on public.quiz_attempts;
create trigger quiz_attempts_protect
  before update on public.quiz_attempts
  for each row execute function public.protect_assessment_attempt();

drop trigger if exists exam_attempts_protect on public.exam_attempts;
create trigger exam_attempts_protect
  before update on public.exam_attempts
  for each row execute function public.protect_assessment_attempt();

-- ---------------------------------------------------------------------------
-- quiz_sessions clock (server-owned)
-- ---------------------------------------------------------------------------
create or replace function public.set_quiz_session_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_limit  int;
  v_reset  boolean := false;
begin
  v_config := public.assessment_config('quiz', new.program_id, new.quiz_id);
  v_limit  := public.assessment_time_limit('quiz', coalesce(v_config, '{}'::jsonb));

  if tg_op = 'INSERT' then
    new.started_at := now();
    new.deadline_at := now() + make_interval(secs => v_limit);
    new.time_limit_seconds := v_limit;
    new.timer_version := 2;
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
      'startedAt', to_jsonb(new.started_at),
      'deadlineAt', to_jsonb(new.deadline_at),
      'timeLimitSeconds', v_limit
    );
    return new;
  end if;

  if new.trainee_id is distinct from old.trainee_id
     or new.program_id is distinct from old.program_id
     or new.quiz_id is distinct from old.quiz_id then
    raise exception 'A quiz session cannot be moved to another trainee or quiz.'
      using errcode = '42501';
  end if;

  -- A fresh clock is allowed only when the previous one already expired, or
  -- when the trainer granted another attempt.
  v_reset := old.deadline_at is null
             or now() >= old.deadline_at
             or exists (
               select 1 from public.quiz_requests qr
               where qr.trainee_id = old.trainee_id
                 and qr.quiz_id = old.quiz_id
                 and qr.status = 'approved'
                 and coalesce((qr.data->>'attemptsUsed')::int, 0)
                     < coalesce((qr.data->>'attemptsGranted')::int, 1)
             );

  if v_reset then
    new.started_at := now();
    new.deadline_at := now() + make_interval(secs => v_limit);
    new.time_limit_seconds := v_limit;
    new.timer_version := 2;
  else
    new.started_at := old.started_at;
    new.deadline_at := old.deadline_at;
    new.time_limit_seconds := old.time_limit_seconds;
    new.timer_version := old.timer_version;
  end if;

  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
    'startedAt', to_jsonb(new.started_at),
    'deadlineAt', to_jsonb(new.deadline_at),
    'timeLimitSeconds', new.time_limit_seconds
  );

  return new;
end;
$$;

drop trigger if exists quiz_sessions_clock on public.quiz_sessions;
create trigger quiz_sessions_clock
  before insert or update on public.quiz_sessions
  for each row execute function public.set_quiz_session_clock();

-- ---------------------------------------------------------------------------
-- Server-side session state (used by the frontend on refresh if it wants the
-- authoritative remaining time).
-- ---------------------------------------------------------------------------
create or replace function public.get_quiz_session_state(p_program_id text, p_quiz_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me      text := public.current_profile_id();
  v_session record;
  v_config  jsonb;
begin
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_session
  from public.quiz_sessions
  where trainee_id = v_me and quiz_id = p_quiz_id
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('exists', false, 'server_time', now());
  end if;

  v_config := public.assessment_config('quiz', p_program_id, p_quiz_id);

  return jsonb_build_object(
    'exists', true,
    'id', v_session.id,
    'program_id', v_session.program_id,
    'quiz_id', v_session.quiz_id,
    'started_at', v_session.started_at,
    'deadline_at', v_session.deadline_at,
    'time_limit_seconds', v_session.time_limit_seconds,
    'remaining_seconds', greatest(0, floor(extract(epoch from (v_session.deadline_at - now()))))::int,
    'expired', now() >= v_session.deadline_at,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.assessment_config(text, text, text) from public, anon, authenticated;
revoke all on function public.assessment_time_limit(text, jsonb) from public, anon, authenticated;
revoke all on function public.normalize_assessment_answer(jsonb) from public, anon, authenticated;
revoke all on function public.grade_assessment(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public._assessment_state(text, text) from public, anon, authenticated;
revoke all on function public._start_assessment_attempt(text, text, text) from public, anon, authenticated;
revoke all on function public._save_assessment_answer(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public._finalize_assessment_attempt(text, text, boolean) from public, anon, authenticated;
revoke all on function public._get_assessment_attempt(text, text) from public, anon, authenticated;

revoke all on function public.start_quiz_attempt(text, text) from public, anon;
revoke all on function public.save_quiz_answer(text, text, jsonb) from public, anon;
revoke all on function public.finalize_quiz_attempt(text) from public, anon;
revoke all on function public.get_quiz_attempt(text) from public, anon;
revoke all on function public.start_exam_attempt(text, text) from public, anon;
revoke all on function public.save_exam_answer(text, text, jsonb) from public, anon;
revoke all on function public.finalize_exam_attempt(text) from public, anon;
revoke all on function public.get_exam_attempt(text) from public, anon;
revoke all on function public.get_quiz_session_state(text, text) from public, anon;

grant execute on function public.start_quiz_attempt(text, text) to authenticated;
grant execute on function public.save_quiz_answer(text, text, jsonb) to authenticated;
grant execute on function public.finalize_quiz_attempt(text) to authenticated;
grant execute on function public.get_quiz_attempt(text) to authenticated;
grant execute on function public.start_exam_attempt(text, text) to authenticated;
grant execute on function public.save_exam_answer(text, text, jsonb) to authenticated;
grant execute on function public.finalize_exam_attempt(text) to authenticated;
grant execute on function public.get_exam_attempt(text) to authenticated;
grant execute on function public.get_quiz_session_state(text, text) to authenticated;
-- ###########################################################################
-- ## supabase/migrations/047_assessment_rls_updates.sql
-- ###########################################################################
-- ============================================================================
-- 047_assessment_rls_updates.sql
-- ----------------------------------------------------------------------------
-- Tighten the assessment tables without changing the shapes the existing
-- frontend reads and writes.
--
--   trainee  -> own attempts; may INSERT (legacy submission) and may re-send
--               the same row (idempotent retry). The BEFORE UPDATE trigger
--               forces every protected field back to its stored value.
--   trainer  -> read attempts for programs assigned to them.
--   admin    -> read all, delete (existing account-cleanup flow). Cannot alter
--               a score or timestamp: the trigger blocks it.
--   answers  -> never directly writable by a client; RPCs own them.
-- ============================================================================

alter table public.quiz_attempts enable row level security;
alter table public.exam_attempts enable row level security;

drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists quiz_attempts_write on public.quiz_attempts;
drop policy if exists quiz_attempts_insert on public.quiz_attempts;
create policy quiz_attempts_insert on public.quiz_attempts
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_attempts_update on public.quiz_attempts;
create policy quiz_attempts_update on public.quiz_attempts
  for update to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin())
  with check (trainee_id = public.current_profile_id() or public.is_super_admin());

drop policy if exists quiz_attempts_delete on public.quiz_attempts;
create policy quiz_attempts_delete on public.quiz_attempts
  for delete to authenticated
  using (public.is_super_admin());

drop policy if exists exam_attempts_select on public.exam_attempts;
create policy exam_attempts_select on public.exam_attempts
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists exam_attempts_write on public.exam_attempts;
drop policy if exists exam_attempts_insert on public.exam_attempts;
create policy exam_attempts_insert on public.exam_attempts
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists exam_attempts_update on public.exam_attempts;
create policy exam_attempts_update on public.exam_attempts
  for update to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin())
  with check (trainee_id = public.current_profile_id() or public.is_super_admin());

drop policy if exists exam_attempts_delete on public.exam_attempts;
create policy exam_attempts_delete on public.exam_attempts
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Answer rows: read-only to trainers/admin, invisible to trainees (the
-- get_*_attempt RPC returns graded answers only after finalization).
-- ---------------------------------------------------------------------------
drop policy if exists quiz_attempt_answers_select on public.quiz_attempt_answers;
create policy quiz_attempt_answers_select on public.quiz_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_attempt_answers.attempt_id
        and (public.is_super_admin() or public.is_trainer_assigned_to_program(a.program_id))
    )
  );

drop policy if exists exam_attempt_answers_select on public.exam_attempt_answers;
create policy exam_attempt_answers_select on public.exam_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = exam_attempt_answers.attempt_id
        and (public.is_super_admin() or public.is_trainer_assigned_to_program(a.program_id))
    )
  );

revoke insert, update, delete on public.quiz_attempt_answers from anon, authenticated;
revoke insert, update, delete on public.exam_attempt_answers from anon, authenticated;
grant select on public.quiz_attempt_answers to authenticated;
grant select on public.exam_attempt_answers to authenticated;

-- ---------------------------------------------------------------------------
-- quiz_sessions: keep the existing author-scoped policies, but make them
-- explicit so a baseline rerun cannot leave a broad write policy behind.
-- ---------------------------------------------------------------------------
drop policy if exists quiz_sessions_select on public.quiz_sessions;
create policy quiz_sessions_select on public.quiz_sessions
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists quiz_sessions_insert on public.quiz_sessions;
create policy quiz_sessions_insert on public.quiz_sessions
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_sessions_update on public.quiz_sessions;
create policy quiz_sessions_update on public.quiz_sessions
  for update to authenticated
  using (trainee_id = public.current_profile_id())
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_sessions_delete on public.quiz_sessions;
create policy quiz_sessions_delete on public.quiz_sessions
  for delete to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin());
-- ###########################################################################
-- ## supabase/migrations/048_expired_attempt_processing.sql
-- ###########################################################################
-- ============================================================================
-- 048_expired_attempt_processing.sql
-- ----------------------------------------------------------------------------
-- Deadline enforcement when nobody is looking at the page.
--
--   1. finalize_expired_attempts() grades RPC-created live attempts whose
--      deadline has passed.
--   2. finalize_expired_quiz_sessions() closes legacy quiz sessions that
--      expired without a submission and records a zero-score forfeited
--      attempt, so the trainee cannot restart the clock by refreshing.
--   3. process_expired_assessments() runs both.
--
-- Schedule it with pg_cron when available. On a Supabase project where pg_cron
-- is not enabled, enable it in Database > Extensions and re-run this file, or
-- call process_expired_assessments() from an external scheduler every minute.
-- The retrieve/save/finalize RPCs also enforce the deadline on access, so the
-- scheduler is a safety net, not the only line of defence.
-- ============================================================================

create or replace function public.finalize_expired_attempts(p_limit int default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_count int := 0;
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 1000);
begin
  for v_row in
    select kind, id
    from (
      select 'quiz'::text as kind, id, deadline_at
      from public.quiz_attempts
      where status = 'in_progress'
        and deadline_at is not null
        and deadline_at < now()
      union all
      select 'exam'::text as kind, id, deadline_at
      from public.exam_attempts
      where status = 'in_progress'
        and deadline_at is not null
        and deadline_at < now()
    ) expired
    order by deadline_at asc
    limit v_limit
  loop
    perform set_config('app.assessment_rpc', 'on', true);
    perform public._finalize_assessment_attempt(v_row.kind, v_row.id, true);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.finalize_expired_quiz_sessions(p_limit int default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_config  jsonb;
  v_total   int;
  v_limit   int := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_count   int := 0;
  v_id      text;
  v_attempts int;
  v_data    jsonb;
begin
  for v_session in
    select *
    from public.quiz_sessions
    where timer_version >= 2
      and deadline_at is not null
      and deadline_at < now() - interval '2 minutes'
    order by deadline_at asc
    limit v_limit
    for update skip locked
  loop
    -- If the trainee did submit, the AFTER INSERT trigger should already have
    -- removed the session. Clean up a leftover row and move on.
    select count(*) into v_attempts
    from public.quiz_attempts
    where trainee_id = v_session.trainee_id
      and data->>'quizId' = v_session.quiz_id;

    if v_attempts > 0 then
      delete from public.quiz_sessions where id = v_session.id;
      continue;
    end if;

    v_config := public.assessment_config('quiz', v_session.program_id, v_session.quiz_id);
    v_total  := jsonb_array_length(coalesce(v_config->'questions', '[]'::jsonb));
    v_id     := 'qa-' || replace(gen_random_uuid()::text, '-', '');

    v_data := jsonb_build_object(
      'quizId', v_session.quiz_id,
      'quizTitle', v_config->>'title',
      'programId', v_session.program_id,
      'startedAt', to_jsonb(v_session.started_at),
      'deadlineAt', to_jsonb(v_session.deadline_at),
      'submittedAt', to_jsonb(now()),
      'autoSubmitted', true,
      'status', 'auto_submitted',
      'answers', '[]'::jsonb,
      'score', 0,
      'total', v_total,
      'percentage', 0,
      'passed', false
    );

    -- The insert is server-authored; the compatibility trigger must not try
    -- to re-grade it or reject it for being late.
    perform set_config('app.assessment_rpc', 'on', true);

    insert into public.quiz_attempts (
      id, trainee_id, program_id, data,
      started_at, deadline_at, submitted_at, time_limit_seconds,
      status, score, total_questions, answered_questions,
      correct_answers, incorrect_answers, unanswered_questions,
      percentage, auto_submitted, created_at, updated_at
    )
    values (
      v_id, v_session.trainee_id, v_session.program_id, v_data,
      v_session.started_at, v_session.deadline_at, now(), v_session.time_limit_seconds,
      'auto_submitted', 0, v_total, 0,
      0, 0, v_total,
      0, true, now(), now()
    );

    delete from public.quiz_sessions where id = v_session.id;
    perform set_config('app.assessment_rpc', 'off', true);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.process_expired_assessments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_sessions int;
begin
  v_attempts := public.finalize_expired_attempts(200);
  v_sessions := public.finalize_expired_quiz_sessions(200);
  return jsonb_build_object(
    'finalized_attempts', v_attempts,
    'finalized_sessions', v_sessions,
    'processed_at', now()
  );
end;
$$;

revoke all on function public.finalize_expired_attempts(int) from public, anon, authenticated;
revoke all on function public.finalize_expired_quiz_sessions(int) from public, anon, authenticated;
revoke all on function public.process_expired_assessments() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.finalize_expired_attempts(int) to service_role;
    grant execute on function public.finalize_expired_quiz_sessions(int) to service_role;
    grant execute on function public.process_expired_assessments() to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Optional pg_cron schedule (every minute).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron could not be enabled automatically: %', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      if exists (select 1 from cron.job where jobname = 'process-expired-assessments') then
        perform cron.unschedule('process-expired-assessments');
      end if;
      perform cron.schedule(
        'process-expired-assessments',
        '* * * * *',
        'select public.process_expired_assessments();'
      );
      raise notice 'Scheduled process-expired-assessments every minute.';
    exception when others then
      raise notice 'Could not create the pg_cron job: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not enabled. Enable it in Database > Extensions and re-run 048, or call process_expired_assessments() from an external scheduler.';
  end if;
end $$;

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

-- ============================================================================
-- 050_auto_complete_enrollments.sql
-- ----------------------------------------------------------------------------
-- Marks an enrollment "Completed" as soon as the trainee has actually finished
-- the program: every published lesson done, every published quiz passed and
-- every published exam passed. The status is a database decision, not a
-- frontend one, so the feedback eligibility rule that depends on it cannot be
-- triggered by navigating to a page.
--
-- Triggers:
--   enrollments      AFTER INSERT/UPDATE OF data, status  -> re-evaluate
--   quiz_attempts    AFTER INSERT/UPDATE OF percentage,status -> re-evaluate
--   exam_attempts    AFTER INSERT/UPDATE OF percentage,status -> re-evaluate
--
-- The update sets app.completion_sync so the enrollments trigger does not
-- recurse, and every trigger body swallows its own errors: a completion
-- bookkeeping failure must never reject a trainee's quiz/exam submission.
--
-- Additive and idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Requirement snapshot (ignores the enrollment status).
-- ---------------------------------------------------------------------------
create or replace function public.enrollment_requirements_met(p_enrollment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e              record;
  v_p              record;
  v_progress       jsonb;
  v_lesson_ids     text[];
  v_lessons_total  int := 0;
  v_lessons_done   int := 0;
  v_quizzes_total  int := 0;
  v_quizzes_passed int := 0;
  v_exams_total    int := 0;
  v_exams_passed   int := 0;
  v_met            boolean := false;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object('met', false, 'reason', 'enrollment_not_found');
  end if;

  select * into v_p from public.programs where id = v_e.program_id;
  if not found then
    return jsonb_build_object('met', false, 'reason', 'program_not_found');
  end if;

  v_progress   := coalesce(v_e.data->'progress', '{}'::jsonb);
  v_lesson_ids := public.program_lesson_ids(v_e.program_id);
  v_lessons_total := coalesce(array_length(v_lesson_ids, 1), 0);

  select count(*) into v_lessons_done
  from unnest(v_lesson_ids) lid
  where lower(coalesce(v_progress->>lid, '')) in ('true', 't', '1', 'yes');

  select count(*) into v_quizzes_total
  from jsonb_array_elements(coalesce(v_p.data->'quizzes', '[]'::jsonb)) q
  where coalesce((q->>'published')::boolean, true)
    and (
      coalesce(q->>'lessonId', '') = ''
      or (q->>'lessonId') = any(v_lesson_ids)
    );

  select count(*) into v_quizzes_passed
  from jsonb_array_elements(coalesce(v_p.data->'quizzes', '[]'::jsonb)) q
  where coalesce((q->>'published')::boolean, true)
    and (
      coalesce(q->>'lessonId', '') = ''
      or (q->>'lessonId') = any(v_lesson_ids)
    )
    and exists (
      select 1
      from public.quiz_attempts qa
      where qa.trainee_id = v_e.trainee_id
        and qa.program_id = v_e.program_id
        and qa.data->>'quizId' = q->>'id'
        and coalesce(qa.percentage, nullif(qa.data->>'percentage', '')::numeric, 0)
            >= coalesce(nullif(q->>'passing', '')::numeric, 75)
    );

  select count(*) into v_exams_total
  from jsonb_array_elements(coalesce(v_p.data->'exams', '[]'::jsonb)) e
  where coalesce((e->>'published')::boolean, true);

  select count(*) into v_exams_passed
  from jsonb_array_elements(coalesce(v_p.data->'exams', '[]'::jsonb)) e
  where coalesce((e->>'published')::boolean, true)
    and exists (
      select 1
      from public.exam_attempts ea
      where ea.trainee_id = v_e.trainee_id
        and ea.program_id = v_e.program_id
        and ea.data->>'examId' = e->>'id'
        and coalesce(ea.percentage, nullif(ea.data->>'percentage', '')::numeric, 0)
            >= coalesce(nullif(e->>'passing', '')::numeric, 75)
    );

  -- A program with no lessons at all is still being authored: never complete.
  v_met := v_lessons_total > 0
           and v_lessons_done >= v_lessons_total
           and v_quizzes_passed >= v_quizzes_total
           and v_exams_passed >= v_exams_total;

  return jsonb_build_object(
    'met', v_met,
    'program_id', v_e.program_id,
    'trainee_id', v_e.trainee_id,
    'lessons_total', v_lessons_total,
    'lessons_completed', v_lessons_done,
    'quizzes_total', v_quizzes_total,
    'quizzes_passed', v_quizzes_passed,
    'exams_total', v_exams_total,
    'exams_passed', v_exams_passed
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- course_completion() now delegates, so there is one definition of "done".
-- Output keys are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.course_completion(p_enrollment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e      record;
  v_req    jsonb;
  v_reasons text[] := array[]::text[];
  v_status text;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object(
      'complete', false,
      'status_completed', false,
      'reasons', jsonb_build_array('enrollment_not_found')
    );
  end if;

  v_req    := public.enrollment_requirements_met(p_enrollment_id);
  v_status := v_e.status;

  if v_status is distinct from 'Completed' then
    v_reasons := array_append(v_reasons, 'enrollment_not_completed');
  end if;
  if coalesce((v_req->>'lessons_completed')::int, 0) < coalesce((v_req->>'lessons_total')::int, 0) then
    v_reasons := array_append(v_reasons, 'lessons_incomplete');
  end if;
  if coalesce((v_req->>'quizzes_passed')::int, 0) < coalesce((v_req->>'quizzes_total')::int, 0) then
    v_reasons := array_append(v_reasons, 'quizzes_incomplete');
  end if;
  if coalesce((v_req->>'exams_passed')::int, 0) < coalesce((v_req->>'exams_total')::int, 0) then
    v_reasons := array_append(v_reasons, 'exams_incomplete');
  end if;

  return jsonb_build_object(
    'complete', v_status = 'Completed' and coalesce((v_req->>'met')::boolean, false),
    'status_completed', v_status = 'Completed',
    'status', v_status,
    'lessons_total', coalesce((v_req->>'lessons_total')::int, 0),
    'lessons_completed', coalesce((v_req->>'lessons_completed')::int, 0),
    'quizzes_total', coalesce((v_req->>'quizzes_total')::int, 0),
    'quizzes_passed', coalesce((v_req->>'quizzes_passed')::int, 0),
    'exams_total', coalesce((v_req->>'exams_total')::int, 0),
    'exams_passed', coalesce((v_req->>'exams_passed')::int, 0),
    'reasons', to_jsonb(v_reasons)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- sync_enrollment_completion(enrollment_id)
--   Idempotent. Completes only when the requirements are met AND the current
--   status is still an "in progress" one; a Cancelled/Dropped record is never
--   resurrected, and a Completed record is never touched.
-- ---------------------------------------------------------------------------
create or replace function public.sync_enrollment_completion(p_enrollment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e   record;
  v_req jsonb;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id for update;
  if not found then
    return jsonb_build_object('changed', false, 'reason', 'enrollment_not_found');
  end if;

  v_req := public.enrollment_requirements_met(p_enrollment_id);

  if v_e.status = 'Completed' then
    return jsonb_build_object('changed', false, 'status', v_e.status, 'reason', 'already_completed', 'requirements', v_req);
  end if;

  if lower(coalesce(v_e.status, '')) not in ('enrolled', 'approved', 'ongoing', 'active') then
    return jsonb_build_object('changed', false, 'status', v_e.status, 'reason', 'status_not_eligible', 'requirements', v_req);
  end if;

  if not coalesce((v_req->>'met')::boolean, false) then
    return jsonb_build_object('changed', false, 'status', v_e.status, 'reason', 'requirements_not_met', 'requirements', v_req);
  end if;

  perform set_config('app.completion_sync', 'on', true);
  update public.enrollments
     set status = 'Completed',
         updated_at = now()
   where id = p_enrollment_id;
  perform set_config('app.completion_sync', 'off', true);

  perform public.write_audit(
    'ENROLLMENT_AUTO_COMPLETED',
    'enrollments',
    p_enrollment_id,
    jsonb_build_object(
      'previous_status', v_e.status,
      'program_id', v_e.program_id,
      'trainee_id', v_e.trainee_id,
      'requirements', v_req
    )
  );

  return jsonb_build_object(
    'changed', true,
    'status', 'Completed',
    'previous_status', v_e.status,
    'requirements', v_req
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger bodies
-- ---------------------------------------------------------------------------
create or replace function public.auto_complete_enrollment_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.completion_sync', true), '') = 'on' then
    return new;
  end if;
  begin
    perform public.sync_enrollment_completion(new.id);
  exception when others then
    raise warning 'auto-completion skipped for enrollment %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.auto_complete_from_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  for v_id in
    select e.id
    from public.enrollments e
    where e.trainee_id = new.trainee_id
      and e.program_id = new.program_id
      and coalesce(e.status, '') <> 'Completed'
  loop
    begin
      perform public.sync_enrollment_completion(v_id);
    exception when others then
      raise warning 'auto-completion skipped for enrollment %: %', v_id, sqlerrm;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists enrollments_auto_complete on public.enrollments;
create trigger enrollments_auto_complete
  after insert or update of data, status on public.enrollments
  for each row execute function public.auto_complete_enrollment_trigger();

drop trigger if exists quiz_attempts_auto_complete on public.quiz_attempts;
create trigger quiz_attempts_auto_complete
  after insert or update of percentage, status on public.quiz_attempts
  for each row execute function public.auto_complete_from_attempt();

drop trigger if exists exam_attempts_auto_complete on public.exam_attempts;
create trigger exam_attempts_auto_complete
  after insert or update of percentage, status on public.exam_attempts
  for each row execute function public.auto_complete_from_attempt();

-- ---------------------------------------------------------------------------
-- Backfill / manual sweep. Returns how many enrollments were completed.
-- ---------------------------------------------------------------------------
create or replace function public.sync_all_enrollment_completion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      text;
  v_changed int := 0;
  v_scanned int := 0;
  v_result  jsonb;
begin
  for v_id in
    select id from public.enrollments
    where lower(coalesce(status, '')) in ('enrolled', 'approved', 'ongoing', 'active')
  loop
    v_scanned := v_scanned + 1;
    v_result := public.sync_enrollment_completion(v_id);
    if coalesce((v_result->>'changed')::boolean, false) then
      v_changed := v_changed + 1;
    end if;
  end loop;
  return jsonb_build_object('scanned', v_scanned, 'completed', v_changed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: internal only. Trainees reach completion through the triggers, never
-- by calling these directly.
-- ---------------------------------------------------------------------------
revoke all on function public.enrollment_requirements_met(text) from public, anon, authenticated;
revoke all on function public.sync_enrollment_completion(text) from public, anon, authenticated;
revoke all on function public.sync_all_enrollment_completion() from public, anon, authenticated;
revoke all on function public.auto_complete_enrollment_trigger() from public, anon, authenticated;
revoke all on function public.auto_complete_from_attempt() from public, anon, authenticated;

grant execute on function public.sync_all_enrollment_completion() to service_role;
grant execute on function public.sync_enrollment_completion(text) to service_role;

-- ============================================================================
-- 051_feedback_visibility.sql
-- ----------------------------------------------------------------------------
-- Policy change: qualitative feedback is visible to the trainee who wrote it
-- and to the Super Admin (AAL2) only. A trainer no longer sees the feedback
-- written about them, so the trainer-facing read path is removed entirely.
--
-- Quantitative ratings (trainer_ratings) are unaffected; trainers can still see
-- their star average through that table's existing policies.
-- ============================================================================

drop policy if exists trainer_feedback_select on public.trainer_feedback;

create policy trainer_feedback_select on public.trainer_feedback
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin_mfa()
  );

-- No write policies on purpose: submission and corrections are definer RPCs.
drop policy if exists trainer_feedback_insert on public.trainer_feedback;
drop policy if exists trainer_feedback_update on public.trainer_feedback;
drop policy if exists trainer_feedback_delete on public.trainer_feedback;

revoke insert, update, delete on public.trainer_feedback from anon, authenticated;
grant select on public.trainer_feedback to authenticated;

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
