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
-- the 5-program catalog plus ONE Super Admin account.
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

-- The 5-program catalog seed is appended below by scripts/gen-programs.mjs

-- =======================  SEED: PROGRAM CATALOG  =======================
-- The 5 training programs with their lessons, quizzes and exams.
-- Safe to re-run (upsert by id).

insert into public.programs (id, code, title, trainer_id, data)
values ('housekeeping', 'HK-102', 'Housekeeping NC II', 'tr-001', $prog${"id":"housekeeping","code":"HK-102","title":"Housekeeping NC II","category":"Tourism & Hospitality","level":"NC II","special":false,"enrollable":false,"description":"Prepare trainees to clean and prepare guest rooms, handle linen, and deliver quality housekeeping services in hotels and resorts.","overview":"The Housekeeping NC II program equips trainees with the skills to maintain cleanliness and orderliness in guest rooms and public areas of hospitality establishments. It covers room cleaning, bed making, bathroom sanitation, linen management and guest room inspection.","duration":"3 months","hours":160,"fee":8500,"color":"from-sky-500 to-blue-600","emoji":"🧹","image":"https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=60","requirements":["At least 18 years old","High School graduate or ALS equivalent","Physically fit (medical certificate)","Birth certificate (PSA)","2 pcs. 2x2 ID picture","Barangay clearance"],"trainerId":"tr-001","competencies":[{"id":"housekeeping-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"housekeeping-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"housekeeping-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"housekeeping-basic-q1"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"housekeeping-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"housekeeping-basic-q2"},{"videoUrl":"","published":true,"order":3,"id":"housekeeping-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"housekeeping-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"housekeeping-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"housekeeping-basic-q3"},{"videoUrl":"","published":true,"order":4,"id":"housekeeping-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"housekeeping-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"housekeeping-basic-q4"}]},{"id":"housekeeping-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"housekeeping-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"housekeeping-common-q1"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"housekeeping-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"housekeeping-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"housekeeping-common-q2"},{"videoUrl":"","published":true,"order":3,"id":"housekeeping-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"housekeeping-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"housekeeping-common-q3"},{"videoUrl":"","published":true,"order":4,"id":"housekeeping-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"housekeeping-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"housekeeping-common-q4"}]},{"id":"housekeeping-core","type":"Core","title":"Core Competency","description":"The core competencies of Housekeeping NC II: preparing guest rooms, cleaning procedures, bed making, bathroom cleaning, and guest room inspection.","lessons":[],"units":[{"id":"housekeeping-core-u1","title":"Room Cleaning Procedures","description":"Clean and prepare guest rooms according to establishment standards.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u1-l1","title":"Introduction to Housekeeping Operations","description":"Understand the role of housekeeping in the hospitality industry.","duration":45,"video":"Introduction to Housekeeping Operations","materials":[{"id":"housekeeping-core-u1-l1-m1","name":"Housekeeping Dept. Overview.pdf","type":"pdf","url":""}],"content":"Housekeeping is the heart of hospitality. This lesson introduces the department structure, roles and responsibilities, grooming standards, and the importance of cleanliness to guest satisfaction.","quizId":"housekeeping-quiz-1"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-core-u1-l2","title":"Cleaning Equipment & Chemicals","description":"Identify, use and maintain cleaning tools, equipment and chemicals safely.","duration":50,"video":"Cleaning Equipment & Chemicals","materials":[{"id":"housekeeping-core-u1-l2-m1","name":"Cleaning Equipment Catalogue.pdf","type":"pdf","url":""},{"id":"housekeeping-core-u1-l2-m2","name":"Chemical Safety Data Sheet.pdf","type":"pdf","url":""}],"content":"Learn to identify common cleaning equipment such as vacuum cleaners, mops, and caddies. Understand chemical dilution, safety data sheets, and proper storage.","quizId":"housekeeping-quiz-2"},{"videoUrl":"","published":true,"order":3,"id":"housekeeping-core-u1-l3","title":"Guest Room Preparation","description":"Systematically clean and prepare a guest room for occupancy.","duration":60,"video":"Guest Room Preparation","materials":[{"id":"housekeeping-core-u1-l3-m1","name":"Room Cleaning Checklist.pdf","type":"pdf","url":""}],"content":"Follow the standard sequence for guest room cleaning: entering the room, dusting, bed making, bathroom cleaning, replenishing supplies, and final inspection.","quizId":"housekeeping-quiz-3"}]},{"id":"housekeeping-core-u2","title":"Bed Making & Linen Handling","description":"Perform professional bed making and manage linen inventory.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u2-l1","title":"Bed Making Techniques","description":"Make beds to hotel standards including bed stripping and triple sheeting.","duration":45,"video":"Bed Making Techniques","materials":[{"id":"housekeeping-core-u2-l1-m1","name":"Bed Making Steps.pdf","type":"pdf","url":""}],"content":"Learn the step-by-step process of stripping, making, and inspecting a bed. Covers fitted sheets, flat sheets, duvets, pillowcases and decorative arrangements.","quizId":"housekeeping-quiz-1"},{"videoUrl":"","published":true,"order":2,"id":"housekeeping-core-u2-l2","title":"Linen Room Management","description":"Sort, store and control linen inventory and laundering.","duration":40,"video":"Linen Room Management","materials":[{"id":"housekeeping-core-u2-l2-m1","name":"Linen Inventory Sheet.pdf","type":"pdf","url":""}],"content":"Manage linen par levels, sort soiled linen, coordinate with laundry, and maintain linen room organization to avoid losses.","quizId":"housekeeping-quiz-2"}]},{"id":"housekeeping-core-u3","title":"Bathroom Cleaning & Sanitation","description":"Deep-clean and sanitize bathrooms using proper techniques.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u3-l1","title":"Bathroom Cleaning Sequence","description":"Clean and sanitize all bathroom fixtures and surfaces.","duration":50,"video":"Bathroom Cleaning Sequence","materials":[{"id":"housekeeping-core-u3-l1-m1","name":"Bathroom Cleaning Guide.pdf","type":"pdf","url":""}],"content":"Learn top-to-bottom bathroom cleaning: mirrors, sink, toilet, shower/bathtub, floor, and amenities replenishment. Emphasizes hygiene and cross-contamination prevention.","quizId":"housekeeping-quiz-3"}]},{"id":"housekeeping-core-u4","title":"Guest Room Inspection","description":"Inspect rooms and handle guest requests and complaints.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"housekeeping-core-u4-l1","title":"Room Inspection Standards","description":"Apply quality standards during guest room inspection.","duration":45,"video":"Room Inspection Standards","materials":[{"id":"housekeeping-core-u4-l1-m1","name":"Inspection Standards.pdf","type":"pdf","url":""}],"content":"Use inspection checklists to verify cleanliness, functionality, and presentation. Learn how to document and escalate issues.","quizId":"housekeeping-quiz-1"}]}]}],"quizzes":[{"id":"housekeeping-quiz-1","programId":"housekeeping","title":"Housekeeping Safety & Sanitation Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"housekeeping-quiz-1-q1","type":"mcq","q":"Which chemical is best for disinfecting bathroom surfaces?","options":["Bleach solution","Cooking oil","Shampoo","Fabric softener"],"answer":"Bleach solution"},{"id":"housekeeping-quiz-1-q2","type":"tf","q":"Cleaning chemicals should always be stored in unlabeled containers.","answer":false},{"id":"housekeeping-quiz-1-q3","type":"id","q":"The process of removing dirt and germs from surfaces is called ______.","answer":"sanitizing"},{"id":"housekeeping-quiz-1-q4","type":"mcq","q":"What is the correct order when cleaning a guest room?","options":["Bathroom first, then bedroom","Dust top to bottom","Clean floor first","Make bed last only"],"answer":"Dust top to bottom"},{"id":"housekeeping-quiz-1-q5","type":"tf","q":"Wet floor signs should be placed after mopping to prevent accidents.","answer":true}]},{"id":"housekeeping-quiz-2","programId":"housekeeping","title":"Room Cleaning Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"housekeeping-quiz-2-q1","type":"mcq","q":"How many flat sheets are typically used in triple sheeting?","options":["One","Two","Three","Four"],"answer":"Three"},{"id":"housekeeping-quiz-2-q2","type":"tf","q":"You should knock and announce yourself before entering an occupied guest room.","answer":true},{"id":"housekeeping-quiz-2-q3","type":"id","q":"A _____ is used to collect dirty linen and trash from guest rooms.","answer":"caddie"},{"id":"housekeeping-quiz-2-q4","type":"mcq","q":"Which area should be cleaned first in a bathroom?","options":["Floor","Mirror and sink","Toilet","Shower"],"answer":"Mirror and sink"},{"id":"housekeeping-quiz-2-q5","type":"tf","q":"A guest room should be inspected before being released for occupancy.","answer":true}]},{"id":"housekeeping-quiz-3","programId":"housekeeping","title":"Bed Making & Linen Quiz","passing":75,"timeLimit":8,"published":true,"questions":[{"id":"housekeeping-quiz-3-q1","type":"mcq","q":"What is the first step in bed making?","options":["Stripping the bed","Placing the duvet","Fluffing pillows","Vacuuming"],"answer":"Stripping the bed"},{"id":"housekeeping-quiz-3-q2","type":"tf","q":"Soiled linen should be sorted by color and fabric type.","answer":true},{"id":"housekeeping-quiz-3-q3","type":"id","q":"The minimum stock of linen kept on hand is called the _____ level.","answer":"par"},{"id":"housekeeping-quiz-3-q4","type":"mcq","q":"Where should dirty linen never be placed?","options":["On the floor","In a linen bag","In a cart","In a hamper"],"answer":"On the floor"}]}],"exams":[{"id":"housekeeping-exam-1","programId":"housekeeping","title":"Housekeeping NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"housekeeping-exam-1-q1","type":"mcq","q":"Which chemical is best for disinfecting bathroom surfaces?","options":["Bleach solution","Cooking oil","Shampoo","Fabric softener"],"answer":"Bleach solution"},{"id":"housekeeping-exam-1-q2","type":"tf","q":"Cleaning chemicals should always be stored in unlabeled containers.","answer":false},{"id":"housekeeping-exam-1-q3","type":"id","q":"The process of removing dirt and germs from surfaces is called ______.","answer":"sanitizing"},{"id":"housekeeping-exam-1-q4","type":"mcq","q":"What is the correct order when cleaning a guest room?","options":["Bathroom first, then bedroom","Dust top to bottom","Clean floor first","Make bed last only"],"answer":"Dust top to bottom"},{"id":"housekeeping-exam-1-q5","type":"tf","q":"Wet floor signs should be placed after mopping to prevent accidents.","answer":true},{"id":"housekeeping-exam-1-q6","type":"mcq","q":"How many flat sheets are typically used in triple sheeting?","options":["One","Two","Three","Four"],"answer":"Three"},{"id":"housekeeping-exam-1-q7","type":"tf","q":"You should knock and announce yourself before entering an occupied guest room.","answer":true},{"id":"housekeeping-exam-1-q8","type":"id","q":"A _____ is used to collect dirty linen and trash from guest rooms.","answer":"caddie"},{"id":"housekeeping-exam-1-q9","type":"mcq","q":"Which area should be cleaned first in a bathroom?","options":["Floor","Mirror and sink","Toilet","Shower"],"answer":"Mirror and sink"},{"id":"housekeeping-exam-1-q10","type":"tf","q":"A guest room should be inspected before being released for occupancy.","answer":true}],"questionCount":10,"timeLimit":30,"passing":75,"date":"2026-11-20","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('barista', 'BAR-204', 'Barista NC II', 'tr-002', $prog${"id":"barista","code":"BAR-204","title":"Barista NC II","category":"Tourism & Hospitality","level":"NC II","special":false,"enrollable":false,"description":"Train in coffee preparation, espresso extraction, milk steaming and latte art to become a professional barista.","overview":"The Barista NC II program develops the skills required to prepare and serve a variety of espresso-based and brewed coffee beverages. It covers coffee fundamentals, espresso preparation, milk texturing, latte art, and beverage menu preparation with excellent customer service.","duration":"2 months","hours":120,"fee":7500,"color":"from-amber-500 to-orange-600","emoji":"☕","image":"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=60","requirements":["At least 18 years old","High School graduate or ALS equivalent","Physically fit (medical certificate)","Birth certificate (PSA)","2 pcs. 2x2 ID picture","Barangay clearance"],"trainerId":"tr-002","competencies":[{"id":"barista-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"barista-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"barista-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"barista-basic-q1"},{"videoUrl":"","published":true,"order":2,"id":"barista-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"barista-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"barista-basic-q2"},{"videoUrl":"","published":true,"order":3,"id":"barista-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"barista-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"barista-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"barista-basic-q3"},{"videoUrl":"","published":true,"order":4,"id":"barista-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"barista-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"barista-basic-q4"}]},{"id":"barista-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"barista-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"barista-common-q1"},{"videoUrl":"","published":true,"order":2,"id":"barista-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"barista-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"barista-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"barista-common-q2"},{"videoUrl":"","published":true,"order":3,"id":"barista-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"barista-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"barista-common-q3"},{"videoUrl":"","published":true,"order":4,"id":"barista-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"barista-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"barista-common-q4"}]},{"id":"barista-core","type":"Core","title":"Core Competency","description":"Core competencies of Barista NC II: coffee fundamentals, espresso preparation, milk steaming and latte art, and beverage menu preparation.","lessons":[],"units":[{"id":"barista-core-u1","title":"Coffee Fundamentals","description":"Understand coffee varieties, origins, roasting and flavor profiles.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u1-l1","title":"Introduction to Coffee","description":"Explore the history, varieties and journey of coffee from bean to cup.","duration":45,"video":"Introduction to Coffee","materials":[{"id":"barista-core-u1-l1-m1","name":"Coffee Origins Chart.pdf","type":"pdf","url":""}],"content":"Learn about Arabica and Robusta, coffee-growing regions, processing methods, and how origin and roast affect flavor.","quizId":"barista-quiz-1"},{"videoUrl":"","published":true,"order":2,"id":"barista-core-u1-l2","title":"Coffee Roasting & Grinding","description":"Understand roast levels and proper grinding for different brew methods.","duration":50,"video":"Coffee Roasting & Grinding","materials":[{"id":"barista-core-u1-l2-m1","name":"Grind Size Guide.pdf","type":"pdf","url":""}],"content":"Roast level dramatically affects taste. Learn light, medium and dark roasts, and how grind size must match the brewing method.","quizId":"barista-quiz-2"}]},{"id":"barista-core-u2","title":"Espresso Preparation","description":"Calibrate and extract consistent, high-quality espresso shots.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u2-l1","title":"The Espresso Machine","description":"Operate and maintain the espresso machine and grinder.","duration":55,"video":"The Espresso Machine","materials":[{"id":"barista-core-u2-l1-m1","name":"Espresso Machine Manual.pdf","type":"pdf","url":""}],"content":"Identify machine parts, understand pressure and temperature, and perform daily cleaning and backflushing routines.","quizId":"barista-quiz-3"},{"videoUrl":"","published":true,"order":2,"id":"barista-core-u2-l2","title":"Dialing In the Shot","description":"Adjust grind and dose to achieve ideal extraction.","duration":50,"video":"Dialing In the Shot","materials":[{"id":"barista-core-u2-l2-m1","name":"Extraction Troubleshooting.pdf","type":"pdf","url":""}],"content":"Learn to diagnose over- and under-extraction, adjust grind, dose and tamp, and taste-test to standardize your espresso.","quizId":"barista-quiz-1"}]},{"id":"barista-core-u3","title":"Milk Steaming & Latte Art","description":"Steam milk to the correct texture and pour latte art.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u3-l1","title":"Milk Texturing","description":"Steam milk to create microfoam for espresso beverages.","duration":45,"video":"Milk Texturing","materials":[{"id":"barista-core-u3-l1-m1","name":"Milk Steaming Steps.pdf","type":"pdf","url":""}],"content":"Learn proper milk steaming technique for different temperatures and textures, including dairy and alternative milks.","quizId":"barista-quiz-2"},{"videoUrl":"","published":true,"order":2,"id":"barista-core-u3-l2","title":"Basic Latte Art","description":"Pour a heart and rosetta using free-pour technique.","duration":50,"video":"Basic Latte Art","materials":[{"id":"barista-core-u3-l2-m1","name":"Latte Art Reference.pdf","type":"pdf","url":""}],"content":"Master milk-pitcher control to pour hearts, tulips and rosettas. Practice consistency and cup presentation.","quizId":"barista-quiz-3"}]},{"id":"barista-core-u4","title":"Beverage Menu & Customer Service","description":"Prepare the full beverage menu and serve customers.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"barista-core-u4-l1","title":"Building the Beverage Menu","description":"Prepare espresso-based and brewed beverages to recipe.","duration":55,"video":"Building the Beverage Menu","materials":[{"id":"barista-core-u4-l1-m1","name":"Standard Recipes.pdf","type":"pdf","url":""}],"content":"Prepare Americano, cappuccino, latte, flat white, mocha, and manual brews following standard recipes and presentation.","quizId":"barista-quiz-1"}]}]}],"quizzes":[{"id":"barista-quiz-1","programId":"barista","title":"Coffee Fundamentals Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"barista-quiz-1-q1","type":"mcq","q":"Which coffee species is generally considered higher quality?","options":["Arabica","Robusta","Liberica","Excelsa"],"answer":"Arabica"},{"id":"barista-quiz-1-q2","type":"tf","q":"Finer grind is used for espresso than for French press.","answer":true},{"id":"barista-quiz-1-q3","type":"id","q":"The process of heating milk with steam to create foam is called ______.","answer":"steaming"},{"id":"barista-quiz-1-q4","type":"mcq","q":"A darker roast generally produces what flavor?","options":["Smoky and bitter","Fruity and bright","Floral and light","Sour"],"answer":"Smoky and bitter"},{"id":"barista-quiz-1-q5","type":"tf","q":"Coffee beans should be stored in an airtight container away from light.","answer":true}]},{"id":"barista-quiz-2","programId":"barista","title":"Espresso Preparation Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"barista-quiz-2-q1","type":"mcq","q":"A standard single espresso shot is approximately how many ounces?","options":["1 oz","3 oz","5 oz","8 oz"],"answer":"1 oz"},{"id":"barista-quiz-2-q2","type":"tf","q":"Under-extracted espresso tastes sour and thin.","answer":true},{"id":"barista-quiz-2-q3","type":"id","q":"The tool used to level and press coffee grounds is called a ______.","answer":"tamper"},{"id":"barista-quiz-2-q4","type":"mcq","q":"What is the ideal espresso extraction time for a double shot?","options":["20-30 seconds","5 seconds","60 seconds","2 minutes"],"answer":"20-30 seconds"}]},{"id":"barista-quiz-3","programId":"barista","title":"Milk Steaming & Latte Art Quiz","passing":75,"timeLimit":8,"published":true,"questions":[{"id":"barista-quiz-3-q1","type":"mcq","q":"The ideal microfoam texture is best described as:","options":["Glossy wet paint","Dry and stiff","Large bubbles","Watery"],"answer":"Glossy wet paint"},{"id":"barista-quiz-3-q2","type":"tf","q":"Milk should be steamed to about 60-65°C for best taste.","answer":true},{"id":"barista-quiz-3-q3","type":"id","q":"The free-pour pattern that looks like a leaf is called a ______.","answer":"rosetta"},{"id":"barista-quiz-3-q4","type":"mcq","q":"Over-steaming milk results in:","options":["Burnt, flat taste","Sweet flavor","Better foam","Colder milk"],"answer":"Burnt, flat taste"}]}],"exams":[{"id":"barista-exam-1","programId":"barista","title":"Barista NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"barista-exam-1-q1","type":"mcq","q":"Which coffee species is generally considered higher quality?","options":["Arabica","Robusta","Liberica","Excelsa"],"answer":"Arabica"},{"id":"barista-exam-1-q2","type":"tf","q":"Finer grind is used for espresso than for French press.","answer":true},{"id":"barista-exam-1-q3","type":"id","q":"The process of heating milk with steam to create foam is called ______.","answer":"steaming"},{"id":"barista-exam-1-q4","type":"mcq","q":"A darker roast generally produces what flavor?","options":["Smoky and bitter","Fruity and bright","Floral and light","Sour"],"answer":"Smoky and bitter"},{"id":"barista-exam-1-q5","type":"tf","q":"Coffee beans should be stored in an airtight container away from light.","answer":true},{"id":"barista-exam-1-q6","type":"mcq","q":"A standard single espresso shot is approximately how many ounces?","options":["1 oz","3 oz","5 oz","8 oz"],"answer":"1 oz"},{"id":"barista-exam-1-q7","type":"tf","q":"Under-extracted espresso tastes sour and thin.","answer":true},{"id":"barista-exam-1-q8","type":"id","q":"The tool used to level and press coffee grounds is called a ______.","answer":"tamper"},{"id":"barista-exam-1-q9","type":"mcq","q":"What is the ideal espresso extraction time for a double shot?","options":["20-30 seconds","5 seconds","60 seconds","2 minutes"],"answer":"20-30 seconds"},{"id":"barista-exam-1-q10","type":"mcq","q":"The ideal microfoam texture is best described as:","options":["Glossy wet paint","Dry and stiff","Large bubbles","Watery"],"answer":"Glossy wet paint"}],"questionCount":10,"timeLimit":30,"passing":75,"date":"2026-11-25","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('hilot', 'HIL-306', 'Hilot (Wellness Massage) NC II', 'tr-003', $prog${"id":"hilot","code":"HIL-306","title":"Hilot (Wellness Massage) NC II","category":"Health & Wellness","level":"NC II","special":false,"enrollable":false,"description":"Learn traditional Filipino hilot and therapeutic massage techniques for wellness and spa establishments.","overview":"The Hilot (Wellness Massage) NC II program trains individuals in the art and science of Filipino hilot and therapeutic massage. It covers anatomy and physiology, massage techniques, full-body massage sequences, and professional client care and spa operations.","duration":"3 months","hours":150,"fee":9000,"color":"from-emerald-500 to-teal-600","emoji":"💆","image":"https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=60","requirements":["At least 18 years old","High School graduate or ALS equivalent","Physically fit (medical certificate)","Negative skin test / health clearance","Birth certificate (PSA)","2 pcs. 2x2 ID picture"],"trainerId":"tr-003","competencies":[{"id":"hilot-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"hilot-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"hilot-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"hilot-basic-q1"},{"videoUrl":"","published":true,"order":2,"id":"hilot-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"hilot-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"hilot-basic-q2"},{"videoUrl":"","published":true,"order":3,"id":"hilot-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"hilot-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"hilot-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"hilot-basic-q3"},{"videoUrl":"","published":true,"order":4,"id":"hilot-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"hilot-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"hilot-basic-q4"}]},{"id":"hilot-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"hilot-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"hilot-common-q1"},{"videoUrl":"","published":true,"order":2,"id":"hilot-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"hilot-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"hilot-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"hilot-common-q2"},{"videoUrl":"","published":true,"order":3,"id":"hilot-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"hilot-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"hilot-common-q3"},{"videoUrl":"","published":true,"order":4,"id":"hilot-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"hilot-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"hilot-common-q4"}]},{"id":"hilot-core","type":"Core","title":"Core Competency","description":"Core competencies of Hilot NC II: anatomy and physiology, hilot techniques, full-body massage sequence, and client care.","lessons":[],"units":[{"id":"hilot-core-u1","title":"Anatomy & Physiology Fundamentals","description":"Understand the human body systems relevant to massage therapy.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u1-l1","title":"Skeletal & Muscular System","description":"Identify major bones, muscles and joints of the human body.","duration":55,"video":"Skeletal & Muscular System","materials":[{"id":"hilot-core-u1-l1-m1","name":"Anatomy Charts.pdf","type":"pdf","url":""}],"content":"Learn the structure of the skeletal and muscular systems, muscle groups, and how they relate to massage techniques.","quizId":"hilot-quiz-1"},{"videoUrl":"","published":true,"order":2,"id":"hilot-core-u1-l2","title":"Circulatory & Lymphatic Systems","description":"Understand circulation and lymph flow for therapeutic massage.","duration":45,"video":"Circulatory & Lymphatic Systems","materials":[{"id":"hilot-core-u1-l2-m1","name":"Circulatory System Notes.pdf","type":"pdf","url":""}],"content":"Understand how massage affects blood circulation and lymphatic drainage, and why direction of strokes matters.","quizId":"hilot-quiz-2"}]},{"id":"hilot-core-u2","title":"Hilot Techniques & Fundamentals","description":"Apply traditional Filipino hilot massage techniques.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u2-l1","title":"Introduction to Hilot","description":"Understand the history and philosophy of Filipino hilot.","duration":45,"video":"Introduction to Hilot","materials":[{"id":"hilot-core-u2-l1-m1","name":"Hilot History & Ethics.pdf","type":"pdf","url":""}],"content":"Explore the traditional Filipino healing art of hilot, its cultural roots, and its modern therapeutic application.","quizId":"hilot-quiz-3"},{"videoUrl":"","published":true,"order":2,"id":"hilot-core-u2-l2","title":"Basic Massage Strokes","description":"Perform effleurage, petrissage, tapotement and friction.","duration":60,"video":"Basic Massage Strokes","materials":[{"id":"hilot-core-u2-l2-m1","name":"Massage Strokes Guide.pdf","type":"pdf","url":""}],"content":"Learn the five fundamental massage strokes, correct hand placement, pressure application, and rhythm.","quizId":"hilot-quiz-1"}]},{"id":"hilot-core-u3","title":"Full Body Massage Sequence","description":"Perform a complete therapeutic full-body massage.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u3-l1","title":"Back, Shoulder & Neck Massage","description":"Perform massage on the back, shoulders and neck.","duration":55,"video":"Back, Shoulder & Neck Massage","materials":[{"id":"hilot-core-u3-l1-m1","name":"Back Massage Sequence.pdf","type":"pdf","url":""}],"content":"Learn the sequence for the back, shoulders and neck including draping, pressure points and finishing strokes.","quizId":"hilot-quiz-2"},{"videoUrl":"","published":true,"order":2,"id":"hilot-core-u3-l2","title":"Limb & Foot Massage","description":"Perform massage on arms, hands, legs and feet.","duration":50,"video":"Limb & Foot Massage","materials":[{"id":"hilot-core-u3-l2-m1","name":"Limb Massage Guide.pdf","type":"pdf","url":""}],"content":"Complete the full-body sequence with arm, hand, leg and foot massage, including reflexology basics.","quizId":"hilot-quiz-3"}]},{"id":"hilot-core-u4","title":"Client Care & Spa Operations","description":"Manage client consultation, hygiene and spa protocols.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"hilot-core-u4-l1","title":"Client Consultation & Contraindications","description":"Assess client needs and identify contraindications to massage.","duration":45,"video":"Client Consultation & Contraindications","materials":[{"id":"hilot-core-u4-l1-m1","name":"Client Intake Form.pdf","type":"pdf","url":""}],"content":"Learn intake consultation, contraindications, informed consent, and adapting treatments to client needs.","quizId":"hilot-quiz-1"}]}]}],"quizzes":[{"id":"hilot-quiz-1","programId":"hilot","title":"Anatomy & Physiology Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"hilot-quiz-1-q1","type":"mcq","q":"Which system carries blood throughout the body?","options":["Circulatory","Skeletal","Nervous","Digestive"],"answer":"Circulatory"},{"id":"hilot-quiz-1-q2","type":"tf","q":"Massage strokes generally follow the direction of blood flow toward the heart.","answer":true},{"id":"hilot-quiz-1-q3","type":"id","q":"The _____ system includes lymph nodes and vessels.","answer":"lymphatic"},{"id":"hilot-quiz-1-q4","type":"mcq","q":"The largest muscle group in the body is found in the:","options":["Back and legs","Fingers","Ears","Neck"],"answer":"Back and legs"},{"id":"hilot-quiz-1-q5","type":"tf","q":"Understanding anatomy helps a therapist avoid injury to clients.","answer":true}]},{"id":"hilot-quiz-2","programId":"hilot","title":"Hilot Techniques Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"hilot-quiz-2-q1","type":"mcq","q":"A long, gliding stroke is called:","options":["Effleurage","Tapotement","Petrissage","Friction"],"answer":"Effleurage"},{"id":"hilot-quiz-2-q2","type":"tf","q":"Hilot is a traditional Filipino healing art.","answer":true},{"id":"hilot-quiz-2-q3","type":"id","q":"Kneading and squeezing techniques are called ______.","answer":"petrissage"},{"id":"hilot-quiz-2-q4","type":"mcq","q":"Which stroke uses rhythmic tapping?","options":["Tapotement","Effleurage","Friction","Petrissage"],"answer":"Tapotement"}]},{"id":"hilot-quiz-3","programId":"hilot","title":"Client Care & Safety Quiz","passing":75,"timeLimit":8,"published":true,"questions":[{"id":"hilot-quiz-3-q1","type":"mcq","q":"A condition where massage should be avoided is called a:","options":["Contraindication","Prescription","Indication","Diagnosis"],"answer":"Contraindication"},{"id":"hilot-quiz-3-q2","type":"tf","q":"Informed consent should be obtained before any massage session.","answer":true},{"id":"hilot-quiz-3-q3","type":"id","q":"A ______ should always be completed before treatment begins.","answer":"consultation"},{"id":"hilot-quiz-3-q4","type":"mcq","q":"Massage should NOT be performed over:","options":["Open wounds","Muscles","Relaxed areas","Clean skin"],"answer":"Open wounds"}]}],"exams":[{"id":"hilot-exam-1","programId":"hilot","title":"Hilot (Wellness Massage) NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"hilot-exam-1-q1","type":"mcq","q":"Which system carries blood throughout the body?","options":["Circulatory","Skeletal","Nervous","Digestive"],"answer":"Circulatory"},{"id":"hilot-exam-1-q2","type":"tf","q":"Massage strokes generally follow the direction of blood flow toward the heart.","answer":true},{"id":"hilot-exam-1-q3","type":"id","q":"The _____ system includes lymph nodes and vessels.","answer":"lymphatic"},{"id":"hilot-exam-1-q4","type":"mcq","q":"The largest muscle group in the body is found in the:","options":["Back and legs","Fingers","Ears","Neck"],"answer":"Back and legs"},{"id":"hilot-exam-1-q5","type":"tf","q":"Understanding anatomy helps a therapist avoid injury to clients.","answer":true},{"id":"hilot-exam-1-q6","type":"mcq","q":"A long, gliding stroke is called:","options":["Effleurage","Tapotement","Petrissage","Friction"],"answer":"Effleurage"},{"id":"hilot-exam-1-q7","type":"tf","q":"Hilot is a traditional Filipino healing art.","answer":true},{"id":"hilot-exam-1-q8","type":"id","q":"Kneading and squeezing techniques are called ______.","answer":"petrissage"},{"id":"hilot-exam-1-q9","type":"mcq","q":"Which stroke uses rhythmic tapping?","options":["Tapotement","Effleurage","Friction","Petrissage"],"answer":"Tapotement"},{"id":"hilot-exam-1-q10","type":"mcq","q":"A condition where massage should be avoided is called a:","options":["Contraindication","Prescription","Indication","Diagnosis"],"answer":"Contraindication"}],"questionCount":10,"timeLimit":30,"passing":75,"date":"2026-12-01","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('event-management', 'EVT-408', 'Event Management Services NC II', 'tr-004', $prog${"id":"event-management","code":"EVT-408","title":"Event Management Services NC II","category":"Tourism & Hospitality","level":"NC II","special":false,"enrollable":false,"description":"Plan, organize and execute events including budgeting, logistics, stage production and post-event evaluation.","overview":"The Event Management Services NC II program prepares trainees to plan and deliver successful events. It covers event conceptualization, budgeting, logistics and supplier coordination, event-day production, and post-event evaluation and reporting.","duration":"3 months","hours":140,"fee":8800,"color":"from-fuchsia-500 to-purple-600","emoji":"🎉","image":"https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=60","requirements":["At least 18 years old","High School graduate or ALS equivalent","Good communication skills","Birth certificate (PSA)","2 pcs. 2x2 ID picture","Barangay clearance"],"trainerId":"tr-004","competencies":[{"id":"event-management-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"event-management-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"event-management-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"event-management-basic-q1"},{"videoUrl":"","published":true,"order":2,"id":"event-management-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"event-management-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"event-management-basic-q2"},{"videoUrl":"","published":true,"order":3,"id":"event-management-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"event-management-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"event-management-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"event-management-basic-q3"},{"videoUrl":"","published":true,"order":4,"id":"event-management-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"event-management-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"event-management-basic-q4"}]},{"id":"event-management-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"event-management-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"event-management-common-q1"},{"videoUrl":"","published":true,"order":2,"id":"event-management-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"event-management-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"event-management-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"event-management-common-q2"},{"videoUrl":"","published":true,"order":3,"id":"event-management-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"event-management-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"event-management-common-q3"},{"videoUrl":"","published":true,"order":4,"id":"event-management-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"event-management-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"event-management-common-q4"}]},{"id":"event-management-core","type":"Core","title":"Core Competency","description":"Core competencies of Event Management NC II: event planning, budgeting and logistics, event execution and production, and post-event evaluation.","lessons":[],"units":[{"id":"event-management-core-u1","title":"Event Planning Fundamentals","description":"Plan events from concept to execution.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u1-l1","title":"Introduction to Event Management","description":"Understand the event industry, types of events and roles.","duration":45,"video":"Introduction to Event Management","materials":[{"id":"event-management-core-u1-l1-m1","name":"Event Industry Overview.pdf","type":"pdf","url":""}],"content":"Learn about corporate, social, and MICE events, and the roles within an event team from planner to coordinator.","quizId":"event-management-quiz-1"},{"videoUrl":"","published":true,"order":2,"id":"event-management-core-u1-l2","title":"Event Conceptualization & Theming","description":"Develop event concepts, themes and objectives.","duration":50,"video":"Event Conceptualization & Theming","materials":[{"id":"event-management-core-u1-l2-m1","name":"Concept Development Worksheet.pdf","type":"pdf","url":""}],"content":"Translate client goals into a cohesive event concept, including theme, mood board, and creative direction.","quizId":"event-management-quiz-2"}]},{"id":"event-management-core-u2","title":"Budgeting & Logistics","description":"Prepare event budgets and coordinate logistics.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u2-l1","title":"Event Budgeting","description":"Create and manage an event budget and cost sheet.","duration":50,"video":"Event Budgeting","materials":[{"id":"event-management-core-u2-l1-m1","name":"Event Budget Template.xlsx","type":"xls","url":""}],"content":"Learn to build a line-item budget, estimate costs, negotiate with suppliers, and track expenses.","quizId":"event-management-quiz-3"},{"videoUrl":"","published":true,"order":2,"id":"event-management-core-u2-l2","title":"Venue & Supplier Coordination","description":"Select venues and coordinate with suppliers and vendors.","duration":45,"video":"Venue & Supplier Coordination","materials":[{"id":"event-management-core-u2-l2-m1","name":"Supplier Checklist.pdf","type":"pdf","url":""}],"content":"Evaluate venue capacity, layout and accessibility; coordinate catering, AV, decor and other suppliers.","quizId":"event-management-quiz-1"}]},{"id":"event-management-core-u3","title":"Event Execution & Production","description":"Run event day operations and stage production.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u3-l1","title":"Program Flow & Stage Management","description":"Create program flow and manage stage production.","duration":55,"video":"Program Flow & Stage Management","materials":[{"id":"event-management-core-u3-l1-m1","name":"Program Flow Template.pdf","type":"pdf","url":""}],"content":"Build a minute-by-minute program flow, manage cues, and coordinate backstage with the technical team.","quizId":"event-management-quiz-2"},{"videoUrl":"","published":true,"order":2,"id":"event-management-core-u3-l2","title":"Event Day Operations","description":"Manage registration, ushering and on-site coordination.","duration":50,"video":"Event Day Operations","materials":[{"id":"event-management-core-u3-l2-m1","name":"Event Day Run Sheet.pdf","type":"pdf","url":""}],"content":"Handle registration, guest management, ushering, and contingency planning during the event.","quizId":"event-management-quiz-3"}]},{"id":"event-management-core-u4","title":"Post-Event Evaluation","description":"Evaluate events and prepare post-event reports.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"event-management-core-u4-l1","title":"Post-Event Reporting","description":"Prepare post-event reports and client debriefs.","duration":40,"video":"Post-Event Reporting","materials":[{"id":"event-management-core-u4-l1-m1","name":"Post-Event Report Template.pdf","type":"pdf","url":""}],"content":"Compile attendance, financials and feedback into a post-event report, and conduct a client debrief.","quizId":"event-management-quiz-1"}]}]}],"quizzes":[{"id":"event-management-quiz-1","programId":"event-management","title":"Event Planning Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"event-management-quiz-1-q1","type":"mcq","q":"MICE stands for Meetings, Incentives, Conferences and:","options":["Exhibitions","Events","Entertainment","Excursions"],"answer":"Exhibitions"},{"id":"event-management-quiz-1-q2","type":"tf","q":"A theme should align with the client’s objectives.","answer":true},{"id":"event-management-quiz-1-q3","type":"id","q":"A ______ is used to present the visual direction of an event.","answer":"moodboard"},{"id":"event-management-quiz-1-q4","type":"mcq","q":"The first stage of event planning is:","options":["Conceptualization","Execution","Evaluation","Billing"],"answer":"Conceptualization"},{"id":"event-management-quiz-1-q5","type":"tf","q":"Event planning should always start with a clear objective.","answer":true}]},{"id":"event-management-quiz-2","programId":"event-management","title":"Budgeting & Logistics Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"event-management-quiz-2-q1","type":"mcq","q":"A contingency fund in an event budget covers:","options":["Unexpected costs","Staff salaries only","Decorations","Invitations"],"answer":"Unexpected costs"},{"id":"event-management-quiz-2-q2","type":"tf","q":"Venue capacity should match the expected number of guests.","answer":true},{"id":"event-management-quiz-2-q3","type":"id","q":"The person responsible for the overall event is the event ______.","answer":"planner"},{"id":"event-management-quiz-2-q4","type":"mcq","q":"Which document lists every expense of an event?","options":["Budget","Guest list","Menu","Floor plan"],"answer":"Budget"}]},{"id":"event-management-quiz-3","programId":"event-management","title":"Event Execution Quiz","passing":75,"timeLimit":8,"published":true,"questions":[{"id":"event-management-quiz-3-q1","type":"mcq","q":"A minute-by-minute schedule of an event is called:","options":["Run sheet","Menu","Contract","Invoice"],"answer":"Run sheet"},{"id":"event-management-quiz-3-q2","type":"tf","q":"Backstage coordination is handled by stage management.","answer":true},{"id":"event-management-quiz-3-q3","type":"id","q":"Managing guest arrival and check-in is called ______.","answer":"registration"},{"id":"event-management-quiz-3-q4","type":"mcq","q":"A post-event report typically includes:","options":["Attendance and financials","Only photos","Guest complaints only","The menu"],"answer":"Attendance and financials"}]}],"exams":[{"id":"event-management-exam-1","programId":"event-management","title":"Event Management Services NC II - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"event-management-exam-1-q1","type":"mcq","q":"MICE stands for Meetings, Incentives, Conferences and:","options":["Exhibitions","Events","Entertainment","Excursions"],"answer":"Exhibitions"},{"id":"event-management-exam-1-q2","type":"tf","q":"A theme should align with the client’s objectives.","answer":true},{"id":"event-management-exam-1-q3","type":"id","q":"A ______ is used to present the visual direction of an event.","answer":"moodboard"},{"id":"event-management-exam-1-q4","type":"mcq","q":"The first stage of event planning is:","options":["Conceptualization","Execution","Evaluation","Billing"],"answer":"Conceptualization"},{"id":"event-management-exam-1-q5","type":"tf","q":"Event planning should always start with a clear objective.","answer":true},{"id":"event-management-exam-1-q6","type":"mcq","q":"A contingency fund in an event budget covers:","options":["Unexpected costs","Staff salaries only","Decorations","Invitations"],"answer":"Unexpected costs"},{"id":"event-management-exam-1-q7","type":"tf","q":"Venue capacity should match the expected number of guests.","answer":true},{"id":"event-management-exam-1-q8","type":"id","q":"The person responsible for the overall event is the event ______.","answer":"planner"},{"id":"event-management-exam-1-q9","type":"mcq","q":"Which document lists every expense of an event?","options":["Budget","Guest list","Menu","Floor plan"],"answer":"Budget"},{"id":"event-management-exam-1-q10","type":"mcq","q":"A minute-by-minute schedule of an event is called:","options":["Run sheet","Menu","Contract","Invoice"],"answer":"Run sheet"}],"questionCount":10,"timeLimit":30,"passing":75,"date":"2026-12-05","status":"Upcoming","published":true}]}$prog$)
on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;

