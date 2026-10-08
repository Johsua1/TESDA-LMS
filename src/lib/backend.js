// ---------------------------------------------------------------------------
// Supabase data layer
// ---------------------------------------------------------------------------
// Maps the app's camelCase collections onto the Supabase tables, where each row
// is `{ id, <a few scalar columns>, data jsonb }`. The nested parts of an object
// (program content, enrollment progress/payment, etc.) round-trip inside `data`.
// ---------------------------------------------------------------------------
import { supabase } from './supabase'

// app collection -> { table, scalars: { appKey: column } }
const COLLECTIONS = {
  programs: { table: 'programs', scalars: { code: 'code', title: 'title', trainerId: 'trainer_id' } },
  schedules: {
    table: 'schedules',
    scalars: { programId: 'program_id', trainerId: 'trainer_id', date: 'date' },
  },
  enrollments: {
    table: 'enrollments',
    scalars: { traineeId: 'trainee_id', programId: 'program_id', status: 'status' },
  },
  attendance: {
    table: 'attendance',
    scalars: { traineeId: 'trainee_id', programId: 'program_id', scheduleId: 'schedule_id' },
  },
  quizAttempts: { table: 'quiz_attempts', scalars: { traineeId: 'trainee_id', programId: 'program_id' } },
  examAttempts: { table: 'exam_attempts', scalars: { traineeId: 'trainee_id', programId: 'program_id' } },
  typingTests: {
    table: 'typing_tests',
    scalars: { traineeId: 'trainee_id', programId: 'program_id', trainerId: 'trainer_id' },
  },
  evaluations: {
    table: 'evaluations',
    scalars: { traineeId: 'trainee_id', programId: 'program_id', trainerId: 'trainer_id' },
  },
  announcements: {
    table: 'announcements',
    scalars: { authorId: 'author_id', programId: 'program_id', audience: 'audience', date: 'date' },
  },
}

const COLLECTION_NAMES = Object.keys(COLLECTIONS)

// ------------------------------ row <-> object ------------------------------

function toRow(collection, obj) {
  const cfg = COLLECTIONS[collection]
  const row = { id: obj.id }
  const data = { ...obj }
  delete data.id
  for (const [appKey, column] of Object.entries(cfg.scalars)) {
    row[column] = obj[appKey] ?? null
    delete data[appKey]
  }
  row.data = data
  return row
}

function fromRow(collection, row) {
  const cfg = COLLECTIONS[collection]
  const obj = { ...(row.data || {}), id: row.id }
  for (const [appKey, column] of Object.entries(cfg.scalars)) {
    obj[appKey] = row[column]
  }
  return obj
}

function fromProfileRow(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    role: row.role,
    email: row.email,
    name: row.name,
    authUserId: row.auth_user_id,
  }
}

function toProfileRow(user) {
  const { id, role, email, name, authUserId, ...rest } = user
  delete rest.password
  const row = {
    id,
    role: role || 'trainee',
    email: email ? String(email).trim().toLowerCase() : null,
    name: name || null,
    data: rest,
  }
  // Only set the link when we know it — omitting it preserves the existing
  // value on upsert (so we never null out a real auth link by accident).
  if (authUserId) row.auth_user_id = authUserId
  return row
}

// --------------------------------- loading ----------------------------------

export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) throw error
  return (data || []).map(fromProfileRow)
}

export async function loadAll() {
  const queries = COLLECTION_NAMES.map((n) => supabase.from(COLLECTIONS[n].table).select('*'))
  queries.push(supabase.from('profiles').select('*'))
  queries.push(supabase.from('settings').select('*').eq('id', 'global').limit(1))

  const results = await Promise.all(queries)

  const db = {}
  COLLECTION_NAMES.forEach((name, i) => {
    const { data, error } = results[i]
    if (error) throw error
    db[name] = (data || []).map((row) => fromRow(name, row))
  })

  const profilesRes = results[COLLECTION_NAMES.length]
  if (profilesRes.error) throw profilesRes.error
  db.users = (profilesRes.data || []).map(fromProfileRow)

  const settingsRes = results[COLLECTION_NAMES.length + 1]
  const settings = settingsRes.data?.[0]?.data || null

  return { db, settings }
}

// --------------------------------- writes -----------------------------------

export async function upsertRow(collection, obj) {
  if (!obj?.id) return
  const { error } = await supabase.from(COLLECTIONS[collection].table).upsert(toRow(collection, obj))
  if (error) throw error
}

