import { Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastContainer } from './components/ui/Toasts'

// Auth / misc
import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'
import { ResetPassword } from './pages/ResetPassword'
import { NotFound } from './pages/NotFound'

// Trainee
import { TraineeDashboard } from './pages/trainee/TraineeDashboard'
import { MyCourses } from './pages/trainee/MyCourses'
import { CourseDetail } from './pages/trainee/CourseDetail'
import { LessonView } from './pages/trainee/LessonView'
import { QuizRunner } from './pages/trainee/QuizRunner'
import { ExamRunner } from './pages/trainee/ExamRunner'
import { ClassSchedules } from './pages/trainee/ClassSchedules'
import { TraineeAttendance } from './pages/trainee/TraineeAttendance'
import { Grades } from './pages/trainee/Grades'
import { Enrollment } from './pages/trainee/Enrollment'
import { Payments } from './pages/trainee/Payments'
import { TypingTest } from './pages/trainee/TypingTest'
import { RateTrainer } from './pages/trainee/RateTrainer'

// Trainer
import { TrainerDashboard } from './pages/trainer/TrainerDashboard'
import { TrainerCourses } from './pages/trainer/TrainerCourses'
import { TrainerCourseDetail } from './pages/trainer/TrainerCourseDetail'
import { TrainerTrainees } from './pages/trainer/TrainerTrainees'
import { TrainerLessons } from './pages/trainer/TrainerLessons'
import { TrainerQuizzes } from './pages/trainer/TrainerQuizzes'
import { TrainerExams } from './pages/trainer/TrainerExams'
import { TrainerSchedules } from './pages/trainer/TrainerSchedules'
import { TrainerAttendance } from './pages/trainer/TrainerAttendance'
import { TrainerEvaluations } from './pages/trainer/TrainerEvaluations'
import { TrainerTypingTests } from './pages/trainer/TrainerTypingTests'
import { TrainerProgress } from './pages/trainer/TrainerProgress'

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { ManageTrainees } from './pages/admin/ManageTrainees'
import { ManageTrainers } from './pages/admin/ManageTrainers'
import { ManageCourses } from './pages/admin/ManageCourses'
import { ManageCompetencies } from './pages/admin/ManageCompetencies'
import { ManageLessons } from './pages/admin/ManageLessons'
import { ManageQuizzes } from './pages/admin/ManageQuizzes'
import { ManageExams } from './pages/admin/ManageExams'
import { ManageSchedules } from './pages/admin/ManageSchedules'
import { ManageEnrollments } from './pages/admin/ManageEnrollments'
import { ManageAttendance } from './pages/admin/ManageAttendance'
import { Accounting } from './pages/admin/Accounting'
import { Reports } from './pages/admin/Reports'
import { Settings } from './pages/admin/Settings'

// Shared
import { AnnouncementsPage } from './pages/shared/AnnouncementsPage'
import { ProfilePage } from './pages/shared/ProfilePage'
import { MeetRoom } from './pages/shared/MeetRoom'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ------------------- IN-APP MEETING ROOM (full screen) ------------------- */}
        <Route
          path="/trainee/meet/:scheduleId"
          element={
            <ProtectedRoute allow={['trainee']}>
              <MeetRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trainer/meet/:scheduleId"
          element={
            <ProtectedRoute allow={['trainer']}>
              <MeetRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/meet/:scheduleId"
          element={
            <ProtectedRoute allow={['admin']}>
              <MeetRoom />
            </ProtectedRoute>
          }
        />

        {/* ----------------------------- TRAINEE ----------------------------- */}
        <Route
          element={
            <ProtectedRoute allow={['trainee']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/trainee" element={<TraineeDashboard />} />
          <Route path="/trainee/courses" element={<MyCourses />} />
          <Route path="/trainee/courses/:programId" element={<CourseDetail />} />
          <Route path="/trainee/courses/:programId/lesson/:lessonId" element={<LessonView />} />
          <Route path="/trainee/courses/:programId/quiz/:quizId" element={<QuizRunner />} />
          <Route path="/trainee/courses/:programId/exam/:examId" element={<ExamRunner />} />
          <Route path="/trainee/schedules" element={<ClassSchedules />} />
          <Route path="/trainee/attendance" element={<TraineeAttendance />} />
          <Route path="/trainee/grades" element={<Grades />} />
          <Route path="/trainee/enrollment" element={<Enrollment />} />
          <Route path="/trainee/payments" element={<Payments />} />
          <Route path="/trainee/typing-test" element={<TypingTest />} />
          <Route path="/trainee/ratings" element={<RateTrainer />} />
          <Route path="/trainee/announcements" element={<AnnouncementsPage />} />
          <Route path="/trainee/profile" element={<ProfilePage />} />
        </Route>

        {/* ----------------------------- TRAINER ----------------------------- */}
        <Route
          element={
            <ProtectedRoute allow={['trainer']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/trainer" element={<TrainerDashboard />} />
          <Route path="/trainer/courses" element={<TrainerCourses />} />
          <Route path="/trainer/courses/:programId" element={<TrainerCourseDetail />} />
          <Route path="/trainer/trainees" element={<TrainerTrainees />} />
          <Route path="/trainer/lessons" element={<TrainerLessons />} />
          <Route path="/trainer/quizzes" element={<TrainerQuizzes />} />
          <Route path="/trainer/exams" element={<TrainerExams />} />
          <Route path="/trainer/schedules" element={<TrainerSchedules />} />
          <Route path="/trainer/attendance" element={<TrainerAttendance />} />
          <Route path="/trainer/evaluations" element={<TrainerEvaluations />} />
          <Route path="/trainer/typing-tests" element={<TrainerTypingTests />} />
          <Route path="/trainer/progress" element={<TrainerProgress />} />
          <Route path="/trainer/announcements" element={<AnnouncementsPage canManage />} />
          <Route path="/trainer/profile" element={<ProfilePage />} />
        </Route>

        {/* ------------------------------ ADMIN ------------------------------ */}
        <Route
          element={
            <ProtectedRoute allow={['admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/trainees" element={<ManageTrainees />} />
          <Route path="/admin/trainers" element={<ManageTrainers />} />
          <Route path="/admin/courses" element={<ManageCourses />} />
          <Route path="/admin/competencies" element={<ManageCompetencies />} />
          <Route path="/admin/lessons" element={<ManageLessons />} />
          <Route path="/admin/quizzes" element={<ManageQuizzes />} />
          <Route path="/admin/exams" element={<ManageExams />} />
          <Route path="/admin/schedules" element={<ManageSchedules />} />
          <Route path="/admin/enrollments" element={<ManageEnrollments />} />
          <Route path="/admin/attendance" element={<ManageAttendance />} />
          <Route path="/admin/accounting" element={<Accounting />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/announcements" element={<AnnouncementsPage canManage />} />
          <Route path="/admin/settings" element={<Settings />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      <ToastContainer />
    </>
  )
}
