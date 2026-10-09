import { useState } from 'react'
import { Award, TrendingUp, ClipboardList, FileCheck2, Keyboard, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { useApp } from '../../store/AppContext'
import {
  activeEnrollmentsOf,
  traineeQuizAttempts,
  traineeExamAttempts,
  traineeTypingTests,
  courseGrade,
  programById,
} from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, StatCard, Tabs, ProgressBar, EmptyState, Badge } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate } from '../../lib/utils'

export function Grades() {
  const { db, user } = useApp()
  const enrollments = activeEnrollmentsOf(db, user.id)
  const [tab, setTab] = useState(enrollments[0]?.programId || '')

  if (!enrollments.length) {
    return (
      <div>
        <PageHeader title="Grades & Scores" description="Your assessment results across all enrolled programs." />
        <Card>
          <EmptyState icon={Award} title="No grades yet" description="Enroll in a program and complete assessments to see your grades here." />
        </Card>
      </div>
    )
  }

  const programId = tab || enrollments[0].programId
  const program = programById(programId)
  const quizzes = traineeQuizAttempts(db, user.id, programId)
  const exams = traineeExamAttempts(db, user.id, programId)
  const typing = programId === 'virtual-assistant' ? traineeTypingTests(db, user.id) : []
  const grade = courseGrade(db, user.id, programId)

  const bestByQuiz = Object.values(
    quizzes.reduce((acc, a) => {
      if (!acc[a.quizId] || acc[a.quizId].percentage < a.percentage) acc[a.quizId] = a
      return acc
    }, {}),
  )

  const chartData = [
    ...bestByQuiz.map((q) => ({ name: q.quizTitle.replace(/ Quiz$/, ''), score: q.percentage, type: 'quiz' })),
    ...exams.map((e) => ({ name: 'Exam', score: e.percentage, type: 'exam' })),
  ].slice(0, 8)

  const quizCols = [
    { key: 'quizTitle', header: 'Quiz', render: (r) => <span className="font-medium text-slate-700">{r.quizTitle}</span> },
    { key: 'score', header: 'Score', render: (r) => `${r.score}/${r.total}`, sortable: true },
    { key: 'percentage', header: 'Percentage', sortable: true, render: (r) => <span className="font-semibold">{r.percentage}%</span> },
    { key: 'date', header: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'passed', header: 'Result', render: (r) => <StatusBadge status={r.passed ? 'Passed' : 'Failed'} /> },
  ]

  const examCols = [
    { key: 'examTitle', header: 'Exam', render: (r) => <span className="font-medium text-slate-700">{r.examTitle}</span> },
    { key: 'score', header: 'Score', render: (r) => `${r.score}/${r.total}`, sortable: true },
    { key: 'percentage', header: 'Percentage', sortable: true, render: (r) => <span className="font-semibold">{r.percentage}%</span> },
    { key: 'date', header: 'Date Completed', sortable: true, render: (r) => formatDate(r.date) },
    { key: 'passed', header: 'Result', render: (r) => <StatusBadge status={r.passed ? 'Passed' : 'Failed'} /> },
  ]

  const typingCols = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'wpm', header: 'WPM', sortable: true },
    { key: 'accuracy', header: 'Accuracy', render: (r) => `${r.accuracy}%` },
    { key: 'score', header: 'Score', sortable: true, render: (r) => <span className="font-semibold">{r.score}%</span> },
    { key: 'passed', header: 'Result', render: (r) => <StatusBadge status={r.passed ? 'Passed' : 'Failed'} /> },
  ]

  return (
    <div>
      <PageHeader title="Grades & Scores" description="Review your quiz, exam and typing test results per program." />

      <div className="mb-5">
        <Tabs
          tabs={enrollments.map((e) => ({ key: e.programId, label: programById(e.programId)?.title || e.programId }))}
          value={programId}
          onChange={setTab}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall Grade" value={`${grade}%`} icon={Award} tone={grade >= 75 ? 'success' : 'warning'} hint="Average of all assessments" />
        <StatCard label="Quizzes Taken" value={quizzes.length} icon={ClipboardList} tone="brand" />
        <StatCard label="Exams Taken" value={exams.length} icon={FileCheck2} tone="purple" />
        <StatCard
          label={programId === 'virtual-assistant' ? 'Typing Tests' : 'Passing Rate'}
          value={programId === 'virtual-assistant' ? typing.length : `${quizzes.length ? Math.round((quizzes.filter((q) => q.passed).length / quizzes.length) * 100) : 0}%`}
          icon={programId === 'virtual-assistant' ? Keyboard : TrendingUp}
          tone="info"
        />
      </div>

      {chartData.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Performance Overview" subtitle={program?.title} icon={BarChart3} />
          <CardBody>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-12} textAnchor="end" height={56} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Score']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.score >= 75 ? '#10b981' : d.score >= 50 ? '#3b91f6' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> 75%+</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand-500" /> 50–74%</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-warm-500" /> Below 50%</span>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Quiz Results" icon={ClipboardList} action={<Badge tone="brand">{quizzes.length}</Badge>} />
          <DataTable columns={quizCols} data={quizzes} pageSize={5} emptyState={<EmptyState icon={ClipboardList} title="No quiz attempts" />} />
        </Card>
        <Card>
          <CardHeader title="Exam Results" icon={FileCheck2} action={<Badge tone="purple">{exams.length}</Badge>} />
          <DataTable columns={examCols} data={exams} pageSize={5} emptyState={<EmptyState icon={FileCheck2} title="No exam attempts" />} />
        </Card>
      </div>

      {programId === 'virtual-assistant' && (
        <Card className="mt-6">
          <CardHeader title="Typing Test Results" subtitle="Passing requirement: 40%" icon={Keyboard} action={<Badge tone="warning">{typing.length}</Badge>} />
          <DataTable columns={typingCols} data={typing} pageSize={5} emptyState={<EmptyState icon={Keyboard} title="No typing tests yet" />} />
        </Card>
      )}
    </div>
  )
}

export default Grades
