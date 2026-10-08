import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { buildSeed } from '../data/seed'
import { setLivePrograms } from '../data/programs'
import { uid } from '../lib/utils'

const DB_KEY = 'tesda-lms-db-v2'
const SESSION_KEY = 'tesda-lms-session-v1'

const AppContext = createContext(null)

function loadDB() {
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

export function AppProvider({ children }) {
  const [db, setDb] = useState(loadDB)

  // Keep the pure program/lesson helpers in data/programs.js in sync with the
  // persisted store so trainer/admin content edits are visible everywhere.
  setLivePrograms(db.programs)
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [toasts, setToasts] = useState([])

  // persist db
  useEffect(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db))
    } catch (e) {
      console.warn('Failed to persist LMS data.', e)
    }
  }, [db])

  // persist session
  useEffect(() => {
    try {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [user])

  // ------------------------------- Toasts -----------------------------------
  const toast = useCallback((message, type = 'success', title) => {
    const id = uid('toast')
    setToasts((t) => [...t, { id, message, type, title }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // -------------------------------- Auth ------------------------------------
  const login = useCallback(
    (email, password) => {
      const found = db.users.find(
        (u) => u.email.toLowerCase() === String(email).toLowerCase().trim() && u.password === password,
      )
      if (!found) return { ok: false, error: 'Invalid email or password.' }
      setUser(found)
      return { ok: true, user: found }
    },
    [db.users],
  )

  const logout = useCallback(() => setUser(null), [])

  const updateProfile = useCallback(
    (patch) => {
      setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) }))
      setUser((u) => ({ ...u, ...patch }))
      toast('Profile updated successfully.')
    },
    [user, toast],
  )

  // ------------------------------ Users (admin) -----------------------------
  const saveUser = useCallback(
    (payload) => {
      setDb((d) => {
        if (payload.id && d.users.some((u) => u.id === payload.id)) {
          return { ...d, users: d.users.map((u) => (u.id === payload.id ? { ...u, ...payload } : u)) }
        }
        const id = payload.id || uid(payload.role === 'trainer' ? 'tr' : payload.role === 'trainee' ? 'tn' : 'sa')
        return { ...d, users: [...d.users, { ...payload, id }] }
      })
      toast(payload.id ? 'Record updated.' : 'Record created.')
    },
    [toast],
  )

  const deleteUser = useCallback(
    (id) => {
      setDb((d) => ({ ...d, users: d.users.filter((u) => u.id !== id) }))
      toast('Record deleted.', 'info')
    },
    [toast],
  )

  // Public self-registration — always creates a TRAINEE account.
  const registerTrainee = useCallback(
    (payload) => {
      const email = String(payload.email || '').trim().toLowerCase()
      if (db.users.some((u) => u.email.toLowerCase() === email)) {
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
        phone: payload.phone || '',
        address: payload.address || '',
        birthDate: payload.birthDate || null,
        gender: payload.gender || '',
        education: payload.education || '',
        emergencyContact: payload.emergencyContact || '',
        enrolledPrograms: [],
        since: new Date().toISOString().slice(0, 10),
      }
      setDb((d) => ({ ...d, users: [...d.users, account] }))
      return { ok: true, user: account }
    },
    [db.users],
  )

  // ------------------------------ Programs ----------------------------------
  const saveProgram = useCallback(
    (id, patch) => {
      setDb((d) => ({ ...d, programs: d.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
      toast('Course updated.')
    },
    [toast],
  )

  // --------------------------- Program content ------------------------------
  // Lessons live nested in competencies (Basic/Common) or competency units (Core).
  const saveLesson = useCallback(
    (programId, { competencyId, unitId, lesson }) => {
      setDb((d) => ({
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
    [toast],
  )

  const deleteLesson = useCallback(
    (programId, lessonId) => {
      setDb((d) => ({
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
    [toast],
  )

  const saveQuiz = useCallback(
    (programId, quiz) => {
      setDb((d) => ({
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
    [toast],
  )

  const deleteQuiz = useCallback(
    (programId, quizId) => {
      setDb((d) => ({
        ...d,
        programs: d.programs.map((p) => (p.id === programId ? { ...p, quizzes: p.quizzes.filter((q) => q.id !== quizId) } : p)),
      }))
      toast('Quiz deleted.', 'info')
    },
    [toast],
  )

  const saveExam = useCallback(
    (programId, exam) => {
      setDb((d) => ({
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
    [toast],
  )

  const deleteExam = useCallback(
    (programId, examId) => {
      setDb((d) => ({
        ...d,
        programs: d.programs.map((p) => (p.id === programId ? { ...p, exams: p.exams.filter((e) => e.id !== examId) } : p)),
      }))
      toast('Exam deleted.', 'info')
    },
    [toast],
  )

  // ---------------------------- Enrollments ---------------------------------
  const createEnrollment = useCallback(
    (payload) => {
      const id = uid('enr')
      setDb((d) => ({ ...d, enrollments: [...d.enrollments, { ...payload, id, progress: payload.progress || {} }] }))
      toast('Enrollment submitted successfully.')
      return id
    },
    [toast],
  )

  const updateEnrollment = useCallback(
    (id, patch) => {
      setDb((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [],
  )

  const setEnrollmentStatus = useCallback(
    (id, status) => {
      setDb((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) =>
          e.id === id ? { ...e, status, certificateIssued: status === 'Completed' ? true : e.certificateIssued } : e,
        ),
      }))
      toast(`Enrollment marked as ${status}.`)
    },
    [toast],
  )

  const updatePayment = useCallback(
    (enrollmentId, payment) => {
      setDb((d) => ({
        ...d,
        enrollments: d.enrollments.map((e) => (e.id === enrollmentId ? { ...e, payment: { ...e.payment, ...payment } } : e)),
      }))
      toast('Payment record updated.')
    },
    [toast],
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
      setDb((d) => ({
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
    [toast],
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
      setDb((d) => ({
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
    [],
  )

  const setLessonComplete = useCallback(
    (traineeId, programId, lessonId, complete = true) => {
      setDb((d) => ({
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
    [],
  )

  // ----------------------------- Quiz attempts ------------------------------
  const recordQuizAttempt = useCallback(
    (attempt) => {
      setDb((d) => ({ ...d, quizAttempts: [...d.quizAttempts, { ...attempt, id: uid('qa') }] }))
    },
    [],
  )

  const recordExamAttempt = useCallback(
    (attempt) => {
      setDb((d) => ({ ...d, examAttempts: [...d.examAttempts, { ...attempt, id: uid('ea') }] }))
    },
    [],
  )

  const recordTypingTest = useCallback(
    (test) => {
      setDb((d) => ({ ...d, typingTests: [...d.typingTests, { ...test, id: uid('typing') }] }))
      toast('Typing test result submitted.')
    },
    [toast],
  )

  // ------------------------------ Attendance --------------------------------
  const saveAttendance = useCallback(
    (record) => {
      setDb((d) => {
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
    [toast],
  )

  const bulkSaveAttendance = useCallback(
    (records) => {
      setDb((d) => {
        let attendance = [...d.attendance]
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
    [toast],
  )

  // ------------------------------- Schedules --------------------------------
  const saveSchedule = useCallback(
    (payload) => {
      setDb((d) => {
        if (payload.id && d.schedules.some((s) => s.id === payload.id)) {
          return { ...d, schedules: d.schedules.map((s) => (s.id === payload.id ? { ...s, ...payload } : s)) }
        }
        return { ...d, schedules: [...d.schedules, { ...payload, id: payload.id || uid('sch') }] }
      })
      toast(payload.id ? 'Schedule updated.' : 'Schedule created.')
    },
    [toast],
  )

  const deleteSchedule = useCallback(
    (id) => {
      setDb((d) => ({ ...d, schedules: d.schedules.filter((s) => s.id !== id) }))
      toast('Schedule deleted.', 'info')
    },
    [toast],
  )

  // ----------------------------- Announcements ------------------------------
  const saveAnnouncement = useCallback(
    (payload) => {
      setDb((d) => {
        if (payload.id && d.announcements.some((a) => a.id === payload.id)) {
          return { ...d, announcements: d.announcements.map((a) => (a.id === payload.id ? { ...a, ...payload } : a)) }
        }
        return { ...d, announcements: [{ ...payload, id: payload.id || uid('ann') }, ...d.announcements] }
      })
      toast(payload.id ? 'Announcement updated.' : 'Announcement posted.')
    },
    [toast],
  )

  const deleteAnnouncement = useCallback(
    (id) => {
      setDb((d) => ({ ...d, announcements: d.announcements.filter((a) => a.id !== id) }))
      toast('Announcement deleted.', 'info')
    },
    [toast],
  )

  // ------------------------------ Evaluations -------------------------------
  const saveEvaluation = useCallback(
    (payload) => {
      setDb((d) => {
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
    [toast],
  )

  // ------------------------------- Settings ---------------------------------
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('tesda-lms-settings-v1')
      return raw
        ? JSON.parse(raw)
        : {
            institution: 'TESDA Training Center',
            academicYear: '2026 - 2027',
            passingScore: 75,
            typingPassingRate: 40,
            attendanceRequirement: 80,
            allowSelfEnroll: true,
            maintenanceMode: false,
            notifyEmail: true,
          }
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('tesda-lms-settings-v1', JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings])

  const updateSettings = useCallback(
    (patch) => {
      setSettings((s) => ({ ...s, ...patch }))
      toast('Settings saved.')
    },
    [toast],
  )

  const resetData = useCallback(() => {
    const seed = buildSeed()
    setDb(seed)
    toast('All data has been reset to defaults.', 'info')
  }, [toast])

  const value = useMemo(
    () => ({
      db,
      user,
      settings,
      toasts,
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

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export default AppContext
