// ---------------------------------------------------------------------------
// Supabase data layer
// ---------------------------------------------------------------------------
// Maps the app's camelCase collections onto the Supabase tables, where each row
// is `{ id, <a few scalar columns>, data jsonb }`. The nested parts of an object
// (program content, enrollment progress/payment, etc.) round-trip inside `data`.
// ---------------------------------------------------------------------------
import { supabase, verifyPassword } from './supabase'

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
  trainerRatings: {
    table: 'trainer_ratings',
    scalars: { traineeId: 'trainee_id', trainerId: 'trainer_id', programId: 'program_id' },
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

// The authoritative trainer <-> program assignments (migration 019). Read-only
// in the store: it is written through assignTrainerPrograms/syncTrainerPrograms.
// A trainer sees only their own rows; a Super Admin sees every row (RLS).
export async function fetchTrainerPrograms() {
  const { data, error } = await supabase.from('trainer_programs').select('*')
  if (error) throw error
  return (data || []).map((row) => ({
    id: row.id,
    trainerId: row.trainer_id,
    programId: row.program_id,
    status: row.status,
  }))
}

export async function loadAll() {
  const queries = COLLECTION_NAMES.map((n) => supabase.from(COLLECTIONS[n].table).select('*'))
  queries.push(supabase.from('profiles').select('*'))
  queries.push(supabase.from('settings').select('*').eq('id', 'global').limit(1))
  queries.push(supabase.from('trainer_programs').select('*'))

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

  // Authoritative assignments — non-fatal if the table is unavailable so the
  // rest of the LMS still loads.
  const tpRes = results[COLLECTION_NAMES.length + 2]
  if (tpRes.error) {
    console.warn('Failed to load trainer_programs:', tpRes.error)
    db.trainerPrograms = []
  } else {
    db.trainerPrograms = (tpRes.data || []).map((row) => ({
      id: row.id,
      trainerId: row.trainer_id,
      programId: row.program_id,
      status: row.status,
    }))
  }

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

// ------------------------------- MFA (AAL) ----------------------------------
// Whether the signed-in user must complete an MFA challenge to reach AAL2.
export async function getMfaAssurance() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return { needsChallenge: false, currentLevel: 'aal1', nextLevel: 'aal1' }
  const needsChallenge = data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
  let factorId = null
  if (needsChallenge) {
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totp = (factors?.totp || []).find((f) => f.status === 'verified')
    factorId = totp?.id || null
  }
  return {
    needsChallenge: needsChallenge && Boolean(factorId),
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
    factorId,
  }
}

export async function verifyMfa(factorId, code) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) return { ok: false, error: challengeError.message }
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: String(code).trim(),
  })
  if (verifyError) return { ok: false, error: verifyError.message }
  return { ok: true }
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

// Email a newly created account (trainer or trainee) an activation link so they
// can set their own password. Uses Supabase Auth's mailer (the project's
// configured SMTP, e.g. Gmail), so it needs no third-party provider.
// Best-effort — the caller decides whether a failure should surface.
export async function sendActivationEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/login`,
  })
  if (error) throw error
}

// Send a password-reset link to any account (used by the Login page's
// "Forgot password?"). The link lands on /reset-password where the user sets a
// new password. Supabase never reveals whether the email exists.
export async function sendPasswordResetEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

// Set a new password for the currently signed-in user (used by /reset-password
// after a recovery link, which establishes a session).
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// Change the password of a signed-in user, re-verifying the current password
// first so a borrowed session cannot silently change it.
//
// The current password is checked with a stateless token-endpoint call rather
// than signInWithPassword: signing in again on the main client would replace
// the session and, for an MFA-enabled account, drop it from AAL2 to AAL1 —
// after which Supabase refuses the password update ("AAL2 session is required
// to update email or password when MFA is enabled"). The stateless check leaves
// the session untouched.
export async function changePassword(currentPassword, newPassword) {
  const { data } = await supabase.auth.getUser()
  const email = data?.user?.email
  if (email && currentPassword) {
    const ok = await verifyPassword(email, currentPassword)
    if (!ok) throw new Error('Your current password is incorrect.')
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// Assign a trainer to programs (the authoritative many-to-many used by RLS).
// Super Admin only — enforced by the trainer_programs RLS policy.
export async function assignTrainerPrograms(trainerId, programIds) {
  const ids = (programIds || []).filter(Boolean)
  if (!trainerId || !ids.length) return
  const rows = ids.map((programId) => ({ trainer_id: trainerId, program_id: programId, status: 'active' }))
  const { error } = await supabase
    .from('trainer_programs')
    .upsert(rows, { onConflict: 'trainer_id,program_id' })
  if (error) throw error
}

// Reconcile a trainer's program assignments to exactly `programIds`
// (Super Admin only). Used when editing a trainer so RLS stays in sync.
export async function syncTrainerPrograms(trainerId, programIds) {
  if (!trainerId) return
  const ids = (programIds || []).filter(Boolean)
  const { error: delError } = await supabase.from('trainer_programs').delete().eq('trainer_id', trainerId)
  if (delError) throw delError
  if (!ids.length) return
  const rows = ids.map((programId) => ({ trainer_id: trainerId, program_id: programId, status: 'active' }))
  const { error } = await supabase
    .from('trainer_programs')
    .upsert(rows, { onConflict: 'trainer_id,program_id' })
  if (error) throw error
}

// Idempotently flip the signed-in trainer's own profile from pending_activation
// to active. Without this a freshly created trainer passes the login but RLS
// (is_active_trainer) blocks every trainer write. Safe to call on every login.
export async function activateMyAccount() {
  const { error } = await supabase.rpc('activate_my_account')
  if (error) throw error
}
