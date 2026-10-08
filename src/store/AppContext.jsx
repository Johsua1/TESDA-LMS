import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buildSeed } from '../data/seed'
import { setLivePrograms } from '../data/programs'
import { uid } from '../lib/utils'
import { isSupabaseConfigured } from '../lib/supabase'
import * as backend from '../lib/backend'

const DB_KEY = 'tesda-lms-db-v2'
const SESSION_KEY = 'tesda-lms-session-v1'
const SETTINGS_KEY = 'tesda-lms-settings-v1'

const DEFAULT_SETTINGS = {
  institution: 'TESDA Training Center',
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
  examAttempts: [],
  typingTests: [],
  evaluations: [],
  announcements: [],
}

const AppContext = createContext(null)

// Offline (demo) mode: the whole db lives in localStorage.
function loadLocalDB() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
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
    const raw = localStorage.getItem(SESSION_KEY)
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

  // Keep a synchronous mirror of db so mutations can compute the next state and
  // persist it without relying on the async setState updater.
  const dbRef = useRef(db)
  const settingsRef = useRef(settings)

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
    (updater) => {
      const prev = dbRef.current
      const next = typeof updater === 'function' ? updater(prev) : updater
      dbRef.current = next
      setDb(next)
      if (isSupabaseConfigured) {
        backend.syncCollections(prev, next).catch((e) => {
          console.error('Failed to sync to Supabase', e)
          toast('Failed to save to the server. Check your connection.', 'error')
        })
      }
      return next
    },
    [toast],
  )

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
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
      else localStorage.removeItem(SESSION_KEY)
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
  const loadRemoteData = useCallback(async () => {
    const { db: loaded, settings: loadedSettings } = await backend.loadAll()
    dbRef.current = loaded
    setDb(loaded)
    if (loadedSettings) {
      const merged = { ...DEFAULT_SETTINGS, ...loadedSettings }
      settingsRef.current = merged
      setSettings(merged)
    }
  }, [])

  const login = useCallback(
    async (email, password) => {
      if (isSupabaseConfigured) {
        try {
          const res = await backend.signIn(email, password)
          if (!res.ok) return res
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

  const logout = useCallback(() => {
    if (isSupabaseConfigured) {
      backend.signOut().catch(() => {})
      dbRef.current = EMPTY_DB
      setDb(EMPTY_DB)
    }
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    (patch) => {
      const nextUser = { ...user, ...patch }
      commit((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) }))
      setUser(nextUser)
      if (isSupabaseConfigured) {
        backend.upsertProfile(nextUser).catch((e) => {
          console.error(e)
          toast('Failed to update your profile.', 'error')
        })
      }
      toast('Profile updated successfully.')
    },
    [user, commit, toast],
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

  const deleteUser = useCallback(
    (id) => {
      if (isSupabaseConfigured) {
        backend
          .deleteProfile(id)
          .then(() => {
            dbRef.current = { ...dbRef.current, users: dbRef.current.users.filter((u) => u.id !== id) }
            setDb(dbRef.current)
            toast('Record deleted.', 'info')
          })
          .catch((e) => {
            console.error(e)
            toast('Failed to delete the account.', 'error')
          })
        return
      }
      commit((d) => ({ ...d, users: d.users.filter((u) => u.id !== id) }))
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
          return { ...p, quizzes }
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
        programs: d.programs.map((p) => (p.id === programId ? { ...p, quizzes: p.quizzes.filter((q) => q.id !== quizId) } : p)),
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
    (payload) => {
      const id = uid('enr')
      commit((d) => ({ ...d, enrollments: [...d.enrollments, { ...payload, id, progress: payload.progress || {} }] }))
      toast('Enrollment submitted successfully.')
      return id
    },
    [commit, toast],
  )

  const updateEnrollment = useCallback(
    (id, patch) => {
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [commit],
  )

  const setEnrollmentStatus = useCallback(
    (id, status) => {
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) =>
          e.id === id ? { ...e, status, certificateIssued: status === 'Completed' ? true : e.certificateIssued } : e,
        ),
      }))
      toast(`Enrollment marked as ${status}.`)
    },
    [commit, toast],
  )

  const updatePayment = useCallback(
    (enrollmentId, payment) => {
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => (e.id === enrollmentId ? { ...e, payment: { ...e.payment, ...payment } } : e)),
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
              transactions: [...(e.payment?.transactions || []), tx],
            },
          }
        }),
      }))
      if (ok) toast('Payment recorded successfully.')
      return ok
    },
    [commit, toast],
  )

  const cancelEnrollment = useCallback(
    (id) => {
      setEnrollmentStatus(id, 'Cancelled')
    },
    [setEnrollmentStatus],
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

  const setLessonComplete = useCallback(
    (traineeId, programId, lessonId, complete = true) => {
      commit((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => {
          if (e.traineeId !== traineeId || e.programId !== programId) return e
          const progress = { ...e.progress }
          if (complete) progress[lessonId] = true
          else delete progress[lessonId]
          return { ...e, progress }
        }),
      }))
    },
    [commit],
  )

  // ----------------------------- Quiz attempts ------------------------------
  const recordQuizAttempt = useCallback(
    (attempt) => {
      commit((d) => ({ ...d, quizAttempts: [...d.quizAttempts, { ...attempt, id: uid('qa') }] }))
    },
    [commit],
  )

  const recordExamAttempt = useCallback(
    (attempt) => {
      commit((d) => ({ ...d, examAttempts: [...d.examAttempts, { ...attempt, id: uid('ea') }] }))
    },
    [commit],
  )

  const recordTypingTest = useCallback(
    (test) => {
      commit((d) => ({ ...d, typingTests: [...d.typingTests, { ...test, id: uid('typing') }] }))
      toast('Typing test result submitted.')
    },
    [commit, toast],
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
      commit((d) => ({ ...d, announcements: d.announcements.filter((a) => a.id !== id) }))
      toast('Announcement deleted.', 'info')
    },
    [commit, toast],
  )

  // ------------------------------ Evaluations -------------------------------
  const saveEvaluation = useCallback(
    (payload) => {
      commit((d) => {
        const existing = d.evaluations.find(
          (e) => e.traineeId === payload.traineeId && e.programId === payload.programId,
        )
        if (existing) {
          return { ...d, evaluations: d.evaluations.map((e) => (e.id === existing.id ? { ...e, ...payload } : e)) }
        }
        return { ...d, evaluations: [...d.evaluations, { ...payload, id: uid('eval') }] }
      })
      toast('Evaluation saved.')
    },
    [commit, toast],
  )

  // ------------------------------- Settings ---------------------------------
  const updateSettings = useCallback(
    (patch) => {
      const next = { ...settingsRef.current, ...patch }
      settingsRef.current = next
      setSettings(next)
      if (isSupabaseConfigured) {
        backend.saveSettings(next).catch((e) => {
          console.error(e)
          toast('Failed to save settings.', 'error')
        })
      }
      toast('Settings saved.')
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
      // auth
      login,
      logout,
      updateProfile,
      // users
      saveUser,
      deleteUser,
      registerTrainee,
      // programs
      saveProgram,
      saveLesson,
      deleteLesson,
      saveQuiz,
      deleteQuiz,
      saveExam,
      deleteExam,
      // enrollment
      createEnrollment,
      updateEnrollment,
      setEnrollmentStatus,
      updatePayment,
      recordPayment,
      cancelEnrollment,
      // progress
      toggleLessonComplete,
      setLessonComplete,
      // assessments
      recordQuizAttempt,
      recordExamAttempt,
      recordTypingTest,
      // attendance
      saveAttendance,
      bulkSaveAttendance,
      // schedules
      saveSchedule,
      deleteSchedule,
      // announcements
      saveAnnouncement,
      deleteAnnouncement,
      // evaluations
      saveEvaluation,
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
      login,
      logout,
      updateProfile,
      saveUser,
      deleteUser,
      registerTrainee,
      saveProgram,
      saveLesson,
      deleteLesson,
      saveQuiz,
      deleteQuiz,
      saveExam,
      deleteExam,
      createEnrollment,
      updateEnrollment,
      setEnrollmentStatus,
      updatePayment,
      recordPayment,
      cancelEnrollment,
      toggleLessonComplete,
      setLessonComplete,
      recordQuizAttempt,
      recordExamAttempt,
      recordTypingTest,
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
