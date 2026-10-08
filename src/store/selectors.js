// ---------------------------------------------------------------------------
// Derived data selectors
// ---------------------------------------------------------------------------
import { programById, programLessons, programLessonCount, programQuizCount } from '../data/programs'
import { startOfDay, toISODate, average } from '../lib/utils'

export const enrollmentsOf = (db, traineeId) => db.enrollments.filter((e) => e.traineeId === traineeId)

export const enrollmentOf = (db, traineeId, programId) =>
  db.enrollments.find((e) => e.traineeId === traineeId && e.programId === programId)

export const activeEnrollmentsOf = (db, traineeId) =>
  enrollmentsOf(db, traineeId).filter((e) => ['Enrolled', 'Approved', 'Completed'].includes(e.status))

export const courseProgress = (enrollment, programId) => {
  const total = programLessonCount(programId)
  const completed = enrollment ? Object.keys(enrollment.progress || {}).length : 0
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 }
}

export const trainerPrograms = (db, trainerId) =>
  db.programs.filter((p) => p.trainerId === trainerId)

export const trainerTrainees = (db, trainerId) => {
  const programIds = trainerPrograms(db, trainerId).map((p) => p.id)
  const map = new Map()
  db.enrollments.forEach((e) => {
    if (programIds.includes(e.programId)) {
      if (!map.has(e.traineeId)) map.set(e.traineeId, [])
      map.get(e.traineeId).push(e)
    }
  })
  return [...map.entries()].map(([traineeId, enrollments]) => ({
    trainee: db.users.find((u) => u.id === traineeId),
    enrollments,
  })).filter((x) => x.trainee)
}

export const attendanceStats = (db, traineeId, programId) => {
  let records = db.attendance.filter((a) => a.traineeId === traineeId)
  if (programId) records = records.filter((a) => a.programId === programId)
  const present = records.filter((a) => a.status === 'Present').length
  const late = records.filter((a) => a.status === 'Late').length
  const absent = records.filter((a) => a.status === 'Absent').length
  const excused = records.filter((a) => a.status === 'Excused').length
  const total = records.length
  const rate = total ? Math.round(((present + late) / total) * 100) : 0
  return { present, late, absent, excused, total, rate, records }
}

export const upcomingSessions = (db, programIds, limit = 5) => {
  const today = startOfDay()
  return db.schedules
    .filter((s) => programIds.includes(s.programId) && new Date(s.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, limit)
}

export const pastSessions = (db, programIds, limit = 5) => {
  const today = startOfDay()
  return db.schedules
    .filter((s) => programIds.includes(s.programId) && new Date(s.date) < today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
}

export const traineeQuizAttempts = (db, traineeId, programId) => {
  let list = db.quizAttempts.filter((a) => a.traineeId === traineeId)
  if (programId) list = list.filter((a) => a.programId === programId)
  return list.sort((a, b) => new Date(b.date) - new Date(a.date))
}

export const traineeExamAttempts = (db, traineeId, programId) => {
  let list = db.examAttempts.filter((a) => a.traineeId === traineeId)
  if (programId) list = list.filter((a) => a.programId === programId)
  return list.sort((a, b) => new Date(b.date) - new Date(a.date))
}

export const traineeTypingTests = (db, traineeId) =>
  db.typingTests.filter((t) => t.traineeId === traineeId).sort((a, b) => new Date(b.date) - new Date(a.date))

export const trainerTypingTests = (db, trainerId) =>
  db.typingTests.filter((t) => t.trainerId === trainerId).sort((a, b) => new Date(b.date) - new Date(a.date))

export const traineeEvaluations = (db, traineeId) =>
  db.evaluations.filter((e) => e.traineeId === traineeId)

export const trainerEvaluations = (db, trainerId) =>
  db.evaluations.filter((e) => e.trainerId === trainerId)

export const announcementsFor = (db, user) => {
  if (!user) return []
  return db.announcements
    .filter((a) => {
      if (a.audience === 'all') return true
      if (a.audience === 'trainer') return user.role === 'trainer'
      if (a.audience === 'trainee') {
        if (user.role !== 'trainee') return false
        if (!a.programId) return true
        return (user.enrolledPrograms || []).includes(a.programId)
      }
      return true
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.date) - new Date(a.date)
    })
}

export const overallProgress = (db, traineeId) => {
  const enrs = activeEnrollmentsOf(db, traineeId)
  if (!enrs.length) return 0
  const percents = enrs.map((e) => courseProgress(e, e.programId).percent)
  return Math.round(average(percents))
}

export const courseGrade = (db, traineeId, programId) => {
  const quizzes = traineeQuizAttempts(db, traineeId, programId)
  const exams = traineeExamAttempts(db, traineeId, programId)
  const scores = [...quizzes.map((q) => q.percentage), ...exams.map((e) => e.percentage)]
  return scores.length ? Math.round(average(scores)) : 0
}

export const programStats = (db, programId) => {
  const enrs = db.enrollments.filter((e) => e.programId === programId)
  const enrolled = enrs.filter((e) => ['Enrolled', 'Approved'].includes(e.status)).length
  const completed = enrs.filter((e) => e.status === 'Completed').length
  const pending = enrs.filter((e) => ['Pending', 'Under Review'].includes(e.status)).length
  return { total: enrs.length, enrolled, completed, pending }
}

export const revenueStats = (db) => {
  const paid = db.enrollments.reduce((sum, e) => sum + (e.payment?.amountPaid || 0), 0)
  const billed = db.enrollments.reduce((sum, e) => sum + (e.payment?.fee || 0), 0)
  const balance = billed - paid
  return { paid, billed, balance, collection: billed ? Math.round((paid / billed) * 100) : 0 }
}

export const nextScheduleFor = (db, programId) => {
  const today = startOfDay()
  return db.schedules
    .filter((s) => s.programId === programId && new Date(s.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
}

export { programById, programLessons, programLessonCount, programQuizCount, toISODate }
