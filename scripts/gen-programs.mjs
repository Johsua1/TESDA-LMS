// ---------------------------------------------------------------------------
// Generates the program-catalog seed SQL (appended to supabase/schema.sql).
// Usage:  node scripts/gen-programs.mjs >> supabase/schema.sql
// Re-run whenever src/data/programs.js changes and the catalog needs updating.
// ---------------------------------------------------------------------------
import { programs } from '../src/data/programs.js'

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

let sql = '\n-- =======================  SEED: PROGRAM CATALOG  =======================\n'
sql += '-- The 5 training programs with their lessons, quizzes and exams.\n'
sql += '-- Safe to re-run (upsert by id).\n\n'

for (const p of programs) {
  const json = JSON.stringify(p)
  sql += `insert into public.programs (id, code, title, trainer_id, data)\n`
  sql += `values (${q(p.id)}, ${q(p.code)}, ${q(p.title)}, ${q(p.trainerId)}, $prog$${json}$prog$)\n`
  sql += `on conflict (id) do update set code = excluded.code, title = excluded.title, trainer_id = excluded.trainer_id, data = excluded.data;\n\n`
}

process.stdout.write(sql)