export async function upsertRows(collection, objs) {
  const list = (objs || []).filter((o) => o?.id)
  if (!list.length) return
  const rows = list.map((o) => toRow(collection, o))
  const { error } = await supabase.from(COLLECTIONS[collection].table).upsert(rows)
  if (error) throw error
}

export async function deleteRow(collection, id) {
  if (!id) return
  const { error } = await supabase.from(COLLECTIONS[collection].table).delete().eq('id', id)
  if (error) throw error
}

export async function upsertProfile(user) {
  const { error } = await supabase.from('profiles').upsert(toProfileRow(user))
  if (error) throw error
}

export async function deleteProfile(id) {
  const { error } = await supabase.rpc('admin_delete_user', { p_id: id })
  if (error) throw error
}

export async function saveSettings(data) {
  const { error } = await supabase.from('settings').upsert({ id: 'global', data })
  if (error) throw error
}

// Diff two row arrays by id and persist only what changed.
export function diffRows(prevArr = [], nextArr = []) {
  const prevMap = new Map((prevArr || []).map((r) => [r.id, r]))
  const nextMap = new Map((nextArr || []).map((r) => [r.id, r]))
  const upserts = []
  const deletes = []
  for (const [id, row] of nextMap) {
    const before = prevMap.get(id)
    if (!before || JSON.stringify(before) !== JSON.stringify(row)) upserts.push(row)
  }
  for (const id of prevMap.keys()) if (!nextMap.has(id)) deletes.push(id)
  return { upserts, deletes }
}

// Persist the difference between two `db` snapshots to Supabase.
// Profiles are intentionally excluded — they are handled explicitly (they carry
// auth links and must go through the admin RPCs / self-service paths).
export async function syncCollections(prev, next) {
  const tasks = []
  for (const name of COLLECTION_NAMES) {
    const { upserts, deletes } = diffRows(prev?.[name], next?.[name])
    if (upserts.length) tasks.push(upsertRows(name, upserts))
    for (const id of deletes) tasks.push(deleteRow(name, id))
  }
  await Promise.all(tasks)
}

// ---------------------------------- auth ------------------------------------

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function fetchProfile(authUserId) {
  const uid = authUserId || (await getSession())?.user?.id
  if (!uid) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('auth_user_id', uid).limit(1)
  if (error) throw error
  return data && data[0] ? fromProfileRow(data[0]) : null
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password,
  })
  if (error) return { ok: false, error: error.message }
  const profile = await fetchProfile(data.user?.id)
  if (!profile) {
    return { ok: false, error: 'No profile is linked to this account. Please contact the administrator.' }
  }
  return { ok: true, user: profile }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function signUpTrainee(payload) {
  const email = String(payload.email || '').trim().toLowerCase()
  const { data, error } = await supabase.auth.signUp({ email, password: payload.password })
  if (error) return { ok: false, error: error.message }
  if (!data.user) return { ok: false, error: 'Sign-up failed to create an account.' }
  if (!data.session) {
    return {
      ok: false,
      error: 'Email confirmation is enabled. Please turn it off in Supabase (Authentication > Providers > Email) or confirm your email first.',
    }
  }
  const profile = {
    id: `tn-${Date.now().toString(36)}`,
    role: 'trainee',
    name: payload.name,
    email,
    authUserId: data.user.id,
    avatarColor: payload.avatarColor || 'from-brand-500 to-brand-700',
    avatarUrl: payload.avatarUrl || '',
    phone: payload.phone || '',
    address: payload.address || '',
    birthDate: payload.birthDate || null,
    gender: payload.gender || '',
    education: payload.education || '',
    emergencyContact: payload.emergencyContact || '',
    enrolledPrograms: [],
    since: new Date().toISOString().slice(0, 10),
  }
  const { error: profileError } = await supabase.from('profiles').insert(toProfileRow(profile))
  if (profileError) return { ok: false, error: profileError.message }
  return { ok: true, user: profile }
}

// ------------------------------- admin RPCs ---------------------------------

export async function adminCreateUser({ id, email, password, role, name, data }) {
  const { data: newId, error } = await supabase.rpc('admin_create_user', {
    p_email: email,
    p_password: password,
    p_role: role,
    p_id: id,
    p_name: name,
    p_data: data || {},
  })
  if (error) throw error
  return newId
}
