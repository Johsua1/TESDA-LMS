import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  FileText,
  ClipboardList,
  FileCheck2,
  CalendarDays,
  CalendarCheck,
  UserPlus,
  Wallet,
  BarChart3,
  Megaphone,
  Settings,
  Target,
  LineChart,
  Keyboard,
  Award,
  UserCircle,
} from 'lucide-react'

// Route to the in-app meeting room for a given role + schedule
export const meetPath = (role, scheduleId) => {
  const base = role === 'admin' ? 'admin' : role === 'trainer' ? 'trainer' : 'trainee'
  return `/${base}/meet/${scheduleId}`
}

export const roleMeta = {
  admin: {
    label: 'Super Admin',
    home: '/admin',
    accent: 'from-tesda-blue to-brand-800',
    badge: 'bg-tesda-blue',
  },
  trainer: {
    label: 'Trainer',
    home: '/trainer',
    accent: 'from-emerald-600 to-teal-700',
    badge: 'bg-emerald-600',
  },
  trainee: {
    label: 'Trainee',
    home: '/trainee',
    accent: 'from-brand-600 to-indigo-700',
    badge: 'bg-brand-600',
  },
}

export const navConfig = {
  admin: [
    { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      group: 'People',
      items: [
        { to: '/admin/trainees', label: 'Trainees', icon: Users },
        { to: '/admin/trainers', label: 'Trainers', icon: GraduationCap },
      ],
    },
    {
      group: 'Curriculum',
      items: [
        { to: '/admin/courses', label: 'Courses', icon: BookOpen },
        { to: '/admin/competencies', label: 'Competencies', icon: Layers },
        { to: '/admin/lessons', label: 'Lessons', icon: FileText },
        { to: '/admin/quizzes', label: 'Quizzes', icon: ClipboardList },
        { to: '/admin/exams', label: 'Exams', icon: FileCheck2 },
      ],
    },
    {
      group: 'Operations',
      items: [
        { to: '/admin/enrollments', label: 'Enrollment', icon: UserPlus },
        { to: '/admin/schedules', label: 'Schedules', icon: CalendarDays },
        { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
        { to: '/admin/accounting', label: 'Accounting', icon: Wallet },
      ],
    },
    {
      group: 'Administration',
      items: [
        { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
        { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/admin/settings', label: 'System Settings', icon: Settings },
      ],
    },
  ],
  trainer: [
    { group: 'Overview', items: [{ to: '/trainer', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      group: 'Teaching',
      items: [
        { to: '/trainer/courses', label: 'My Courses', icon: BookOpen },
        { to: '/trainer/trainees', label: 'My Trainees', icon: Users },
        { to: '/trainer/lessons', label: 'Lessons', icon: FileText },
        { to: '/trainer/quizzes', label: 'Quizzes', icon: ClipboardList },
        { to: '/trainer/exams', label: 'Exams', icon: FileCheck2 },
      ],
    },
    {
      group: 'Operations',
      items: [
        { to: '/trainer/schedules', label: 'Schedules', icon: CalendarDays },
        { to: '/trainer/attendance', label: 'Attendance', icon: CalendarCheck },
        { to: '/trainer/evaluations', label: 'Student Evaluation', icon: Target },
        { to: '/trainer/typing-tests', label: 'Typing Test Evaluation', icon: Keyboard },
        { to: '/trainer/progress', label: 'Progress Monitoring', icon: LineChart },
      ],
    },
    {
      group: 'Communication',
      items: [{ to: '/trainer/announcements', label: 'Announcements', icon: Megaphone }],
    },
  ],
  trainee: [
    { group: 'Overview', items: [{ to: '/trainee', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      group: 'Learning',
      items: [
        { to: '/trainee/courses', label: 'My Courses', icon: BookOpen },
        { to: '/trainee/schedules', label: 'Class Schedules', icon: CalendarDays },
        { to: '/trainee/attendance', label: 'Attendance', icon: CalendarCheck },
        { to: '/trainee/grades', label: 'Grades & Scores', icon: Award },
      ],
    },
    {
      group: 'Account',
      items: [
        { to: '/trainee/enrollment', label: 'Enrollment', icon: UserPlus },
        { to: '/trainee/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/trainee/profile', label: 'Profile', icon: UserCircle },
      ],
    },
  ],
}

export default navConfig
