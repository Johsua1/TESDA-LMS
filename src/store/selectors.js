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

// A trainee may only open course content once their enrollment is approved.
export const hasCourseAccess = (enrollment) =>
  !!enrollment && ['Approved', 'Enrolled', 'Completed'].includes(enrollment.status)

export const courseProgress = (enrollment, programId) => {
  const total = programLessonCount(programId)
  const completed = enrollment ? Object.keys(enrollment.progress || {}).length : 0
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 }
}

// A trainer's assigned programs. Three sources are unioned so a course shows up
// however the assignment was made:
//   1. `trainer_programs` — the authoritative many-to-many table (loaded into
//      db.trainerPrograms); this is what RLS and the Super Admin assignment UI
//      actually write.
//   2. the trainer profile's `programs` array (legacy display field, kept in
//      sync by createTrainer/updateTrainer).
//   3. the program-side `trainerId` link (courses assigned from Manage Courses).
export const trainerPrograms = (db, trainerId) => {
  const trainer = db.users.find((u) => u.id === trainerId)
  const ids = new Set(Array.isArray(trainer?.programs) ? trainer.programs : [])
  for (const tp of db.trainerPrograms || []) {
    if (tp.trainerId === trainerId && tp.status !== 'revoked') ids.add(tp.programId)
  }
  return db.programs.filter((p) => ids.has(p.id) || p.trainerId === trainerId)
}

// Trainers qualified to handle a program (assigned to it). Used to populate the
// admin's trainer picker when assigning a trainee.
export const programTrainers = (db, programId) =>
  db.users.filter((u) => u.role === 'trainer' && trainerPrograms(db, u.id).some((p) => p.id === programId))

// Which trainer handles a given enrollment. The admin-set `enrollment.trainerId`
// wins; otherwise fall back to the program's sole assigned trainer, then its
// legacy `trainerId`. With several trainers and no explicit assignment it is
// ambiguous, so it returns null until the admin assigns one.
export const enrollmentTrainerId = (db, enrollment) => {
  if (!enrollment) return null
  if (enrollment.trainerId) return enrollment.trainerId
  const assigned = (db.trainerPrograms || []).filter(
    (tp) => tp.programId === enrollment.programId && tp.status !== 'revoked',
  )
  if (assigned.length === 1) return assigned[0].trainerId
  const program = (db.programs || []).find((p) => p.id === enrollment.programId)
  return program?.trainerId || null
}

// A trainer's trainees: everyone whose enrollment is assigned to them. This is
// the admin-set link (enrollment.trainerId), NOT merely "everyone in my
// programs" — several trainers may share one program with different students.
export const trainerTrainees = (db, trainerId) => {
  const map = new Map()
  db.enrollments.forEach((e) => {
    if (enrollmentTrainerId(db, e) !== trainerId) return
    if (!map.has(e.traineeId)) map.set(e.traineeId, [])
    map.get(e.traineeId).push(e)
  })
  return [...map.entries()].map(([traineeId, enrollments]) => ({
    trainee: db.users.find((u) => u.id === traineeId),
    enrollments,
  })).filter((x) => x.trainee)
}

// A trainer's enrollments, optionally limited to one program.
export const trainerEnrollments = (db, trainerId, programId) =>
  db.enrollments.filter(
    (e) => enrollmentTrainerId(db, e) === trainerId && (!programId || e.programId === programId),
  )

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

// Trainee -> trainer ratings. `trainerRatings` is the db collection key, so the
// selector names are distinct. A trainer's rating is the average of the stars
// their trainees submitted.
export const trainerRatingsFor = (db, trainerId) =>
  (db.trainerRatings || []).filter((r) => r.trainerId === trainerId)

export const trainerRatingSummary = (db, trainerId) => {
  const list = trainerRatingsFor(db, trainerId)
  const count = list.length
  const average = count ? list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count : 0
  return { count, average }
}

export const traineeTrainerRating = (db, traineeId, trainerId) =>
  (db.trainerRatings || []).find((r) => r.traineeId === traineeId && r.trainerId === trainerId)

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

// Payment transaction history for an enrollment. Older records predate the
// transactions array, so synthesize a single entry from the base payment.
export const paymentTransactions = (enrollment) => {
  const payment = enrollment?.payment
  if (!payment) return []
  if (payment.transactions?.length) {
    return [...payment.transactions].sort((a, b) => new Date(b.date) - new Date(a.date))
  }
  if (payment.amountPaid > 0) {
    return [
      {
        id: `${enrollment.id}-opening`,
        amount: payment.amountPaid,
        method: payment.method || 'Over-the-counter',
        referenceNo: payment.referenceNo || '—',
        date: payment.paymentDate,
        note: payment.note || null,
      },
    ]
  }
  return []
}

// Self-pay enrollments with an outstanding balance the trainee can settle.
export const outstandingPayments = (db, traineeId) =>
  enrollmentsOf(db, traineeId).filter(
    (e) => e.type === 'self-pay' && (e.payment?.balance || 0) > 0 && !['Cancelled', 'Rejected'].includes(e.status),
  )

export { programById, programLessons, programLessonCount, programQuizCount, toISODate }