insert into public.programs (id, code, title, trainer_id, data)
values ('virtual-assistant', 'VA-510', 'Virtual Assistant (Special Program)', 'tr-005', $prog${"id":"virtual-assistant","code":"VA-510","title":"Virtual Assistant (Special Program)","category":"Information Technology","level":"Special","special":true,"enrollable":true,"description":"Become a professional virtual assistant: admin support, communication, social media management and tool proficiency.","overview":"The Virtual Assistant special program prepares trainees for remote work as a VA. It covers the VA profession, remote work setup, administrative support, client communication, customer support, social media management, and tool proficiency — including a proctored typing test evaluation.","duration":"8 Weeks","hours":100,"fee":5000,"color":"from-indigo-500 to-violet-600","emoji":"💻","image":"https://images.unsplash.com/photo-1587560699334-cc4ff634909a?auto=format&fit=crop&w=1200&q=60","requirements":["At least 18 years old","High School graduate or ALS equivalent","Own laptop/computer with webcam","Stable internet connection (min. 5 Mbps)","Birth certificate (PSA)","2 pcs. 2x2 ID picture"],"trainerId":"tr-005","competencies":[{"id":"virtual-assistant-basic","type":"Basic","title":"Basic Competency","description":"Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-basic-l1","title":"Reading, Writing & Comprehension","description":"Develop the ability to read, interpret and write workplace documents, forms and simple reports.","duration":45,"video":"Introduction to Workplace Literacy","materials":[{"id":"virtual-assistant-basic-l1-m1","name":"Reading Comprehension Guide.pdf","type":"pdf","url":""},{"id":"virtual-assistant-basic-l1-m2","name":"Workplace Forms Template.docx","type":"doc","url":""}],"content":"This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.","quizId":"virtual-assistant-basic-q1"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-basic-l2","title":"Basic Communication Skills","description":"Learn verbal and non-verbal communication techniques for professional workplace interaction.","duration":40,"video":"Effective Workplace Communication","materials":[{"id":"virtual-assistant-basic-l2-m1","name":"Communication Etiquette Handout.pdf","type":"pdf","url":""}],"content":"Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.","quizId":"virtual-assistant-basic-q2"},{"videoUrl":"","published":true,"order":3,"id":"virtual-assistant-basic-l3","title":"Basic Digital Literacy","description":"Familiarize yourself with computers, the internet, email and basic productivity tools.","duration":60,"video":"Getting Started with Computers","materials":[{"id":"virtual-assistant-basic-l3-m1","name":"Digital Skills Workbook.pdf","type":"pdf","url":""},{"id":"virtual-assistant-basic-l3-m2","name":"Keyboard Shortcuts Cheatsheet.pdf","type":"pdf","url":""}],"content":"Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.","quizId":"virtual-assistant-basic-q3"},{"videoUrl":"","published":true,"order":4,"id":"virtual-assistant-basic-l4","title":"Workplace Behavior & Professionalism","description":"Understand workplace ethics, punctuality, grooming, and professional conduct.","duration":35,"video":"Professional Conduct at Work","materials":[{"id":"virtual-assistant-basic-l4-m1","name":"Code of Conduct.pdf","type":"pdf","url":""}],"content":"Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.","quizId":"virtual-assistant-basic-q4"}]},{"id":"virtual-assistant-common","type":"Common","title":"Common Competency","description":"Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-common-l1","title":"Workplace Communication","description":"Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.","duration":50,"video":"Communicating in the Workplace","materials":[{"id":"virtual-assistant-common-l1-m1","name":"Communication Scenarios.pdf","type":"pdf","url":""}],"content":"This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.","quizId":"virtual-assistant-common-q1"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-common-l2","title":"Workplace Safety & Emergency Procedures","description":"Identify hazards, follow OSH standards, and respond to workplace emergencies.","duration":55,"video":"Occupational Safety and Health","materials":[{"id":"virtual-assistant-common-l2-m1","name":"OSH Standards Manual.pdf","type":"pdf","url":""},{"id":"virtual-assistant-common-l2-m2","name":"Emergency Evacuation Plan.pdf","type":"pdf","url":""}],"content":"Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.","quizId":"virtual-assistant-common-q2"},{"videoUrl":"","published":true,"order":3,"id":"virtual-assistant-common-l3","title":"Customer Service Excellence","description":"Deliver quality service that meets and exceeds customer expectations.","duration":45,"video":"Service Quality Standards","materials":[{"id":"virtual-assistant-common-l3-m1","name":"Customer Service Standards.pdf","type":"pdf","url":""}],"content":"Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.","quizId":"virtual-assistant-common-q3"},{"videoUrl":"","published":true,"order":4,"id":"virtual-assistant-common-l4","title":"Working with Others & Time Management","description":"Collaborate effectively in teams and manage your time and priorities.","duration":40,"video":"Teamwork and Productivity","materials":[{"id":"virtual-assistant-common-l4-m1","name":"Teamwork Activity Sheet.pdf","type":"pdf","url":""}],"content":"Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.","quizId":"virtual-assistant-common-q4"}]},{"id":"virtual-assistant-core","type":"Core","title":"Core Competency","description":"Core competencies of the Virtual Assistant program: VA fundamentals, administrative support, communication and customer support, and social media & tool proficiency.","lessons":[],"units":[{"id":"virtual-assistant-core-u1","title":"Introduction to Virtual Assistance","description":"Understand the VA industry, roles and remote work fundamentals.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u1-l1","title":"The Virtual Assistant Profession","description":"Understand what a VA does, niches, and client relationships.","duration":45,"video":"The Virtual Assistant Profession","materials":[{"id":"virtual-assistant-core-u1-l1-m1","name":"VA Career Guide.pdf","type":"pdf","url":""}],"content":"Learn about the different VA niches (admin, social media, e-commerce, real estate), rates, and building client relationships.","quizId":"virtual-assistant-quiz-1"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u1-l2","title":"Remote Work Setup & Productivity","description":"Set up a home office and manage remote productivity.","duration":40,"video":"Remote Work Setup & Productivity","materials":[{"id":"virtual-assistant-core-u1-l2-m1","name":"Remote Setup Checklist.pdf","type":"pdf","url":""}],"content":"Configure your workstation, internet, backup power, and time-zone management for reliable remote work.","quizId":"virtual-assistant-quiz-2"}]},{"id":"virtual-assistant-core-u2","title":"Administrative Support","description":"Provide email, calendar and document management support.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u2-l1","title":"Email & Calendar Management","description":"Manage inboxes, filters and shared calendars.","duration":50,"video":"Email & Calendar Management","materials":[{"id":"virtual-assistant-core-u2-l1-m1","name":"Email Management Guide.pdf","type":"pdf","url":""}],"content":"Learn inbox zero techniques, labeling, canned responses, scheduling, and calendar coordination.","quizId":"virtual-assistant-quiz-3"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u2-l2","title":"Document & Data Management","description":"Create documents, spreadsheets and manage cloud files.","duration":50,"video":"Document & Data Management","materials":[{"id":"virtual-assistant-core-u2-l2-m1","name":"Document Templates.zip","type":"zip","url":""}],"content":"Work with Google Workspace and Microsoft 365 to create documents, spreadsheets, and organized cloud folders.","quizId":"virtual-assistant-quiz-1"}]},{"id":"virtual-assistant-core-u3","title":"Communication & Customer Support","description":"Handle client communication and customer support tasks.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u3-l1","title":"Professional Client Communication","description":"Communicate professionally via email, chat and video.","duration":45,"video":"Professional Client Communication","materials":[{"id":"virtual-assistant-core-u3-l1-m1","name":"Client Email Templates.pdf","type":"pdf","url":""}],"content":"Draft professional emails, run meetings, and manage client communication tools like Slack and Zoom.","quizId":"virtual-assistant-quiz-2"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u3-l2","title":"Customer Support Basics","description":"Provide helpdesk and customer support using ticketing tools.","duration":50,"video":"Customer Support Basics","materials":[{"id":"virtual-assistant-core-u3-l2-m1","name":"Support Playbook.pdf","type":"pdf","url":""}],"content":"Learn ticketing systems, response templates, escalation, and measuring customer satisfaction.","quizId":"virtual-assistant-quiz-3"}]},{"id":"virtual-assistant-core-u4","title":"Social Media & Tool Proficiency","description":"Manage social media and master common VA tools.","lessons":[{"videoUrl":"","published":true,"order":1,"id":"virtual-assistant-core-u4-l1","title":"Social Media Management","description":"Schedule and manage content across social platforms.","duration":50,"video":"Social Media Management","materials":[{"id":"virtual-assistant-core-u4-l1-m1","name":"Content Calendar.xlsx","type":"xls","url":""}],"content":"Use scheduling tools, content calendars and analytics to manage social media accounts.","quizId":"virtual-assistant-quiz-1"},{"videoUrl":"","published":true,"order":2,"id":"virtual-assistant-core-u4-l2","title":"Typing Proficiency & Data Entry","description":"Develop fast and accurate typing for data entry tasks.","duration":40,"video":"Typing Proficiency & Data Entry","materials":[{"id":"virtual-assistant-core-u4-l2-m1","name":"Typing Practice Guide.pdf","type":"pdf","url":""}],"content":"Practice touch typing, accuracy drills, and efficient data entry. Complete the timed typing assessment.","quizId":"virtual-assistant-quiz-2"}]}]}],"quizzes":[{"id":"virtual-assistant-quiz-1","programId":"virtual-assistant","title":"Virtual Assistant Fundamentals Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"virtual-assistant-quiz-1-q1","type":"mcq","q":"A VA who manages social media accounts is in which niche?","options":["Social media management","Bookkeeping","Web development","Legal"],"answer":"Social media management"},{"id":"virtual-assistant-quiz-1-q2","type":"tf","q":"Time zone awareness is important for virtual assistants.","answer":true},{"id":"virtual-assistant-quiz-1-q3","type":"id","q":"Working from home is also called working ______.","answer":"remotely"},{"id":"virtual-assistant-quiz-1-q4","type":"mcq","q":"Which tool is commonly used for team chat?","options":["Slack","Photoshop","Excel only","Notepad"],"answer":"Slack"},{"id":"virtual-assistant-quiz-1-q5","type":"tf","q":"A reliable internet connection is essential for a VA.","answer":true}]},{"id":"virtual-assistant-quiz-2","programId":"virtual-assistant","title":"Administrative Support Quiz","passing":75,"timeLimit":10,"published":true,"questions":[{"id":"virtual-assistant-quiz-2-q1","type":"mcq","q":"Inbox zero is a technique for:","options":["Email management","Calendar design","Data entry","Graphic design"],"answer":"Email management"},{"id":"virtual-assistant-quiz-2-q2","type":"tf","q":"Shared calendars help teams avoid scheduling conflicts.","answer":true},{"id":"virtual-assistant-quiz-2-q3","type":"id","q":"A pre-written email response is called a ______ response.","answer":"canned"},{"id":"virtual-assistant-quiz-2-q4","type":"mcq","q":"Which is a cloud storage service?","options":["Google Drive","Notepad","Calculator","Paint"],"answer":"Google Drive"}]},{"id":"virtual-assistant-quiz-3","programId":"virtual-assistant","title":"Communication & Support Quiz","passing":75,"timeLimit":8,"published":true,"questions":[{"id":"virtual-assistant-quiz-3-q1","type":"mcq","q":"A professional email should always include:","options":["A clear subject line","Emojis only","No greeting","Slang"],"answer":"A clear subject line"},{"id":"virtual-assistant-quiz-3-q2","type":"tf","q":"Ticketing systems help track customer support requests.","answer":true},{"id":"virtual-assistant-quiz-3-q3","type":"id","q":"Passing a support issue to a higher level is called ______.","answer":"escalation"},{"id":"virtual-assistant-quiz-3-q4","type":"mcq","q":"CSAT measures:","options":["Customer satisfaction","Internet speed","Typing speed","Battery life"],"answer":"Customer satisfaction"}]}],"exams":[{"id":"virtual-assistant-exam-1","programId":"virtual-assistant","title":"Virtual Assistant (Special Program) - Competency Assessment Exam","competency":"Core Competency","questions":[{"id":"virtual-assistant-exam-1-q1","type":"mcq","q":"A VA who manages social media accounts is in which niche?","options":["Social media management","Bookkeeping","Web development","Legal"],"answer":"Social media management"},{"id":"virtual-assistant-exam-1-q2","type":"tf","q":"Time zone awareness is important for virtual assistants.","answer":true},{"id":"virtual-assistant-exam-1-q3","type":"id","q":"Working from home is also called working ______.","answer":"remotely"},{"id":"virtual-assistant-exam-1-q4","type":"mcq","q":"Which tool is commonly used for team chat?","options":["Slack","Photoshop","Excel only","Notepad"],"answer":"Slack"},{"id":"virtual-assistant-exam-1-q5","type":"tf","q":"A reliable internet connection is essential for a VA.","answer":true},{"id":"virtual-assistant-exam-1-q6","type":"mcq","q":"Inbox zero is a technique for:","options":["Email management","Calendar design","Data entry","Graphic design"],"answer":"Email management"},{"id":"virtual-assistant-exam-1-q7","type":"tf","q":"Shared calendars help teams avoid scheduling conflicts.","answer":true},{"id":"virtual-assistant-exam-1-q8","type":"id","q":"A pre-written email response is called a ______ response.","answer":"canned"},{"id":"virtual-assistant-exam-1-q9","type":"mcq","q":"Which is a cloud storage service?","options":["Google Drive","Notepad","Calculator","Paint"],"answer":"Google Drive"},{"id":"virtual-assistant-exam-1-q10","type":"mcq","q":"A professional email should always include:","options":["A clear subject line","Emojis only","No greeting","Slang"],"answer":"A clear subject line"}],"questionCount":10,"timeLimit":30,"passing":75,"date":"2026-11-30","status":"Upcoming","published":true}]}$prog$)
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
  ('Multiple Programs',  'multiple-programs',  6),
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
--       institutehytglobal@gmail.com
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
  v_email text := 'institutehytglobal@gmail.com';
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
