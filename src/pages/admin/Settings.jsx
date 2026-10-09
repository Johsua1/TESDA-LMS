import { useState } from 'react'
import { Settings as SettingsIcon, Save, Building2, Target, Bell, Shield, RefreshCw, Database, Keyboard } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { PageHeader, Card, CardBody, CardHeader, Button, Input, Select, FormField, FormRow, ConfirmDialog, Badge } from '../../components/ui'
import { MfaSettings } from '../../components/MfaSettings'

export function Settings() {
  const { settings, updateSettings, resetData, toast, db } = useApp()
  const [form, setForm] = useState(settings)
  const [confirmReset, setConfirmReset] = useState(false)

  const save = () => {
    updateSettings(form)
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(settings)

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Configure institution details, assessment thresholds and system preferences."
        action={
          <Button icon={Save} onClick={save} disabled={!dirty}>
            Save Settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Institution Information" icon={Building2} />
            <CardBody className="space-y-4">
              <FormRow>
                <FormField label="Institution Name">
                  <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
                </FormField>
                <FormField label="Academic Year">
                  <Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
                </FormField>
              </FormRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Assessment Thresholds" icon={Target} />
            <CardBody className="space-y-4">
              <FormRow cols={3}>
                <FormField label="Default Passing Score (%)" hint="Applies to quizzes & exams">
                  <Input type="number" min="0" max="100" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} />
                </FormField>
                <FormField label="Typing Test Passing Rate (%)" hint="Virtual Assistant program">
                  <Input type="number" min="0" max="100" value={form.typingPassingRate} onChange={(e) => setForm({ ...form, typingPassingRate: Number(e.target.value) })} />
                </FormField>
                <FormField label="Attendance Requirement (%)">
                  <Input type="number" min="0" max="100" value={form.attendanceRequirement} onChange={(e) => setForm({ ...form, attendanceRequirement: Number(e.target.value) })} />
                </FormField>
              </FormRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="System Preferences" icon={Bell} />
            <CardBody className="space-y-1">
              {[
                { key: 'allowSelfEnroll', title: 'Allow online self-enrollment', desc: 'Trainees can submit enrollment applications through the portal.' },
                { key: 'notifyEmail', title: 'Email notifications', desc: 'Send email notifications for enrollment and assessment updates.' },
                { key: 'maintenanceMode', title: 'Maintenance mode', desc: 'Temporarily restrict access to the system for maintenance.' },
              ].map((opt) => (
                <label key={opt.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-3 py-3 transition hover:bg-brand-50">
                  <span>
                    <span className="block text-sm font-medium text-slate-700">{opt.title}</span>
                    <span className="block text-xs text-slate-400">{opt.desc}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!form[opt.key]}
                    onClick={() => setForm({ ...form, [opt.key]: !form[opt.key] })}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${form[opt.key] ? 'bg-brand-600' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form[opt.key] ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              ))}
            </CardBody>
          </Card>

          <MfaSettings />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="System Information" icon={Database} />
            <CardBody className="space-y-3 text-sm">
              {[
                { label: 'Users', value: db.users.length },
                { label: 'Trainees', value: db.users.filter((u) => u.role === 'trainee').length },
                { label: 'Trainers', value: db.users.filter((u) => u.role === 'trainer').length },
                { label: 'Programs', value: db.programs.length },
                { label: 'Enrollments', value: db.enrollments.length },
                { label: 'Attendance Records', value: db.attendance.length },
                { label: 'Quiz Attempts', value: db.quizAttempts.length },
                { label: 'Typing Tests', value: db.typingTests.length },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-semibold text-slate-700">{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-slate-500">Storage</span>
                <Badge tone="success">localStorage</Badge>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Data Management" icon={Shield} />
            <CardBody className="space-y-3">
              <p className="text-xs text-slate-500">
                All data is stored locally in your browser. Resetting will restore the original demo dataset and discard
                any changes you have made.
              </p>
              <Button variant="danger" icon={RefreshCw} className="w-full" onClick={() => setConfirmReset(true)}>
                Reset All Data
              </Button>
            </CardBody>
          </Card>

          <Card className="bg-brand-50/50">
            <CardBody className="flex items-start gap-3">
              <Keyboard className="h-5 w-5 shrink-0 text-brand-600" />
              <p className="text-xs leading-relaxed text-slate-500">
                This is a frontend-only demonstration. No backend, database or payment gateway is used — all records are
                simulated and persisted in your browser's localStorage.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetData()
          setForm(settings)
        }}
        title="Reset all data?"
        message="This will permanently discard all changes and restore the original demo dataset. This action cannot be undone."
        confirmLabel="Reset Data"
        tone="danger"
      />
    </div>
  )
}

export default Settings
