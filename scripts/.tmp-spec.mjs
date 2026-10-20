import fs from 'node:fs'
const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const ref = (env.VITE_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1]
const run = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`)
  return text
}
await run(fs.readFileSync('supabase/migrations/039_trainer_specializations.sql', 'utf8'))
console.log('SPECIALIZATIONS:', await run("select name, slug, sort_order from public.specializations order by sort_order"))
console.log('TRAINERS:', await run("select p.name, p.specialization, s.slug from public.profiles p left join public.specializations s on s.id = p.specialization_id where p.role = 'trainer' order by p.name"))
