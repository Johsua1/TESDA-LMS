// ---------------------------------------------------------------------------
// TESDA LMS - Seed data generator
// Builds enrollments, schedules, attendance, quiz/exam attempts, typing tests,
// evaluations, announcements and payment records.
// Dates are generated relative to "today" so the demo always looks current.
// ---------------------------------------------------------------------------

import { programs, programLessons, programById } from './programs'
import { users, trainees, trainers } from './users'
import { addDays, toISODate, startOfDay, clamp } from '../lib/utils'

const CLASS_TYPES = ['Online', 'Face-to-Face', 'Hybrid']
const ROOMS = ['Room 101', 'Room 202', 'Computer Lab A', 'Training Kitchen', 'Spa Room', 'Function Hall', 'Room 305']
const MEET_LINKS = [
  'https://meet.google.com/hkp-mnop-qrs',
  'https://meet.google.com/bar-ista-xyz',
  'https://meet.google.com/hil-otm-assg',
  'https://meet.google.com/evt-mgmt-ncd',
  'https://meet.google.com/vaa-remt-wrk',
]

const AVATAR = 'from-brand-500 to-brand-700'

// ------------------------------- Schedules ----------------------------------
export function buildSchedules() {
  const list = []
  programs.forEach((p, pi) => {
    const lessons = programLessons(p.id)
    const start = addDays(startOfDay(), -18)
    lessons.forEach((l, i) => {
      const date = addDays(start, i * 2)
      const type = CLASS_TYPES[(i + pi) % 3]
      const startHour = 9 + ((i + pi) % 3) * 2
      const endHour = startHour + 2
      list.push({
        id: `sch-${p.id}-${i + 1}`,
        programId: p.id,
        competencyId: l.competencyId,
        competency: l.competency,
        unitTitle: l.unitTitle,
        lessonId: l.id,
        lessonTitle: l.title,
        trainerId: p.trainerId,
        date: toISODate(date),
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(endHour).padStart(2, '0')}:00`,
        classType: type,
        meetingLink: type === 'Face-to-Face' ? null : MEET_LINKS[pi % MEET_LINKS.length],
        room: ROOMS[(i + pi) % ROOMS.length],
        status: new Date(date) < startOfDay() ? 'Completed' : 'Upcoming',
      })
    })
  })
  return list.sort((a, b) => new Date(a.date) - new Date(b.date))
}

// ------------------------------ Enrollments ---------------------------------
// target completion ratio per trainee/program
const COMPLETION = {
  'tn-001': { housekeeping: 0.65, 'virtual-assistant': 0.3 },
  'tn-002': { barista: 0.45 },
  'tn-003': { hilot: 0.55 },
  'tn-004': { 'event-management': 0.4 },
  'tn-005': { housekeeping: 0.8 },
  'tn-006': { barista: 0.2, 'virtual-assistant': 0.15 },
  'tn-007': { 'virtual-assistant': 0.9 },
  'tn-008': { hilot: 0.35, 'event-management': 0.25 },
}

const ENROLL_STATUS = {
  'tn-001': { housekeeping: 'Enrolled', 'virtual-assistant': 'Enrolled' },
  'tn-002': { barista: 'Enrolled' },
  'tn-003': { hilot: 'Enrolled' },
  'tn-004': { 'event-management': 'Under Review' },
  'tn-005': { housekeeping: 'Completed' },
  'tn-006': { barista: 'Enrolled', 'virtual-assistant': 'Pending' },
  'tn-007': { 'virtual-assistant': 'Enrolled' },
  'tn-008': { hilot: 'Enrolled', 'event-management': 'Approved' },
}

const ENROLL_TYPE = {
  'tn-001': { housekeeping: 'scholarship', 'virtual-assistant': 'self-pay' },
  'tn-002': { barista: 'self-pay' },
  'tn-003': { hilot: 'scholarship' },
  'tn-004': { 'event-management': 'self-pay' },
  'tn-005': { housekeeping: 'scholarship' },
  'tn-006': { barista: 'self-pay', 'virtual-assistant': 'scholarship' },
  'tn-007': { 'virtual-assistant': 'scholarship' },
  'tn-008': { hilot: 'scholarship', 'event-management': 'self-pay' },
}

const VOUCHERS = [
  { name: 'TESDA Training for Work Scholarship Program (TWSP)', sponsor: 'TESDA' },
  { name: 'Special Training for Employment Program (STEP)', sponsor: 'TESDA' },
  { name: 'Universal Access to Quality Tertiary Education', sponsor: 'CHED / LGU' },
  { name: 'PESO Skills Training Voucher', sponsor: 'PESO Manila' },
]

function paymentFor(fee, type, idx) {
  if (type === 'scholarship') {
    return {
      fee: 0,
      status: 'Fully Paid',
      amountPaid: 0,
      balance: 0,
      paymentDate: toISODate(addDays(startOfDay(), -20 + idx)),
      referenceNo: null,
      note: 'Fully funded by scholarship/voucher',
    }
  }
  const patterns = [
    { status: 'Fully Paid', ratio: 1 },
    { status: 'Partially Paid', ratio: 0.5 },
    { status: 'Unpaid', ratio: 0 },
    { status: 'Partially Paid', ratio: 0.25 },
  ]
  const pat = patterns[idx % patterns.length]
  const amountPaid = Math.round(fee * pat.ratio)
  return {
    fee,
    status: pat.status,
    amountPaid,
    balance: fee - amountPaid,
    paymentDate: amountPaid > 0 ? toISODate(addDays(startOfDay(), -15 + idx)) : null,
    referenceNo: amountPaid > 0 ? `REF-${20260000 + idx * 137 + Math.round(fee / 10)}` : null,
    note: null,
  }
}

export function buildEnrollments() {
  const list = []
  let counter = 0
  trainees.forEach((t, ti) => {
    ;(t.enrolledPrograms || []).forEach((programId, pi) => {
      counter += 1
      const program = programById(programId)
      const lessons = programLessons(programId)
      const ratio = COMPLETION[t.id]?.[programId] ?? 0
      const doneCount = Math.round(lessons.length * ratio)
      const progress = {}
      lessons.slice(0, doneCount).forEach((l) => {
        progress[l.id] = true
      })
      const type = ENROLL_TYPE[t.id]?.[programId] ?? 'self-pay'
      const status = ENROLL_STATUS[t.id]?.[programId] ?? 'Enrolled'
      const voucher = type === 'scholarship' ? VOUCHERS[(ti + pi) % VOUCHERS.length] : null
      list.push({
        id: `enr-${t.id}-${programId}`,
        traineeId: t.id,
        programId,
        type,
        status,
        appliedDate: toISODate(addDays(startOfDay(), -30 + ti * 2 + pi)),
        startDate: toISODate(addDays(startOfDay(), -18)),
        endDate: toISODate(addDays(startOfDay(), 42)),
        progress,
        voucher: voucher
          ? {
              ...voucher,
              number: `VCH-${2026}${String(counter).padStart(4, '0')}`,
              date: toISODate(addDays(startOfDay(), -28 + ti + pi)),
            }
          : null,
        payment: paymentFor(program?.fee ?? 0, type, counter),
        certificateIssued: status === 'Completed',
      })
    })
  })
  return list
}

// ------------------------------- Attendance ---------------------------------
export function buildAttendance(schedules, enrollments) {
  const list = []
  let n = 0
  enrollments.forEach((enr) => {
    if (enr.status === 'Pending' || enr.status === 'Under Review') return
    const pastSessions = schedules.filter(
      (s) => s.programId === enr.programId && new Date(s.date) < startOfDay(),
    )
    pastSessions.forEach((s, i) => {
      n += 1
      const roll = (i + n) % 10
      let status = 'Present'
      if (roll === 3) status = 'Late'
      else if (roll === 7) status = 'Absent'
      else if (roll === 9) status = 'Excused'
      const timeIn = status === 'Absent' ? null : status === 'Late' ? s.startTime.replace(/^(\d)/, (m) => m) : s.startTime
      const lateIn = status === 'Late'
      list.push({
        id: `att-${enr.traineeId}-${s.id}`,
        traineeId: enr.traineeId,
        programId: enr.programId,
        scheduleId: s.id,
        lessonTitle: s.lessonTitle,
        trainerId: s.trainerId,
        date: s.date,
        timeIn: status === 'Absent' || status === 'Excused' ? null : timeIn,
        timeOut: status === 'Absent' || status === 'Excused' ? null : s.endTime,
        status,
        late: lateIn,
        remark:
          status === 'Excused' ? 'With valid excuse letter' : status === 'Absent' ? 'No excuse' : '',
      })
    })
  })
  return list
}

// --------------------------- Quiz / Exam attempts ---------------------------
function answersFor(quiz, seed, correctRatio) {
  return quiz.questions.map((q, i) => {
    const wantCorrect = (i + seed) % 10 < Math.round(correctRatio * 10)
    let given = q.answer
    if (!wantCorrect) {
      if (q.type === 'tf') given = !q.answer
      else if (q.type === 'mcq') given = q.options.find((o) => o !== q.answer) ?? q.answer
      else given = 'wrong-answer'
    }
    return { questionId: q.id, given, correct: given === q.answer }
  })
}

export function buildQuizAttempts(enrollments) {
  const list = []
  enrollments.forEach((enr, ei) => {
    const program = programById(enr.programId)
    if (!program) return
    const lessons = programLessons(enr.programId)
    const doneLessons = lessons.filter((l) => enr.progress[l.id])
    const quizIds = [...new Set(doneLessons.map((l) => l.quizId).filter(Boolean))]
    quizIds.forEach((quizId, qi) => {
      const quiz = program.quizzes.find((q) => q.id === quizId)
      if (!quiz) return
      const ratio = clamp(0.6 + ((ei + qi) % 5) * 0.1, 0, 1)
      const answers = answersFor(quiz, ei + qi, ratio)
      const score = answers.filter((a) => a.correct).length
      const total = quiz.questions.length
      const percentage = Math.round((score / total) * 100)
      list.push({
        id: `qa-${enr.traineeId}-${quizId}`,
        traineeId: enr.traineeId,
        programId: enr.programId,
        quizId,
        quizTitle: quiz.title,
        score,
        total,
        percentage,
        passed: percentage >= quiz.passing,
        date: toISODate(addDays(startOfDay(), -16 + qi * 3 + ei)),
        answers,
      })
    })
  })
  return list
}

export function buildExamAttempts(enrollments) {
  const list = []
  enrollments.forEach((enr, ei) => {
    const program = programById(enr.programId)
    if (!program) return
    const lessons = programLessons(enr.programId)
    const ratio = lessons.length ? Object.keys(enr.progress).length / lessons.length : 0
    // only completed / advanced enrollments have an exam attempt
    if (ratio < 0.85 && enr.status !== 'Completed') return
    const exam = program.exams[0]
    const score = clamp(Math.round(exam.questionCount * (0.7 + (ei % 4) * 0.05)), 0, exam.questionCount)
    const percentage = Math.round((score / exam.questionCount) * 100)
    list.push({
      id: `ea-${enr.traineeId}-${exam.id}`,
      traineeId: enr.traineeId,
      programId: enr.programId,
      examId: exam.id,
      examTitle: exam.title,
      score,
      total: exam.questionCount,
      percentage,
      passed: percentage >= exam.passing,
      date: toISODate(addDays(startOfDay(), -5 + ei)),
    })
  })
  return list
}

// ------------------------------ Typing tests --------------------------------
export function buildTypingTests() {
  const vaTrainees = trainees.filter((t) => (t.enrolledPrograms || []).includes('virtual-assistant'))
  const presets = [
    { wpm: 25, accuracy: 88, errors: 18, totalWords: 150, correctWords: 132 },
    { wpm: 14, accuracy: 82, errors: 27, totalWords: 150, correctWords: 123 },
    { wpm: 55, accuracy: 98, errors: 3, totalWords: 150, correctWords: 147 },
    { wpm: 33, accuracy: 91, errors: 13, totalWords: 150, correctWords: 137 },
  ]
  return vaTrainees.map((t, i) => {
    const p = presets[i % presets.length]
    const duration = 3 // minutes
    const incorrectWords = p.totalWords - p.correctWords
    // score = (WPM / 40) * accuracy, capped at 100 (matches the live typing test)
    const score = Math.round((p.wpm / 40) * p.accuracy)
    const scorePct = clamp(score, 0, 100)
    return {
      id: `typing-${t.id}`,
      traineeId: t.id,
      programId: 'virtual-assistant',
      trainerId: 'tr-005',
      wpm: p.wpm,
      accuracy: p.accuracy,
      errors: p.errors,
      totalWords: p.totalWords,
      correctWords: p.correctWords,
      incorrectWords,
      duration,
      score: scorePct,
      passed: scorePct >= 40, // passing requirement is 40%
      date: toISODate(addDays(startOfDay(), -7 + i)),
      remarks: scorePct >= 40 ? 'Meets minimum typing requirement.' : 'Needs more practice. Retake required.',
    }
  })
}

// ------------------------------ Evaluations ---------------------------------
export function buildEvaluations(enrollments) {
  const list = []
  enrollments.forEach((enr, i) => {
    if (enr.status === 'Pending') return
    const program = programById(enr.programId)
    const rating = 3 + ((i % 3) + 1) // 4..6
    const scores = {
      workAttitude: clamp(rating, 1, 5),
      attendance: clamp(rating, 1, 5),
      skills: clamp(rating - (i % 2), 1, 5),
      safety: clamp(rating, 1, 5),
      teamwork: clamp(rating - (i % 2 === 0 ? 0 : 1), 1, 5),
    }
    const overall = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 5) * 20) / 20
    list.push({
      id: `eval-${enr.id}`,
      traineeId: enr.traineeId,
      trainerId: program?.trainerId,
      programId: enr.programId,
      period: 'Mid-Term Evaluation',
      scores,
      overall,
      remarks: overall >= 4.5 ? 'Excellent performance and attitude.' : overall >= 3.5 ? 'Satisfactory progress.' : 'Needs improvement.',
      date: toISODate(addDays(startOfDay(), -10 + i)),
    })
  })
  return list
}

// --------------------------- Trainer ratings --------------------------------
// Trainee -> trainer ratings (5 stars + optional comment). One row per
// (trainee, trainer), so dedupe by that pair.
export function buildTrainerRatings(enrollments) {
  const seen = new Set()
  const list = []
  enrollments.forEach((enr, i) => {
    if (enr.status === 'Pending' || enr.status === 'Under Review') return
    const trainerId = programById(enr.programId)?.trainerId
    const key = `${enr.traineeId}-${trainerId}`
    if (!trainerId || seen.has(key)) return
    seen.add(key)
    const rating = 3 + (i % 3) // 3..5
    list.push({
      id: `trr-${key}`,
      traineeId: enr.traineeId,
      trainerId,
      programId: enr.programId,
      rating,
      comment:
        rating >= 5
          ? 'Excellent trainer — very clear and helpful.'
          : rating >= 4
            ? 'Good sessions and well organized.'
            : 'Decent, but could improve the pacing.',
      date: toISODate(addDays(startOfDay(), -8 + i)),
    })
  })
  return list
}

// ----------------------------- Announcements --------------------------------
export function buildAnnouncements() {
  const today = startOfDay()
  return [
    {
      id: 'ann-001',
      title: 'Enrollment for 2nd Batch is Now Open',
      body: 'Enrollment for the second batch of all NC II programs is now open. Interested applicants may submit their requirements at the registrar’s office or through the online enrollment form.',
      audience: 'all',
      programId: null,
      authorId: 'sa-001',
      date: toISODate(addDays(today, -2)),
      priority: 'high',
      pinned: true,
    },
    {
      id: 'ann-002',
      title: 'Housekeeping Practical Assessment Schedule',
      body: 'The practical assessment for Housekeeping NC II will be held next week. Please review your bed making and bathroom cleaning procedures. Bring your complete PPE.',
      audience: 'trainee',
      programId: 'housekeeping',
      authorId: 'tr-001',
      date: toISODate(addDays(today, -1)),
      priority: 'normal',
      pinned: false,
    },
    {
      id: 'ann-003',
      title: 'Virtual Assistant Typing Test Reminder',
      body: 'All VA trainees must complete the typing proficiency test this week. The minimum passing rate is 40%. Practice daily to improve your WPM and accuracy.',
      audience: 'trainee',
      programId: 'virtual-assistant',
      authorId: 'tr-005',
      date: toISODate(today),
      priority: 'high',
      pinned: true,
    },
    {
      id: 'ann-004',
      title: 'Faculty Meeting — Curriculum Review',
      body: 'All trainers are required to attend the curriculum review meeting on Friday at 3:00 PM in the conference room.',
      audience: 'trainer',
      programId: null,
      authorId: 'sa-001',
      date: toISODate(addDays(today, -3)),
      priority: 'normal',
      pinned: false,
    },
    {
      id: 'ann-005',
      title: 'Barista Laboratory Maintenance',
      body: 'The barista laboratory will be closed for espresso machine maintenance this Saturday. Online classes will proceed as scheduled.',
      audience: 'trainee',
      programId: 'barista',
      authorId: 'tr-002',
      date: toISODate(addDays(today, -4)),
      priority: 'normal',
      pinned: false,
    },
    {
      id: 'ann-006',
      title: 'System Maintenance Notice',
      body: 'The LMS will undergo scheduled maintenance this Sunday from 1:00 AM to 4:00 AM. Access may be intermittent during this period.',
      audience: 'all',
      programId: null,
      authorId: 'sa-001',
      date: toISODate(addDays(today, -6)),
      priority: 'low',
      pinned: false,
    },
  ]
}

// ------------------------------- Assembled ----------------------------------
export function buildSeed() {
  const schedules = buildSchedules()
  const enrollments = buildEnrollments()
  const attendance = buildAttendance(schedules, enrollments)
  const quizAttempts = buildQuizAttempts(enrollments)
  const examAttempts = buildExamAttempts(enrollments)
  const typingTests = buildTypingTests()
  const evaluations = buildEvaluations(enrollments)
  const trainerRatings = buildTrainerRatings(enrollments)
  const announcements = buildAnnouncements()

  return {
    users,
    programs,
    schedules,
    enrollments,
    attendance,
    quizAttempts,
    examAttempts,
    typingTests,
    evaluations,
    trainerRatings,
    announcements,
  }
}

export { AVATAR }
