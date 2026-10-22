import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buildSeed } from '../data/seed'
import { setLivePrograms } from '../data/programs'
import { uid, slugify } from '../lib/utils'
import { getQuizAccess, quizWindow, quizBlockedMessage } from '../lib/quizAccess'
import { getTypingAccess, typingTestsOf, typingRequestsOf, unusedTypingGrant } from '../lib/typingAccess'
import { applyRequirementResubmission, canPayEnrollment, isEnrollmentLocked } from '../lib/enrollmentRequirements'
import { validateCourse } from '../lib/courseValidation'
import { enrollmentTrainerId } from './selectors'
import { isSupabaseConfigured, supabase, initialUrlAuthType } from '../lib/supabase'
import * as backend from '../lib/backend'

const DB_KEY = 'tesda-lms-db-v2'
const SESSION_KEY = 'tesda-lms-session-v1'
const SETTINGS_KEY = 'tesda-lms-settings-v1'

const DEFAULT_SETTINGS = {
  institution: 'HYT Global Institute',
  academicYear: '2026 - 2027',
  passingScore: 75,
  typingPassingRate: 40,
  attendanceRequirement: 80,
  allowSelfEnroll: true,
  maintenanceMode: false,
  notifyEmail: true,
}

const EMPTY_DB = {
  users: [],
  programs: [],
  schedules: [],
  enrollments: [],
  attendance: [],
  quizAttempts: [],
  quizRequests: [],
  quizSessions: [],
  examAttempts: [],
  typingTests: [],
  typingRequests: [],
  evaluations: [],
  trainerRatings: [],
  trainerPrograms: [],
  announcements: [],
  announcementReads: [],
}

// ---------------------------------------------------------------------------
// Lesson <-> quiz link
// ---------------------------------------------------------------------------
// The trainee's lesson row shows the quiz state ("Quiz not taken", "Passed",
// "Take Quiz") only when lesson.quizId points at the quiz. A quiz may also be
// standalone, in which case no lesson points at it.
const withQuizLessonLink = (program, quiz) => {
  const apply = (lessons = []) =>
    lessons.map((l) => {
      if (quiz.lessonId && l.id === quiz.lessonId) return { ...l, quizId: quiz.id }
      if (l.quizId === quiz.id) return { ...l, quizId: null }
      return l
    })
  return {
    ...program,
    competencies: (program.competencies || []).map((comp) =>
      comp.units
        ? { ...comp, units: comp.units.map((u) => ({ ...u, lessons: apply(u.lessons) })) }
        : { ...comp, lessons: apply(comp.lessons) },
    ),
  }
}

const withoutQuizLessonLink = (program, quizId) => {
  const apply = (lessons = []) => lessons.map((l) => (l.quizId === quizId ? { ...l, quizId: null } : l))
  return {
    ...program,
    competencies: (program.competencies || []).map((comp) =>
      comp.units
        ? { ...comp, units: comp.units.map((u) => ({ ...u, lessons: apply(u.lessons) })) }
        : { ...comp, lessons: apply(comp.lessons) },
    ),
  }
}

const AppContext = createContext(null)

// Random placeholder password for a newly created account. It is never shown
// to anyone: the trainer/trainee sets their OWN password from the emailed
// activation link (see backend.sendActivationEmail + the /welcome page).
function generateTempPassword(len = 12) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => charset[b % charset.length]).join('')
}

// An enrollment created from an admin program assignment: active immediately
// and fully funded, so assigning a program simply becomes one of the trainee's
// courses (no fee/balance is created). `trainerId` is the trainer the admin
// assigned to handle this trainee for this program.
function buildAssignedEnrollment(traineeId, programId, trainerId = null) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: uid('enr'),
    traineeId,
    programId,
    trainerId: trainerId || null,
    type: 'scholarship',
    status: 'Enrolled',
    appliedDate: today,
    startDate: today,
    endDate: null,
    progress: {},
    certificateIssued: false,
    voucher: { name: 'Assigned by administrator', number: null, sponsor: 'HYT Global Institute', date: today },
    payment: {
      fee: 0,
      status: 'Fully Paid',
      amountPaid: 0,
      balance: 0,
      paymentDate: null,
      referenceNo: null,
      note: 'Fully funded by scholarship/voucher',
    },
  }
}

// Offline (demo) mode: the whole db lives in localStorage.
function loadLocalDB() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return { ...EMPTY_DB, ...JSON.parse(raw) }
  } catch (e) {
    console.warn('Failed to read LMS data, reseeding.', e)
  }
  const seed = buildSeed()
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seed))
  } catch (e) {
    console.warn('Failed to persist LMS data.', e)
  }
  return seed
}

