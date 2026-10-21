#!/usr/bin/env node
// ===========================================================================
// Backend test runner for the trainer-feedback + timed-assessment work.
//
//   1. Runs supabase/tests/backend_feedback_and_timers.sql inside one
//      transaction that rolls back, against the linked Supabase project.
//   2. Unit-tests the CSV escaping / formula-injection helpers.
//   3. Runs a committed concurrency test (save vs finalize) and cleans up.
//
// Requires SUPABASE_ACCESS_TOKEN in .env.local (Management API). Never prints
// the token.
//
// Usage:
//   node --experimental-strip-types scripts/test-backend.mjs
// ===========================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { csvCell, buildCsv, CSV_BOM } from '../supabase/functions/_shared/csv.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_PATH = path.join(ROOT, '.env.local')

function env(name) {
  const text = fs.readFileSync(ENV_PATH, 'utf8')
  const match = text.match(new RegExp('^' + name + '=(.*)$', 'm'))
  return match ? match[1].trim() : ''
}

const SUPABASE_URL = env('VITE_SUPABASE_URL')
const ACCESS_TOKEN = env('SUPABASE_ACCESS_TOKEN')
if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local')
  process.exit(1)
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const QUERY_URL = 'https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query'

async function sql(query) {
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error('SQL failed (' + res.status + '): ' + text.slice(0, 2000))
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const results = []
function record(name, passed, detail) {
  results.push({ name, passed: !!passed, detail })
}

// ---------------------------------------------------------------------------
// 1. SQL acceptance tests
// ---------------------------------------------------------------------------
const testSql = fs.readFileSync(
  path.join(ROOT, 'supabase/tests/backend_feedback_and_timers.sql'),
  'utf8',
)
const sqlRows = await sql(testSql)
const summary = sqlRows?.[0]?.summary
record(
  'SQL acceptance suite (' + (summary?.total ?? '?') + ' checks, rolled back)',
  summary?.failed === 0,
  summary,
)

// ---------------------------------------------------------------------------
// 2. CSV helpers
// ---------------------------------------------------------------------------
const csvCases = [
  ['plain', 'hello', '"hello"'],
  ['comma', 'a,b', '"a,b"'],
  ['quote', 'He said "hi"', '"He said ""hi"""'],
  ['newline', 'line1\nline2', '"line1\nline2"'],
  ['formula =', '=1+1', '"\'=1+1"'],
  ['formula +', '+SUM(A1)', '"\'+SUM(A1)"'],
  ['formula -', '-2+3', '"\'-2+3"'],
  ['formula @', '@cmd', '"\'@cmd"'],
  ['formula with leading spaces', '   =cmd', '"\'   =cmd"'],
  ['null', null, '""'],
  ['nul stripped', 'a\u0000b', '"ab"'],
]
for (const [name, input, expected] of csvCases) {
  const actual = csvCell(input)
  record('CSV: ' + name, actual === expected, { expected, actual })
}

const csvDoc = buildCsv(
  [
    { header: 'Name', value: (r) => r.name },
    { header: 'Comment', value: (r) => r.comment },
  ],
  [{ name: 'A, B', comment: 'He said "yes"\nThen left' }],
)
record(
  'CSV: BOM + CRLF + quoted header',
  csvDoc.startsWith(CSV_BOM + '"Name","Comment"\r\n'),
  { startsWith: csvDoc.slice(0, 40) },
)
record(
  'CSV: embedded quote, comma and line break survive',
  csvDoc.includes('"A, B"') && csvDoc.includes('"He said ""yes""\nThen left"'),
  { csv: csvDoc },
)

// ---------------------------------------------------------------------------
// 3. Concurrency: save vs finalize
// ---------------------------------------------------------------------------
const TRAINEE = 'tn-mv5614d2-ifto6'
const TRAINEE_AUTH = '868d76fd-6110-43d6-86fd-858c8aec0f89'
const suffix = String(Date.now())
const programId = 'zz-conc-' + suffix
const quizId = 'zz-conc-quiz-' + suffix
const enrollmentId = 'zz-conc-enr-' + suffix

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

const setupSql = `
begin;
insert into public.programs (id, code, title, data)
values ('${programId}', 'ZZ-C', 'Concurrency Test', jsonb_build_object(
  'title', 'Concurrency Test',
  'competencies', '[]'::jsonb,
  'quizzes', jsonb_build_array(jsonb_build_object(
    'id', '${quizId}', 'title', 'Concurrency Quiz', 'published', true,
    'passing', 75, 'timeLimit', 20,
    'startDate', '${today}', 'startTime', '00:00',
    'deadlineDate', '${today}', 'deadlineTime', '23:59',
    'questions', (
      select jsonb_agg(jsonb_build_object('id', 'zzc' || i, 'type', 'id', 'answer', 'a'))
      from generate_series(1, 5) i
    )
  )),
  'exams', '[]'::jsonb
));
insert into public.enrollments (id, trainee_id, program_id, status, data)
values ('${enrollmentId}', '${TRAINEE}', '${programId}', 'Enrolled', '{"progress":{}}'::jsonb);
select set_config('request.jwt.claims', '{"sub":"${TRAINEE_AUTH}","aal":"aal1"}', true);
create temp table zz_conc as select public.start_quiz_attempt('${programId}', '${quizId}') as j;
select (select j->>'id' from zz_conc) as id;
commit;
`

let attemptId = null
try {
  const setupRows = await sql(setupSql)
  attemptId = setupRows?.[0]?.id
  if (!attemptId) throw new Error('Could not create concurrency attempt: ' + JSON.stringify(setupRows))

  const claim = 'select set_config(\'request.jwt.claims\', \'{"sub":"' + TRAINEE_AUTH + '","aal":"aal1"}\', true);'
  const saveSql =
    'begin;' + claim +
    "select set_config('role','authenticated',true);" +
    "select public.save_quiz_answer('" + attemptId + "','zzc1','\"a\"'::jsonb) as result; commit;"
  const finalSql =
    'begin;' + claim +
    "select set_config('role','authenticated',true);" +
    "select public.finalize_quiz_attempt('" + attemptId + "') as result; commit;"

  const [saveOut, finalOut] = await Promise.all([sql(saveSql), sql(finalSql)])
  const stateRows = await sql(
    "select a.status, a.score, a.answered_questions, " +
    "(select count(*) from public.quiz_attempt_answers where attempt_id = a.id) as answer_rows, " +
    "a.submitted_at from public.quiz_attempts a where a.id = '" + attemptId + "'",
  )
  const state = stateRows?.[0] || {}
  record(
    'Concurrency: save and finalize cannot both win',
    state.status !== 'in_progress' &&
      Number(state.answered_questions) === Number(state.answer_rows),
    { state, saveOut, finalOut },
  )

  const [f1, f2] = await Promise.all([sql(finalSql), sql(finalSql)])
  const a = f1?.[0]?.result
  const b = f2?.[0]?.result
  record(
    'Concurrency: simultaneous finalizations return one result',
    a?.score === b?.score &&
      a?.percentage === b?.percentage &&
      a?.submitted_at === b?.submitted_at,
    { first: a, second: b },
  )
} catch (e) {
  record('Concurrency test', false, { error: e.message })
} finally {
  if (attemptId) {
    try {
      await sql(
        'begin;' +
          "delete from public.quiz_attempt_answers where attempt_id = '" + attemptId + "';" +
          "delete from public.quiz_attempts where id = '" + attemptId + "';" +
          "delete from public.enrollments where id = '" + enrollmentId + "';" +
          "delete from public.programs where id = '" + programId + "';" +
          'commit;',
      )
    } catch (e) {
      console.error('Cleanup failed:', e.message)
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.passed)
console.log('')
for (const r of results) {
  console.log((r.passed ? 'PASS' : 'FAIL') + '  ' + r.name)
  if (!r.passed) console.log('      ' + JSON.stringify(r.detail))
}
console.log('')
console.log(results.length - failed.length + '/' + results.length + ' checks passed')
if (failed.length) process.exit(1)