function loadLocalSession() {
  try {
    // Session lives in sessionStorage so closing the tab signs the user out.
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadLocalSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function AppProvider({ children }) {
  // When Supabase is configured the seed is never shown — we start empty and
  // load everything from the server behind a `ready` gate.
  const [db, setDb] = useState(() => (isSupabaseConfigured ? EMPTY_DB : loadLocalDB()))
  const [user, setUser] = useState(() => (isSupabaseConfigured ? null : loadLocalSession()))
  const [settings, setSettings] = useState(() => (isSupabaseConfigured ? { ...DEFAULT_SETTINGS } : loadLocalSettings()))
  const [toasts, setToasts] = useState([])
  const [ready, setReady] = useState(!isSupabaseConfigured)
  // Set when a restored session still needs its second factor (an AAL1 session
  // with a verified factor enrolled). The app shows the MFA challenge before
  // treating the user as signed in — otherwise an AAL1 session looks signed in
  // but every MFA-protected RPC refuses.
  const [mfaPending, setMfaPending] = useState(null)
  // True while the signed-in user still has to choose their own password — a
  // freshly invited trainer/trainee (user_metadata.must_set_password). App gates
  // the whole router on this so they can't reach a dashboard first.
  const [mustSetPassword, setMustSetPassword] = useState(false)

  // Keep a synchronous mirror of db so mutations can compute the next state and
  // persist it without relying on the async setState updater.
  const dbRef = useRef(db)
  const settingsRef = useRef(settings)
  // True while a local change is being pushed to Supabase, so the background
  // refresh never overwrites it with a stale snapshot.
  const syncingRef = useRef(false)
  // Bumped on every local change; lets a background refresh detect that a save
  // landed while it was fetching and discard its now-stale snapshot.
  const localVersionRef = useRef(0)
  // Every write is pushed to Supabase in order. Pages that must not claim
  // success before the row lands (quiz/exam submission) await this chain.
  const syncChainRef = useRef(Promise.resolve())

  // Keep the pure program/lesson helpers in data/programs.js in sync with the
  // persisted store so trainer/admin content edits are visible everywhere.
  setLivePrograms(db.programs)

  // ------------------------------- Toasts -----------------------------------
  const toast = useCallback((message, type = 'success', title) => {
    const id = uid('toast')
    setToasts((t) => [...t, { id, message, type, title }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // --------------------------- Commit / persistence -------------------------
  // commit() replaces every setDb() call: it computes the next db synchronously,
  // updates state, and (online) pushes the diff to Supabase.
  const commit = useCallback(
    (updater, opts = {}) => {
      const prev = dbRef.current
      const next = typeof updater === 'function' ? updater(prev) : updater
      dbRef.current = next
      localVersionRef.current += 1
      setDb(next)
      if (isSupabaseConfigured) {
        syncingRef.current = true
        // Queued so two rapid commits cannot write out of order (or in
        // parallel against the same rows).
        const run = syncChainRef.current
          .catch(() => {})
          .then(() => backend.syncCollections(prev, next))
        syncChainRef.current = run
        run
          .catch((e) => {
            console.error('Failed to sync to Supabase', e)
            // Callers that show their own message pass silentSyncError so one
            // failed write does not produce two competing error toasts.
            if (!opts.silentSyncError) toast(`Failed to save to the server: ${e?.message || e}`, 'error')
          })
          .finally(() => {
            // Only clear the flag when nothing newer is queued behind this run.
            if (syncChainRef.current === run) syncingRef.current = false
          })
      }
      return next
    },
    [toast],
  )

  // Resolves once every queued write has reached Supabase (rejects with the
  // first failure). Callers use it to confirm a submission actually saved.
  const flushSync = useCallback(() => syncChainRef.current, [])

  // Re-push a single row that failed to save earlier (used by the "Retry save"
  // button on a quiz/exam result page).
  const retrySaveRow = useCallback((collection, obj) => {
    if (!isSupabaseConfigured) return Promise.resolve()
    return backend.upsertRow(collection, obj)
  }, [])

  // Safety net: if db is replaced directly (initial load), keep the ref aligned.
  useEffect(() => {
    dbRef.current = db
  }, [db])
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // ------------------------- Initial load (online) --------------------------
  // RLS only returns rows to an authenticated session, so we restore the
  // session first and only then fetch the data.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    ;(async () => {
      try {
        const session = await backend.getSession()
        if (session?.user) {
          const profile = await backend.fetchProfile(session.user.id)
          // A freshly invited trainer is pending_activation; activate them on
          // their first sign-in so RLS lets them work. Idempotent.
          if (profile?.role === 'trainer') {
            try {
              await backend.activateMyAccount()
            } catch (e) {
              console.warn('Trainer activation failed:', e)
            }
          }
          // A restored session that still needs its second factor is only AAL1;
          // ask for the code before treating the user as signed in.
          const mfa = await backend.getMfaAssurance()
          if (mfa?.needsChallenge) {
            if (!cancelled) setMfaPending({ factorId: mfa.factorId, profile })
            return
          }
          if (!cancelled && profile) setUser(profile)
          const { db: loaded, settings: loadedSettings } = await backend.loadAll()
          if (cancelled) return
          dbRef.current = loaded
          setDb(loaded)
          if (loadedSettings) {
            const merged = { ...DEFAULT_SETTINGS, ...loadedSettings }
            settingsRef.current = merged
            setSettings(merged)
          }
        }
      } catch (e) {
        console.error('Failed to load data from Supabase', e)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ------------------- Onboarding password gate (auth) ---------------------
  // Mirror user_metadata.must_set_password from the live auth session. It is set
  // by admin_create_user for new trainers/trainees and cleared by updatePassword
  // once they choose their own. Kept in sync across sign-in, email-link
  // recovery and the update itself via onAuthStateChange. The email-link type
  // (initialUrlAuthType === 'recovery') is a fallback so the gate also fires
  // when the account has no metadata flag (e.g. trainee created before 027).
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelled = false
    const sync = (session, event) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY') {
        setMustSetPassword(true)
        return
      }
      if (event === 'SIGNED_OUT') {
        setMustSetPassword(false)
        return
      }
      const flag = Boolean(session?.user?.user_metadata?.must_set_password)
      const fromLink = Boolean(session?.user) && initialUrlAuthType === 'recovery'
      setMustSetPassword(flag || fromLink)
    }
    supabase.auth.getSession().then(({ data }) => sync(data?.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => sync(session, event))
    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
    }
  }, [])

  // --------------------- Offline persistence (demo mode) --------------------
  useEffect(() => {
    if (isSupabaseConfigured) return
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db))
    } catch (e) {
      console.warn('Failed to persist LMS data.', e)
    }
  }, [db])

  useEffect(() => {
    if (isSupabaseConfigured) return
    try {
      // Tab-scoped: cleared automatically when the tab is closed.
      if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [user])

  useEffect(() => {
    if (isSupabaseConfigured) return
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings])

  // -------------------------------- Auth ------------------------------------
  const loadRemoteData = useCallback(async (opts = {}) => {
    const startVersion = localVersionRef.current
    const { db: loaded, settings: loadedSettings } = await backend.loadAll()
    // If a local change landed while this fetch was in flight, the snapshot is
    // stale — applying it would wipe the just-saved change. Drop it.
    if (opts.skipIfLocalChanged && localVersionRef.current !== startVersion) return
    dbRef.current = loaded
    setDb(loaded)
    if (loadedSettings) {
      const merged = { ...DEFAULT_SETTINGS, ...loadedSettings }
      settingsRef.current = merged
      setSettings(merged)
    }
  }, [])

  // --------------------- Background refresh (near-live) ---------------------
  // There is no realtime channel, so a save made by another user (e.g. a
  // trainer recording attendance) would only appear after a manual reload.
  // Re-fetch when the tab regains focus and every 60s so trainees/admins see
  // fresh data on their own. Skipped while a local save is still syncing so an
  // in-flight change is never clobbered by a stale server snapshot.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const refresh = () => {
      if (syncingRef.current) return
      loadRemoteData({ skipIfLocalChanged: true }).catch((e) => console.warn('Background refresh failed:', e))
    }
    const onFocus = () => refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const id = setInterval(refresh, 60000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(id)
    }
  }, [user, loadRemoteData])

  const login = useCallback(
    async (email, password) => {
      if (isSupabaseConfigured) {
        try {
          const res = await backend.signIn(email, password)
          if (!res.ok) return res
          // Activate a pending trainer on first sign-in (idempotent).
          if (res.user?.role === 'trainer') {
            try {
              await backend.activateMyAccount()
            } catch (e) {
              console.warn('Trainer activation failed:', e)
            }
          }
          // If the account has a verified MFA factor, the session is still AAL1
          // until the challenge is completed — hand that back to the UI.
          const mfa = await backend.getMfaAssurance()
          if (mfa?.needsChallenge) {
            return { ok: true, mfaRequired: true, factorId: mfa.factorId, user: res.user }
          }
          await loadRemoteData()
          setUser(res.user)
          return res
        } catch (e) {
          console.error(e)
          return { ok: false, error: e?.message || 'Unable to sign in. Please try again.' }
        }
      }
      const found = dbRef.current.users.find(
        (u) => u.email.toLowerCase() === String(email).toLowerCase().trim() && u.password === password,
      )
      if (!found) return { ok: false, error: 'Invalid email or password.' }
      setUser(found)
      return { ok: true, user: found }
    },
    [loadRemoteData],
  )

  // Complete the MFA challenge that login() paused on. On success the session
  // is upgraded to AAL2 and the user is signed in.
  const completeMfa = useCallback(
    async (factorId, code, profile) => {
      if (!isSupabaseConfigured) return { ok: false, error: 'MFA is unavailable in demo mode.' }
      try {
        const res = await backend.verifyMfa(factorId, code)
        if (!res.ok) return res
        await loadRemoteData()
        setUser(profile)
        setMfaPending(null)
        return { ok: true, user: profile }
      } catch (e) {
        console.error(e)
        return { ok: false, error: e?.message || 'Unable to verify the code. Please try again.' }
      }
    },
    [loadRemoteData],
  )

  const logout = useCallback(() => {
    if (isSupabaseConfigured) {
      backend.signOut().catch(() => {})
      dbRef.current = EMPTY_DB
      setDb(EMPTY_DB)
    }
    setUser(null)
    setMfaPending(null)
  }, [])

  const updateProfile = useCallback(
    async (patch) => {
      if (!user) return { ok: false, error: 'Not signed in.' }

      const { email: rawEmail, ...profilePatch } = patch || {}
      const nextEmail = String(rawEmail || '').trim()
      const emailChanged =
        Boolean(nextEmail) && nextEmail.toLowerCase() !== String(user.email || '').toLowerCase()

      // `email` belongs to Supabase Auth and is a protected profile column, so
      // it must never go through the profiles upsert. Everything else is saved
      // directly; the address is changed with auth.updateUser below.
      const nextUser = { ...user, ...profilePatch, email: user.email }
      commit((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, ...profilePatch } : u)) }))
      setUser(nextUser)

      if (isSupabaseConfigured) {
        try {
          await backend.upsertProfile(nextUser)
        } catch (e) {
          console.error(e)
          toast(`Failed to update your profile: ${e?.message || e}`, 'error')
          return { ok: false, error: e?.message || 'Failed to update your profile.' }
        }
      }

      if (!emailChanged) {
        toast('Profile updated successfully.')
        return { ok: true }
      }

      if (!isSupabaseConfigured) {
        setUser((u) => ({ ...u, email: nextEmail }))
        commit((d) => ({
          ...d,
          users: d.users.map((u) => (u.id === user.id ? { ...u, email: nextEmail } : u)),
        }))
        toast('Profile updated successfully.')
        return { ok: true }
      }

      try {
        const authUser = await backend.updateMyEmail(nextEmail)
        if (authUser?.new_email) {
          // Email confirmations are enabled: the change lands once the link is
          // opened, and the DB trigger syncs the profile at that moment.
          toast(`Confirmation link sent to ${nextEmail}. Your email changes once confirmed.`, 'info')
        } else {
          const confirmedEmail = authUser?.email || nextEmail
          setUser((u) => ({ ...u, email: confirmedEmail }))
          commit((d) => ({
            ...d,
            users: d.users.map((u) => (u.id === user.id ? { ...u, email: confirmedEmail } : u)),
          }))
          toast('Email updated successfully.')
        }
        return { ok: true }
      } catch (e) {
        console.error(e)
        toast(`Could not update your email: ${e?.message || e}`, 'error')
        return { ok: false, error: e?.message || 'Could not update your email.' }
      }
    },
    [user, commit, toast],
  )

  // Change the signed-in user's password (re-verifies the current one first).
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!isSupabaseConfigured) {
        toast('Password change is unavailable in demo mode.', 'info')
        return { ok: false, error: 'Unavailable in demo mode.' }
      }
      try {
        await backend.changePassword(currentPassword, newPassword)
        toast('Your password has been updated.')
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e?.message || 'Could not update your password.' }
      }
    },
    [toast],
  )

  // ------------------------------ Users (admin) -----------------------------
  const saveUser = useCallback(
    (payload) => {
      const isEdit = payload.id && dbRef.current.users.some((u) => u.id === payload.id)
      const role = payload.role === 'trainer' ? 'trainer' : payload.role === 'trainee' ? 'trainee' : 'admin'
      const id = payload.id || uid(role === 'trainer' ? 'tr' : role === 'trainee' ? 'tn' : 'sa')

      if (isEdit) {
        commit((d) => ({ ...d, users: d.users.map((u) => (u.id === payload.id ? { ...u, ...payload } : u)) }))
        if (isSupabaseConfigured) {
          const updated = dbRef.current.users.find((u) => u.id === payload.id)
          if (updated) {
            backend.upsertProfile(updated).catch((e) => {
              console.error(e)
              toast('Failed to update the account.', 'error')
            })
          }
        }
        toast('Record updated.')
        return { ok: true, user: payload }
      }

      // Create
      if (isSupabaseConfigured) {
        if (!payload.password) {
          toast('A temporary password is required to create an account.', 'error')
          return { ok: false, error: 'Password required.' }
        }
        const { password, id: _ignoredId, role: _ignoredRole, ...rest } = payload
        const { email, name, ...data } = rest
        backend
          .adminCreateUser({ id, email, password, role, name, data })
          .then(() => backend.fetchProfiles())
          .then((users) => {
            dbRef.current = { ...dbRef.current, users }
            setDb(dbRef.current)
            toast('Account created.')
          })
          .catch((e) => {
            console.error(e)
            toast(e?.message || 'Failed to create the account.', 'error')
          })
        return { ok: true, user: { ...payload, id } }
      }

      commit((d) => ({ ...d, users: [...d.users, { ...payload, id }] }))
      toast('Record created.')
      return { ok: true, user: { ...payload, id } }
    },
    [commit, toast],
  )

  // Create a TRAINER account (online): creates the auth user + profile via the
  // admin_create_user RPC, then emails an activation link via Supabase Auth.
  // The account is created with a random placeholder password that is never
  // shown — the trainer sets their OWN password from the emailed link.
  const createTrainer = useCallback(
    async (payload) => {
      if (!isSupabaseConfigured) {
        saveUser(payload)
        return { ok: true, emailed: false }
      }
      const id = payload.id || uid('tr')
      const tempPassword = generateTempPassword()
      try {
        const { password: _pw, id: _id, role: _role, ...rest } = payload
        const { email, name, ...data } = rest
        await backend.adminCreateUser({ id, email, password: tempPassword, role: 'trainer', name, data })
        // Record the authoritative program assignments so trainer RLS works.
        try {
          await backend.assignTrainerPrograms(id, data.programs)
        } catch (e) {
          console.warn('Failed to assign trainer programs:', e)
        }

        // System Settings > Email notifications. When off, the account is
        // created but nothing is emailed — the admin shares the activation
        // link manually.
        let emailed = false
        if (settingsRef.current?.notifyEmail !== false) {
          emailed = true
          try {
            await backend.sendActivationEmail(email)
          } catch (e) {
            emailed = false
            console.warn('Trainer activation email failed:', e)
          }
        }

        const users = await backend.fetchProfiles()
        dbRef.current = { ...dbRef.current, users }
        setDb(dbRef.current)
        return { ok: true, emailed }
      } catch (e) {
        console.error(e)
        return { ok: false, error: e?.message || 'Failed to create the trainer.' }
      }
    },
    [saveUser],
  )

  // Update an existing TRAINER: profile fields via saveUser() plus a reconcile
  // of the authoritative program assignments (trainer_programs) used by RLS.
  const updateTrainer = useCallback(
    async (payload) => {
      saveUser(payload)
      if (isSupabaseConfigured && payload.id) {
        try {
          await backend.syncTrainerPrograms(payload.id, payload.programs)
          // Refresh the authoritative assignments so a removed program does not
          // linger in the in-memory union until the next full reload.
          const trainerPrograms = await backend.fetchTrainerPrograms()
          dbRef.current = { ...dbRef.current, trainerPrograms }
          setDb(dbRef.current)
        } catch (e) {
          console.warn('Failed to sync trainer programs:', e)
        }
      }
      return { ok: true }
    },
    [saveUser],
  )

  // ------------------------------ Trainees (admin) --------------------------
  // A trainee's assigned programs ARE their courses: assigning a program creates
  // an active, fully-funded ("scholarship") enrollment, and unassigning removes
  // it. This mirrors how a trainer's program assignments drive their courses.
  const syncTraineeEnrollments = useCallback(
    (traineeId, programIds, programTrainers = {}) => {
      if (!traineeId) return
      const wanted = new Set((programIds || []).filter(Boolean))
      commit((d) => {
        const others = d.enrollments.filter((e) => e.traineeId !== traineeId)
        const mine = d.enrollments.filter((e) => e.traineeId === traineeId)
        // Keep existing courses (preserving progress/status), updating the
        // trainer only when the admin explicitly picked one.
        const kept = mine
          .filter((e) => wanted.has(e.programId))
          .map((e) => (programTrainers[e.programId] ? { ...e, trainerId: programTrainers[e.programId] } : e))
        const have = new Set(kept.map((e) => e.programId))
        const added = [...wanted]
          .filter((pid) => !have.has(pid))
          .map((pid) => buildAssignedEnrollment(traineeId, pid, programTrainers[pid]))
        return { ...d, enrollments: [...others, ...kept, ...added] }
      })
    },
    [commit],
  )

  // Create a TRAINEE account (online): creates the auth user + profile via the
  // admin_create_user RPC, emails an activation link, and turns their program
  // assignments into enrollments (their courses). The account is created with a
  // random placeholder password that is never shown — the trainee sets their
  // OWN password from the emailed link.
  const createTrainee = useCallback(
    async (payload) => {
      const id = payload.id || uid('tn')
      const assigned = payload.enrolledPrograms || []
      const programTrainers = payload.programTrainers || {}
      if (!isSupabaseConfigured) {
        saveUser({ ...payload, id })
        syncTraineeEnrollments(id, assigned, programTrainers)
        return { ok: true, emailed: false }
      }
      const tempPassword = generateTempPassword()
      try {
        const { password: _pw, id: _id, role: _role, ...rest } = payload
        const { email, name, ...data } = rest
        await backend.adminCreateUser({ id, email, password: tempPassword, role: 'trainee', name, data })
        syncTraineeEnrollments(id, assigned, programTrainers)

        // Respect System Settings > Email notifications (see createTrainer).
        let emailed = false
        if (settingsRef.current?.notifyEmail !== false) {
          emailed = true
          try {
            await backend.sendActivationEmail(email)
          } catch (e) {
            emailed = false
            console.warn('Trainee activation email failed:', e)
          }
        }

        const users = await backend.fetchProfiles()
        dbRef.current = { ...dbRef.current, users }
        setDb(dbRef.current)
        return { ok: true, emailed }
      } catch (e) {
        console.error(e)
        return { ok: false, error: e?.message || 'Failed to create the trainee.' }
      }
    },
    [saveUser, syncTraineeEnrollments],
  )

  // Update an existing TRAINEE: profile fields via saveUser() plus a reconcile
  // of their enrollments to match their program assignments.
  const updateTrainee = useCallback(
    async (payload) => {
      saveUser(payload)
      if (payload.id) syncTraineeEnrollments(payload.id, payload.enrolledPrograms, payload.programTrainers || {})
      return { ok: true }
    },
    [saveUser, syncTraineeEnrollments],
  )

  const deleteUser = useCallback(
    async (id) => {
      // Remove the profile AND every record that references it, so the
      // dashboards, charts and rosters stay consistent — no orphaned
      // enrollments/attendance left behind after a delete.
      const purge = (d) => ({
        ...d,
        users: d.users.filter((u) => u.id !== id),
        enrollments: d.enrollments.filter((e) => e.traineeId !== id),
        attendance: d.attendance.filter((a) => a.traineeId !== id),
        quizAttempts: d.quizAttempts.filter((a) => a.traineeId !== id),
        quizRequests: (d.quizRequests || []).filter((r) => r.traineeId !== id),
        quizSessions: (d.quizSessions || []).filter((s) => s.traineeId !== id),
        examAttempts: d.examAttempts.filter((a) => a.traineeId !== id),
        typingTests: d.typingTests.filter((t) => t.traineeId !== id && t.trainerId !== id),
        typingRequests: (d.typingRequests || []).filter((r) => r.traineeId !== id && r.trainerId !== id),
        evaluations: d.evaluations.filter((e) => e.traineeId !== id && e.trainerId !== id),
        trainerRatings: (d.trainerRatings || []).filter((r) => r.traineeId !== id && r.trainerId !== id),
        trainerPrograms: (d.trainerPrograms || []).filter((tp) => tp.trainerId !== id),
        schedules: d.schedules.filter((s) => s.trainerId !== id),
      })
      if (isSupabaseConfigured) {
        try {
          await backend.deleteProfile(id)
          commit(purge)
          toast('Record deleted.', 'info')
        } catch (e) {
          console.error(e)
          toast('Failed to delete the account.', 'error')
        }
        return
      }
      commit(purge)
      toast('Record deleted.', 'info')
    },
    [commit, toast],
  )

  // Public self-registration — always creates a TRAINEE account.
  const registerTrainee = useCallback(
    async (payload) => {
      if (isSupabaseConfigured) {
        try {
          return await backend.signUpTrainee(payload)
        } catch (e) {
          console.error(e)
          return { ok: false, error: e?.message || 'Unable to create your account. Please try again.' }
        }
      }
      const email = String(payload.email || '').trim().toLowerCase()
      if (dbRef.current.users.some((u) => u.email.toLowerCase() === email)) {
        return { ok: false, error: 'An account with this email already exists.' }
      }
      const id = uid('tn')
      const account = {
        id,
        role: 'trainee',
        name: payload.name,
        email: payload.email.trim(),
        password: payload.password,
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
      commit((d) => ({ ...d, users: [...d.users, account] }))
      return { ok: true, user: account }
    },
    [commit],
  )

  // ------------------------------ Programs ----------------------------------
  const saveProgram = useCallback(
    (id, patch) => {
      commit((d) => ({ ...d, programs: d.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
      toast('Course updated.')
    },
    [commit, toast],
  )

  // Create a new training program. Starts with empty competencies/quizzes/exams
  // which trainers then populate (all helpers handle empty arrays).
  const addProgram = useCallback(
    (payload) => {
      // Required fields + unique course code/title, enforced here as well as in
      // the form so no other caller can slip a duplicate into the catalogue.
      const check = validateCourse(payload, { programs: dbRef.current.programs })
      if (!check.ok) {
        toast(check.error, 'error')
        return { ok: false, error: check.error, field: check.field }
      }
      const title = String(payload.title || '').trim()
      const base = slugify(title) || 'course'
      let id = base
      let n = 1
      while (dbRef.current.programs.some((p) => p.id === id)) id = `${base}-${++n}`
      const program = {
        id,
        code: String(payload.code || '').trim() || id.toUpperCase().slice(0, 8),
        title,
        category: String(payload.category || '').trim() || 'General',
        level: payload.level || 'NC II',
        special: !!payload.special,
        enrollable: true,
        description: String(payload.description || '').trim(),
        overview: String(payload.overview || payload.description || '').trim(),
        duration: String(payload.duration || '').trim(),
        hours: Number(payload.hours) || 0,
        fee: Number(payload.fee) || 0,
        color: payload.color || 'from-brand-500 to-indigo-600',
        image: '',
        requirements: [],
        trainerId: payload.trainerId || null,
        competencies: [],
        quizzes: [],
        exams: [],
      }
      commit((d) => ({ ...d, programs: [...d.programs, program] }))
      toast('Course created.')
      return { ok: true, program }
    },
    [commit, toast],
  )

  // Delete a program and cascade its enrollments + schedules so no orphaned
  // rows remain. Returns the counts that were removed (for the confirm dialog).
  const deleteProgram = useCallback(
    (id) => {
      const prev = dbRef.current
      const removed = {
        enrollments: prev.enrollments.filter((e) => e.programId === id).length,
        schedules: prev.schedules.filter((s) => s.programId === id).length,
      }
      commit((d) => ({
        ...d,
        programs: d.programs.filter((p) => p.id !== id),
        enrollments: d.enrollments.filter((e) => e.programId !== id),
        schedules: d.schedules.filter((s) => s.programId !== id),
      }))
      toast('Course deleted.', 'info')
      return removed
    },
    [commit, toast],
  )

  // --------------------------- Program content ------------------------------
  // Lessons live nested in competencies (Basic/Common) or competency units (Core).
  const saveLesson = useCallback(
    (programId, { competencyId, unitId, lesson }) => {
      commit((d) => ({
        ...d,
        programs: d.programs.map((p) => {
          if (p.id !== programId) return p
          const competencies = p.competencies.map((comp) => {
            if (comp.id !== competencyId) return comp
            if (comp.units) {
              const units = comp.units.map((u) => {
                if (u.id !== unitId) return u
                const exists = u.lessons.some((l) => l.id === lesson.id)
                const lessons = exists
                  ? u.lessons.map((l) => (l.id === lesson.id ? { ...l, ...lesson } : l))
                  : [...u.lessons, lesson]
                return { ...u, lessons }
              })
              return { ...comp, units }
            }
            const exists = comp.lessons.some((l) => l.id === lesson.id)
            const lessons = exists
              ? comp.lessons.map((l) => (l.id === lesson.id ? { ...l, ...lesson } : l))
              : [...comp.lessons, lesson]
            return { ...comp, lessons }
          })
          return { ...p, competencies }
        }),
      }))
      toast('Lesson saved.')
    },
    [commit, toast],
  )

  const deleteLesson = useCallback(
    (programId, lessonId) => {
      commit((d) => ({
        ...d,
        programs: d.programs.map((p) => {
          if (p.id !== programId) return p
          return {
            ...p,
            // A quiz attached to the deleted lesson becomes standalone.
            quizzes: (p.quizzes || []).map((q) => (q.lessonId === lessonId ? { ...q, lessonId: '' } : q)),
            competencies: p.competencies.map((comp) =>
              comp.units
                ? { ...comp, units: comp.units.map((u) => ({ ...u, lessons: u.lessons.filter((l) => l.id !== lessonId) })) }
                : { ...comp, lessons: comp.lessons.filter((l) => l.id !== lessonId) },
            ),
          }
        }),
      }))
      toast('Lesson deleted.', 'info')
    },
    [commit, toast],
  )

  const saveQuiz = useCallback(
    (programId, quiz) => {
      commit((d) => ({
        ...d,
        programs: d.programs.map((p) => {
          if (p.id !== programId) return p
          const exists = p.quizzes.some((q) => q.id === quiz.id)
          const quizzes = exists ? p.quizzes.map((q) => (q.id === quiz.id ? { ...q, ...quiz } : q)) : [...p.quizzes, quiz]
          return withQuizLessonLink({ ...p, quizzes }, quiz)
        }),
      }))
      toast('Quiz saved.')
    },
    [commit, toast],
  )

  const deleteQuiz = useCallback(
    (programId, quizId) => {
      commit((d) => ({
        ...d,
        programs: d.programs.map((p) =>
          p.id === programId
            ? withoutQuizLessonLink({ ...p, quizzes: p.quizzes.filter((q) => q.id !== quizId) }, quizId)
            : p,
        ),
        quizRequests: (d.quizRequests || []).filter((r) => r.quizId !== quizId),
        quizSessions: (d.quizSessions || []).filter((s) => s.quizId !== quizId),
      }))
      toast('Quiz deleted.', 'info')
    },
    [commit, toast],
  )

  const saveExam = useCallback(
    (programId, exam) => {
      commit((d) => ({
        ...d,
        programs: d.programs.map((p) => {
          if (p.id !== programId) return p
          const exists = p.exams.some((e) => e.id === exam.id)
          const exams = exists ? p.exams.map((e) => (e.id === exam.id ? { ...e, ...exam } : e)) : [...p.exams, exam]
          return { ...p, exams }
        }),
      }))
      toast('Exam saved.')
    },
    [commit, toast],
  )

  const deleteExam = useCallback(
    (programId, examId) => {
      commit((d) => ({
        ...d,
        programs: d.programs.map((p) => (p.id === programId ? { ...p, exams: p.exams.filter((e) => e.id !== examId) } : p)),
      }))
      toast('Exam deleted.', 'info')
    },
    [commit, toast],
  )

  // ---------------------------- Enrollments ---------------------------------
  const createEnrollment = useCallback(
    async (payload) => {
      // The admin can close online enrollment from System Settings. Checked
      // here as well as in the form so no other caller can bypass it.
      if (user?.role === 'trainee' && settingsRef.current?.allowSelfEnroll === false) {
        toast('Online enrollment is currently closed. Please contact the registrar.', 'warning')
        return { ok: false, error: 'Self-enrollment is closed.' }
      }
      const id = uid('enr')
      commit(
        (d) => ({ ...d, enrollments: [...d.enrollments, { ...payload, id, progress: payload.progress || {} }] }),
        { silentSyncError: true },
      )
      if (isSupabaseConfigured) {
        // The in-memory settings copy can be a minute stale, so the server has
        // the final word (migration 063). If it refuses the row, drop the
        // optimistic copy — otherwise the trainee keeps an application that
        // does not exist and it vanishes on the next refresh.
        try {
          await flushSync()
        } catch (e) {
          commit((d) => ({ ...d, enrollments: d.enrollments.filter((en) => en.id !== id) }))
          // 23505 is the unique (trainee_id, program_id) index from migration
          // 069 — a second tab or a double submit, not a closed window.
          const duplicate = e?.code === '23505' || /duplicate key/i.test(e?.message || '')
          toast(
            duplicate
              ? 'You already have an application for this course. Open My Enrollment to see its status.'
              : 'Enrollment was not saved. Online enrollment may have been closed — please contact the registrar.',
            duplicate ? 'warning' : 'error',
          )
          return { ok: false, error: e?.message || String(e) }
        }
      }
      toast('Enrollment submitted successfully.')
      return { ok: true, id }
    },
    [commit, flushSync, toast, user],
  )

  const setEnrollmentStatus = useCallback(
    (id, status, remarks = '') => {
      const decided = ['Rejected', 'Cancelled'].includes(status)
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) =>
          e.id === id
            ? {
                ...e,
                status,
                certificateIssued: status === 'Completed' ? true : e.certificateIssued,
                // Keep the registrar's reason with the record. It stays in the
                // row even if the application is later reinstated, so there is
                // an audit trail; the UI only shows it while closed.
                ...(decided
                  ? {
                      decisionRemarks: String(remarks || '').trim(),
                      decisionAt: new Date().toISOString(),
                      decisionBy: user?.id || null,
                    }
                  : {}),
              }
            : e,
        ),
      }))
      toast(`Enrollment marked as ${status}.`)
    },
    [commit, toast, user],
  )

  // Super Admin verification of one admission requirement. `decision` is
  // 'Verified', 'Rejected', or 'Submitted' (re-open after a decision).
  const verifyEnrollmentRequirement = useCallback(
    (enrollmentId, requirementName, decision, note = '') => {
      if (!user || user.role !== 'admin') {
        return { ok: false, error: 'Only the Super Admin can verify admission requirements.' }
      }
      const enrollment = dbRef.current.enrollments.find((e) => e.id === enrollmentId)
      if (!enrollment) return { ok: false, error: 'Enrollment not found.' }
      if (!['Verified', 'Rejected', 'Submitted'].includes(decision)) {
        return { ok: false, error: 'Invalid verification status.' }
      }

      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) =>
          e.id === enrollmentId
            ? {
                ...e,
                requirements: (e.requirements || []).map((r) =>
                  r.name === requirementName
                    ? {
                        ...r,
                        status: decision,
                        note: note || '',
                        verifiedAt: decision === 'Submitted' ? null : new Date().toISOString(),
                        verifiedBy: decision === 'Submitted' ? null : user.id,
                      }
                    : r,
                ),
              }
            : e,
        ),
      }))
      toast(
        decision === 'Verified'
          ? 'Requirement verified.'
          : decision === 'Rejected'
            ? 'Requirement rejected.'
            : 'Requirement reopened.',
        decision === 'Rejected' ? 'info' : 'success',
      )
      return { ok: true }
    },
    [commit, toast, user],
  )

  // Admin-side payment edit (Accounting / Manage Enrollments). When the amount
  // paid increases, the difference is appended to the transaction history so the
  // trainee's payment history and receipts stay complete.
  // A trainee re-uploads one admission document (typically after the registrar
  // rejected it). The requirement returns to Submitted so it re-enters the
  // admin verification queue, and any previous verification is cleared.
  const resubmitEnrollmentRequirement = useCallback(
    (enrollmentId, requirementName, doc) => {
      if (!user) return { ok: false, error: 'Not signed in.' }
      const enrollment = dbRef.current.enrollments.find((e) => e.id === enrollmentId)
      if (!enrollment) return { ok: false, error: 'Enrollment not found.' }
      if (enrollment.traineeId !== user.id) {
        return { ok: false, error: 'You can only update your own application.' }
      }
      if (isEnrollmentLocked(enrollment)) {
        return { ok: false, error: 'This application is closed and can no longer be modified.' }
      }
      if (!doc?.url) return { ok: false, error: 'Choose a file to upload.' }

      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) =>
          e.id === enrollmentId ? applyRequirementResubmission(e, requirementName, doc) : e,
        ),
      }))
      toast('Document submitted for review.')
      return { ok: true }
    },
    [commit, toast, user],
  )

  const updatePayment = useCallback(
    (enrollmentId, patch) => {
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => {
          if (e.id !== enrollmentId) return e
          const prev = e.payment || {}
          const before = Number(prev.amountPaid) || 0
          const after = patch.amountPaid === undefined ? before : Number(patch.amountPaid) || 0
          const next = { ...prev, ...patch }
          const delta = after - before
          if (delta > 0) {
            const tx = {
              id: uid('pay'),
              amount: delta,
              method: patch.method || prev.method || 'Over-the-Counter',
              referenceNo: patch.referenceNo || `REF-${Date.now().toString().slice(-8)}`,
              date: patch.paymentDate || new Date().toISOString().slice(0, 10),
              note: patch.note || 'Recorded by the registrar',
            }
            const history = prev.transactions?.length
              ? prev.transactions
              : before > 0
                ? [
                    {
                      id: `${e.id}-opening`,
                      amount: before,
                      method: prev.method || 'Over-the-Counter',
                      referenceNo: prev.referenceNo || '—',
                      date: prev.paymentDate || tx.date,
                      note: 'Initial payment',
                    },
                  ]
                : []
            next.transactions = [...history, tx]
          }
          return { ...e, payment: next }
        }),
      }))
      toast('Payment record updated.')
    },
    [commit, toast],
  )

  // Record a trainee payment (partial or full). Appends to the transaction
  // history and recomputes amountPaid / balance / status.
  const recordPayment = useCallback(
    (enrollmentId, { amount, method, referenceNo, date, note } = {}) => {
      const value = Math.max(0, Number(amount) || 0)
      if (!value) {
        toast('Enter a valid payment amount.', 'error')
        return false
      }
      const enrollment = dbRef.current.enrollments.find((e) => e.id === enrollmentId)
      if (!enrollment) {
        toast('Enrollment not found.', 'error')
        return false
      }
      if (!canPayEnrollment(enrollment)) {
        toast('Payment is available only after the admin approves your enrollment and verifies your requirements.', 'warning')
        return false
      }
      let ok = true
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => {
          if (e.id !== enrollmentId) return e
          const fee = Number(e.payment?.fee) || 0
          const alreadyPaid = Number(e.payment?.amountPaid) || 0
          const applied = Math.min(value, Math.max(0, fee - alreadyPaid))
          if (applied <= 0) {
            ok = false
            return e
          }
          const amountPaid = alreadyPaid + applied
          const balance = Math.max(0, fee - amountPaid)
          const status = amountPaid <= 0 ? 'Unpaid' : balance === 0 ? 'Fully Paid' : 'Partially Paid'
          const paidDate = date || new Date().toISOString().slice(0, 10)
          const tx = {
            id: uid('pay'),
            amount: applied,
            method: method || 'GCash',
            referenceNo: referenceNo || `REF-${Date.now().toString().slice(-8)}`,
            date: paidDate,
            note: note || null,
          }
          // Older enrollments may already carry an amountPaid from the
          // enrollment form without a transactions array. Keep that opening
          // payment in the history instead of dropping it on the first
          // in-app payment.
          const history = e.payment?.transactions?.length
            ? e.payment.transactions
            : alreadyPaid > 0
              ? [
                  {
                    id: `${e.id}-opening`,
                    amount: alreadyPaid,
                    method: e.payment?.method || 'Over-the-Counter',
                    referenceNo: e.payment?.referenceNo || '—',
                    date: e.payment?.paymentDate || paidDate,
                    note: 'Initial payment',
                  },
                ]
              : []
          return {
            ...e,
            payment: {
              ...e.payment,
              amountPaid,
              balance,
              status,
              paymentDate: paidDate,
              referenceNo: tx.referenceNo,
              method: tx.method,
              transactions: [...history, tx],
            },
          }
        }),
      }))
      if (ok) toast('Payment recorded successfully.')
      return ok
    },
    [commit, toast],
  )

  // ------------------------------- Progress ---------------------------------
  const toggleLessonComplete = useCallback(
    (traineeId, programId, lessonId) => {
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => {
          if (e.traineeId !== traineeId || e.programId !== programId) return e
          const progress = { ...e.progress }
          if (progress[lessonId]) delete progress[lessonId]
          else progress[lessonId] = true
          return { ...e, progress }
        }),
      }))
    },
    [commit],
  )

  // ------------------- Quiz scheduling / access requests --------------------
  // A trainee asks for either a retake (already attempted) or late access (the
  // deadline passed before their first attempt). Pending requests grant nothing;
  // only a trainer approval unlocks one more attempt.
  const requestQuizAccess = useCallback(
    ({ programId, quizId, type }) => {
      if (!user) return { ok: false, error: 'Sign in to request quiz access.' }
      const d = dbRef.current
      const program = d.programs.find((p) => p.id === programId)
      const quiz = program?.quizzes?.find((q) => q.id === quizId)
      if (!quiz) return { ok: false, error: 'Quiz not found.' }

      const attempts = d.quizAttempts.filter((a) => a.traineeId === user.id && a.quizId === quizId)
      const requests = (d.quizRequests || []).filter((r) => r.traineeId === user.id && r.quizId === quizId)
      if (requests.some((r) => r.status === 'pending')) {
        return { ok: false, error: 'You already have a pending request for this quiz.' }
      }

      // Sessions are part of the rule: an attempt that timed out still counts
      // as a used attempt when deciding what can be requested.
      const sessions = (d.quizSessions || []).filter((s) => s.traineeId === user.id && s.quizId === quizId)
      const access = getQuizAccess({ quiz, attempts, requests, sessions })
      if (type === 'late' && !access.canRequestLate) {
        return { ok: false, error: 'Late access cannot be requested for this quiz right now.' }
      }
      if (type === 'retake' && !access.canRequestRetake) {
        return { ok: false, error: 'A retake cannot be requested for this quiz right now.' }
      }

      const request = {
        id: uid('qr'),
        traineeId: user.id,
        traineeName: user.name,
        programId,
        quizId,
        quizTitle: quiz.title,
        type,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        decidedAt: null,
        decidedBy: null,
        decidedByName: null,
        note: '',
        attemptsGranted: 0,
        attemptsUsed: 0,
      }
      commit((prev) => ({ ...prev, quizRequests: [...(prev.quizRequests || []), request] }))
      toast(
        type === 'late' ? 'Late access request sent to your trainer.' : 'Retake request sent to your trainer.',
        'success',
      )
      return { ok: true, request }
    },
    [commit, toast, user],
  )

  // Trainer (or Super Admin) decision. Approving grants exactly one attempt.
  const decideQuizRequest = useCallback(
    (requestId, decision, note = '') => {
      if (!user) return { ok: false, error: 'Not signed in.' }
      const d = dbRef.current
      const request = (d.quizRequests || []).find((r) => r.id === requestId)
      if (!request) return { ok: false, error: 'Request not found.' }
      if (request.status !== 'pending') return { ok: false, error: 'This request has already been decided.' }

      const program = d.programs.find((p) => p.id === request.programId)
      const assigned = (d.trainerPrograms || []).some(
        (tp) => tp.trainerId === user.id && tp.programId === request.programId && tp.status !== 'revoked',
      )
      if (user.role !== 'admin' && program?.trainerId !== user.id && !assigned) {
        return { ok: false, error: 'You can only decide requests for your own programs.' }
      }

      const approved = decision === 'approved'
      commit((prev) => ({
        ...prev,
        quizRequests: (prev.quizRequests || []).map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: approved ? 'approved' : 'rejected',
                decidedAt: new Date().toISOString(),
                decidedBy: user.id,
                decidedByName: user.name,
                note: note || '',
                attemptsGranted: approved ? 1 : 0,
                attemptsUsed: 0,
              }
            : r,
        ),
      }))
      toast(approved ? 'Request approved — the trainee can now take the quiz.' : 'Request rejected.', approved ? 'success' : 'info')
      return { ok: true }
    },
    [commit, toast, user],
  )

  // Starts (or resumes) an attempt. The start time is persisted as a
  // `quizSessions` row, so leaving the quiz and coming back continues the same
  // 30-minute clock instead of restarting it.
  const startQuizAttempt = useCallback(
    ({ programId, quizId }) => {
      if (!user) return { ok: false, error: 'Sign in to start the quiz.' }
      const d = dbRef.current
      const program = d.programs.find((p) => p.id === programId)
      const quiz = program?.quizzes?.find((q) => q.id === quizId)
      if (!quiz) return { ok: false, error: 'Quiz not found.' }

      const attempts = d.quizAttempts.filter((a) => a.traineeId === user.id && a.quizId === quizId)
      const requests = (d.quizRequests || []).filter((r) => r.traineeId === user.id && r.quizId === quizId)
      const sessions = (d.quizSessions || []).filter((s) => s.traineeId === user.id && s.quizId === quizId)
      const access = getQuizAccess({ quiz, attempts, requests, sessions })

      if (access.session && access.canResume) return { ok: true, session: access.session, resumed: true }
      if (!access.canStart) {
        return { ok: false, error: quizBlockedMessage(access) || 'This quiz is not available.' }
      }

      // Only one session row exists per trainee/quiz (unique index). When an
      // earlier session already timed out it is restarted in place instead of
      // creating a second row, which the database would reject.
      const startedAt = new Date().toISOString()
      const session = access.session
        ? { ...access.session, startedAt }
        : { id: uid('qs'), traineeId: user.id, programId, quizId, startedAt }
      // The approval is consumed when the attempt is submitted, together with
      // the database trigger that guards the quiz_attempts insert.
      commit((prev) => ({
        ...prev,
        quizSessions: access.session
          ? (prev.quizSessions || []).map((s) => (s.id === session.id ? session : s))
          : [...(prev.quizSessions || []), session],
      }))
      return { ok: true, session, resumed: false }
    },
    [commit, user],
  )

  // ----------------------------- Quiz attempts ------------------------------
  // Guarded write: the same access rules the UI uses are re-checked here, so a
  // tampered client cannot record an unauthorized attempt.
  const recordQuizAttempt = useCallback(
    (attempt, sessionId = null) => {
      const d = dbRef.current
      const program = d.programs.find((p) => p.id === attempt.programId)
      const quiz = program?.quizzes?.find((q) => q.id === attempt.quizId)
      if (!quiz) return { ok: false, error: 'Quiz not found.' }

      const attempts = d.quizAttempts.filter((a) => a.traineeId === attempt.traineeId && a.quizId === attempt.quizId)
      const requests = (d.quizRequests || []).filter(
        (r) => r.traineeId === attempt.traineeId && r.quizId === attempt.quizId,
      )
      const sessions = (d.quizSessions || []).filter(
        (s) => s.traineeId === attempt.traineeId && s.quizId === attempt.quizId,
      )
      const session = sessionId ? sessions.find((s) => s.id === sessionId) : null
      // Evaluate at the moment the trainee started, so a quiz that runs past the
      // deadline still counts as authorized.
      const access = getQuizAccess({ quiz, attempts, requests, sessions, now: new Date(attempt.startedAt || Date.now()) })
      // A started session is already authorized (it may be past its clock now).
      if (!session && !access.canStart) return { ok: false, error: 'This quiz attempt is not authorized.' }

      // The approval counter is NOT incremented here. Writing it before the
      // attempt row lands let a failed save burn the retake: the gate then saw
      // "already used" with no attempt stored. The database trigger consumes the
      // grant when the row is accepted; the caller confirms it afterwards with
      // markQuizGrantUsed().
      const grantedId = access.approvedRequest?.id || null
      const stored = { ...attempt, id: attempt.id || uid('qa') }
      commit((prev) => ({
        ...prev,
        quizAttempts: [...prev.quizAttempts, stored],
        quizSessions: sessionId ? (prev.quizSessions || []).filter((s) => s.id !== sessionId) : prev.quizSessions || [],
      }))
      return { ok: true, attempt: stored, grantId: grantedId }
    },
    [commit],
  )

  // Called only after the attempt row is confirmed saved, so the trainee's own
  // view stops offering the attempt they just used. The database trigger has
  // already consumed the grant at this point — this keeps the client in step.
  const markQuizGrantUsed = useCallback(
    (requestId) => {
      if (!requestId) return
      commit((prev) => ({
        ...prev,
        quizRequests: (prev.quizRequests || []).map((r) =>
          r.id === requestId
            ? {
                ...r,
                attemptsUsed: Math.min(
                  Number(r.attemptsGranted ?? 1),
                  Number(r.attemptsUsed || 0) + 1,
                ),
              }
            : r,
        ),
      }))
    },
    [commit],
  )

  // Exam attempts are also schedule-guarded. Exams keep their existing retake
  // behaviour, but nothing can be submitted outside the trainer's window.
  const recordExamAttempt = useCallback(
    (attempt) => {
      const d = dbRef.current
      const program = d.programs.find((p) => p.id === attempt.programId)
      const exam = program?.exams?.find((e) => e.id === attempt.examId)
      if (!exam) return { ok: false, error: 'Exam not found.' }

      const window = quizWindow(exam, new Date(attempt.startedAt || Date.now()))
      if (!window.scheduled) return { ok: false, error: 'Your trainer has not scheduled this exam yet.' }
      if (window.beforeStart) return { ok: false, error: 'This exam is not open yet.' }
      if (window.afterDeadline) return { ok: false, error: 'The exam deadline has passed.' }

      const stored = { ...attempt, id: attempt.id || uid('ea') }
      commit((prev) => ({ ...prev, examAttempts: [...prev.examAttempts, stored] }))
      return { ok: true, attempt: stored }
    },
    [commit],
  )

  // Trainees submit a result (new row); trainers then evaluate that same row,
  // which arrives here with its id and is updated in place.
  //
  // A VA trainee gets exactly one attempt: a second row is only accepted when
  // the trainer approved a retake, which is consumed here in the same commit.
  const recordTypingTest = useCallback(
    (test) => {
      const updating = Boolean(test?.id)
      if (!updating) {
        const access = getTypingAccess({
          tests: typingTestsOf(dbRef.current, test.traineeId, test.programId),
          requests: typingRequestsOf(dbRef.current, test.traineeId, test.programId),
        })
        if (!access.canStart) {
          return {
            ok: false,
            error: 'You already took the typing test. Request a retake from your trainer.',
          }
        }
      }
      commit((d) => {
        if (updating) {
          return {
            ...d,
            typingTests: d.typingTests.map((t) => (t.id === test.id ? { ...t, ...test, id: t.id } : t)),
          }
        }
        const grant = typingRequestsOf(d, test.traineeId, test.programId).find(unusedTypingGrant)
        return {
          ...d,
          typingTests: [
            ...d.typingTests,
            { ...test, evaluated: false, evaluatedAt: null, evaluatedBy: null, id: uid('typing') },
          ],
          typingRequests: grant
            ? (d.typingRequests || []).map((r) =>
                r.id === grant.id
                  ? {
                      ...r,
                      attemptsUsed: Number(r.attemptsUsed || 0) + 1,
                      consumedAt: new Date().toISOString(),
                    }
                  : r,
              )
            : d.typingRequests || [],
        }
      })
      toast(updating ? 'Remarks saved.' : 'Typing test result submitted.')
      return { ok: true }
    },
    [commit, toast],
  )

  // Trainer evaluation of one result. Saving remarks is what unlocks the
  // trainee's "Request Retake" button.
  const evaluateTypingTest = useCallback(
    (testId, remarks = '') => {
      if (!user) return { ok: false, error: 'Sign in to evaluate.' }
      const d = dbRef.current
      const test = d.typingTests.find((t) => t.id === testId)
      if (!test) return { ok: false, error: 'Typing test not found.' }
      const assigned = (d.trainerPrograms || []).some(
        (tp) => tp.trainerId === user.id && tp.programId === test.programId && tp.status !== 'revoked',
      )
      if (user.role !== 'admin' && test.trainerId !== user.id && !assigned) {
        return { ok: false, error: 'You can only evaluate your own trainees.' }
      }
      commit((prev) => ({
        ...prev,
        typingTests: prev.typingTests.map((t) =>
          t.id === testId
            ? {
                ...t,
                remarks,
                evaluated: true,
                evaluatedAt: new Date().toISOString(),
                evaluatedBy: user.id,
              }
            : t,
        ),
      }))
      toast('Evaluation saved.')
      return { ok: true }
    },
    [commit, toast, user],
  )

  // Trainee asks for another attempt. Only available once the current result
  // has been evaluated; pending requests grant nothing.
  const requestTypingRetake = useCallback(
    ({ programId = 'virtual-assistant' } = {}) => {
      if (!user) return { ok: false, error: 'Sign in to request a retake.' }
      const d = dbRef.current
      const tests = typingTestsOf(d, user.id, programId)
      const requests = typingRequestsOf(d, user.id, programId)
      const access = getTypingAccess({ tests, requests })
      if (!tests.length) return { ok: false, error: 'Take the typing test first.' }
      if (!access.evaluated) {
        return { ok: false, error: 'Wait for your trainer to evaluate your result first.' }
      }
      if (access.pendingRequest) return { ok: false, error: 'You already have a pending retake request.' }
      if (access.approvedRequest) {
        return { ok: false, error: 'Your retake is already approved — you can take the test now.' }
      }

      const latest = access.latest
      const enrollment = d.enrollments.find((e) => e.traineeId === user.id && e.programId === programId)
      const request = {
        id: uid('tqr'),
        traineeId: user.id,
        traineeName: user.name,
        programId,
        trainerId: latest.trainerId || enrollmentTrainerId(d, enrollment) || null,
        testId: latest.id,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        decidedAt: null,
        decidedBy: null,
        decidedByName: null,
        note: '',
        attemptsGranted: 0,
        attemptsUsed: 0,
        consumedAt: null,
      }
      commit((prev) => ({ ...prev, typingRequests: [...(prev.typingRequests || []), request] }))
      toast('Retake request sent to your trainer.', 'success')
      return { ok: true, request }
    },
    [commit, toast, user],
  )

  // Trainer (or Super Admin) decision. Approving grants exactly one attempt.
  const decideTypingRequest = useCallback(
    (requestId, decision, note = '') => {
      if (!user) return { ok: false, error: 'Not signed in.' }
      const d = dbRef.current
      const request = (d.typingRequests || []).find((r) => r.id === requestId)
      if (!request) return { ok: false, error: 'Request not found.' }
      if (request.status !== 'pending') return { ok: false, error: 'This request has already been decided.' }

      const program = d.programs.find((p) => p.id === request.programId)
      const assigned = (d.trainerPrograms || []).some(
        (tp) => tp.trainerId === user.id && tp.programId === request.programId && tp.status !== 'revoked',
      )
      if (user.role !== 'admin' && request.trainerId !== user.id && program?.trainerId !== user.id && !assigned) {
        return { ok: false, error: 'You can only decide requests for your own trainees.' }
      }

      const approved = decision === 'approved'
      commit((prev) => ({
        ...prev,
        typingRequests: (prev.typingRequests || []).map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: approved ? 'approved' : 'rejected',
                decidedAt: new Date().toISOString(),
                decidedBy: user.id,
                decidedByName: user.name,
                note: note || '',
                attemptsGranted: approved ? 1 : 0,
                attemptsUsed: 0,
                consumedAt: null,
              }
            : r,
        ),
      }))
      toast(
        approved ? 'Retake approved — the trainee can take the typing test again.' : 'Retake request rejected.',
        approved ? 'success' : 'info',
      )
      return { ok: true }
    },
    [commit, toast, user],
  )

  // ------------------------------ Attendance --------------------------------
  const saveAttendance = useCallback(
    (record) => {
      commit((d) => {
        const existing = d.attendance.find(
          (a) => a.traineeId === record.traineeId && a.scheduleId === record.scheduleId,
        )
        if (existing) {
          return {
            ...d,
            attendance: d.attendance.map((a) => (a.id === existing.id ? { ...a, ...record, id: existing.id } : a)),
          }
        }
        return { ...d, attendance: [...d.attendance, { ...record, id: uid('att') }] }
      })
      toast('Attendance saved.')
    },
    [commit, toast],
  )

  const bulkSaveAttendance = useCallback(
    (records) => {
      commit((d) => {
        const attendance = [...d.attendance]
        records.forEach((record) => {
          const idx = attendance.findIndex(
            (a) => a.traineeId === record.traineeId && a.scheduleId === record.scheduleId,
          )
          if (idx >= 0) attendance[idx] = { ...attendance[idx], ...record }
          else attendance.push({ ...record, id: uid('att') })
        })
        return { ...d, attendance }
      })
      toast('Attendance records saved.')
    },
    [commit, toast],
  )

  // ------------------------------- Schedules --------------------------------
  const saveSchedule = useCallback(
    (payload) => {
      commit((d) => {
        if (payload.id && d.schedules.some((s) => s.id === payload.id)) {
          return { ...d, schedules: d.schedules.map((s) => (s.id === payload.id ? { ...s, ...payload } : s)) }
        }
        return { ...d, schedules: [...d.schedules, { ...payload, id: payload.id || uid('sch') }] }
      })
      toast(payload.id ? 'Schedule updated.' : 'Schedule created.')
    },
    [commit, toast],
  )

  const deleteSchedule = useCallback(
    (id) => {
      commit((d) => ({ ...d, schedules: d.schedules.filter((s) => s.id !== id) }))
      toast('Schedule deleted.', 'info')
    },
    [commit, toast],
  )

  // ----------------------------- Announcements ------------------------------
  const saveAnnouncement = useCallback(
    (payload) => {
      commit((d) => {
        if (payload.id && d.announcements.some((a) => a.id === payload.id)) {
          return { ...d, announcements: d.announcements.map((a) => (a.id === payload.id ? { ...a, ...payload } : a)) }
        }
        return { ...d, announcements: [{ ...payload, id: payload.id || uid('ann') }, ...d.announcements] }
      })
      toast(payload.id ? 'Announcement updated.' : 'Announcement posted.')
    },
    [commit, toast],
  )

  const deleteAnnouncement = useCallback(
    (id) => {
      commit((d) => ({
        ...d,
        announcements: d.announcements.filter((a) => a.id !== id),
        announcementReads: (d.announcementReads || []).filter((r) => r.announcementId !== id),
      }))
      toast('Announcement deleted.', 'info')
    },
    [commit, toast],
  )

  // ------------------------- Announcement read state -------------------------
  // One row per (announcement, user). The bell badge counts visible
  // announcements that have no row for the signed-in user.
  const markAnnouncementsRead = useCallback(
    (ids = []) => {
      if (!user?.id || !ids.length) return
      commit((d) => {
        const reads = d.announcementReads || []
        const have = new Set(reads.filter((r) => r.userId === user.id).map((r) => r.announcementId))
        const missing = ids.filter((id) => id && !have.has(id))
        if (!missing.length) return d
        const now = new Date().toISOString()
        return {
          ...d,
          announcementReads: [
            ...reads,
            ...missing.map((announcementId) => ({
              id: uid('ar'),
              announcementId,
              userId: user.id,
              readAt: now,
            })),
          ],
        }
      })
    },
    [commit, user?.id],
  )

  const markAnnouncementRead = useCallback((id) => markAnnouncementsRead([id]), [markAnnouncementsRead])

  // ------------------------------ Evaluations -------------------------------
  const saveEvaluation = useCallback(
    (payload) => {
      commit((d) => {
        // Update by id only: a trainer may evaluate the same trainee once per
        // period (mid-term, final, ...), so matching on trainee + program would
        // overwrite the previous period.
        const existing = payload.id ? d.evaluations.find((e) => e.id === payload.id) : null
        if (existing) {
          return {
            ...d,
            evaluations: d.evaluations.map((e) => (e.id === existing.id ? { ...e, ...payload, id: existing.id } : e)),
          }
        }
        return { ...d, evaluations: [...d.evaluations, { ...payload, id: uid('eval') }] }
      })
      toast('Evaluation saved.')
    },
    [commit, toast],
  )

  // Trainer ratings are written by the submit_trainer_feedback() RPC only
  // (migration 054/055); the client has no direct write path.

  // ------------------------------- Settings ---------------------------------
  // Persist first, then apply: the page must not report "Settings saved" when
  // the server refused the write.
  const updateSettings = useCallback(
    async (patch) => {
      const next = { ...settingsRef.current, ...patch }
      if (isSupabaseConfigured) {
        try {
          await backend.saveSettings(next)
        } catch (e) {
          console.error(e)
          toast(`Failed to save settings: ${e?.message || e}`, 'error')
          return { ok: false, error: e?.message || String(e) }
        }
      }
      settingsRef.current = next
      setSettings(next)
      toast('Settings saved.')
      return { ok: true }
    },
    [toast],
  )

  const resetData = useCallback(async () => {
    if (isSupabaseConfigured) {
      // Never wipe the shared database — reload the latest server state instead.
      try {
        const { db: loaded } = await backend.loadAll()
        dbRef.current = loaded
        setDb(loaded)
        toast('Data reloaded from the server.', 'info')
      } catch (e) {
        console.error(e)
        toast('Failed to reload data.', 'error')
      }
      return
    }
    const seed = buildSeed()
    dbRef.current = seed
    setDb(seed)
    toast('All data has been reset to defaults.', 'info')
  }, [toast])

  const value = useMemo(
    () => ({
      db,
      user,
      settings,
      toasts,
      ready,
      isSupabaseConfigured,
      toast,
      dismissToast,
      flushSync,
      retrySaveRow,
      // auth
      mfaPending,
      mustSetPassword,
      login,
      completeMfa,
      logout,
      updateProfile,
      changePassword,
      // users
      saveUser,
      createTrainer,
      updateTrainer,
      createTrainee,
      updateTrainee,
      deleteUser,
      registerTrainee,
      // programs
      saveProgram,
      addProgram,
      deleteProgram,
      saveLesson,
      deleteLesson,
      saveQuiz,
      deleteQuiz,
      saveExam,
      deleteExam,
      // enrollment
      createEnrollment,
      setEnrollmentStatus,
      verifyEnrollmentRequirement,
      resubmitEnrollmentRequirement,
      updatePayment,
      recordPayment,
      // progress
      toggleLessonComplete,
      // assessments
      recordQuizAttempt,
      markQuizGrantUsed,
      startQuizAttempt,
      requestQuizAccess,
      decideQuizRequest,
      recordExamAttempt,
      recordTypingTest,
      evaluateTypingTest,
      requestTypingRetake,
      decideTypingRequest,
      // attendance
      saveAttendance,
      bulkSaveAttendance,
      // schedules
      saveSchedule,
      deleteSchedule,
      // announcements
      saveAnnouncement,
      deleteAnnouncement,
      markAnnouncementRead,
      markAnnouncementsRead,
      // evaluations
      saveEvaluation,
      // trainer ratings
      // settings
      updateSettings,
      resetData,
    }),
    [
      db,
      user,
      settings,
      toasts,
      ready,
      toast,
      dismissToast,
      flushSync,
      retrySaveRow,
      mfaPending,
      mustSetPassword,
      login,
      completeMfa,
      logout,
      updateProfile,
      changePassword,
      saveUser,
      createTrainer,
      updateTrainer,
      createTrainee,
      updateTrainee,
      deleteUser,
      registerTrainee,
      saveProgram,
      addProgram,
      deleteProgram,
      saveLesson,
      deleteLesson,
      saveQuiz,
      deleteQuiz,
      saveExam,
      deleteExam,
      createEnrollment,
      setEnrollmentStatus,
      verifyEnrollmentRequirement,
      resubmitEnrollmentRequirement,
      updatePayment,
      recordPayment,
      toggleLessonComplete,
      recordQuizAttempt,
      markQuizGrantUsed,
      startQuizAttempt,
      requestQuizAccess,
      decideQuizRequest,
      recordExamAttempt,
      recordTypingTest,
      evaluateTypingTest,
      requestTypingRetake,
      decideTypingRequest,
      saveAttendance,
      bulkSaveAttendance,
      saveSchedule,
      deleteSchedule,
      saveAnnouncement,
      deleteAnnouncement,
      saveEvaluation,
      updateSettings,
      resetData,
    ],
  )

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          <p className="text-sm text-slate-500">Loading your data…</p>
        </div>
      </div>
    )
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export default AppContext
