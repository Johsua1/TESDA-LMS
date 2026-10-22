import { useEffect, useState } from 'react'
import {
  Save,
  Building2,
  Target,
  Bell,
  Shield,
  RefreshCw,
  Database,
  Cloud,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  FormField,
  FormRow,
  ConfirmDialog,
  Badge,
  Toggle,
} from '../../components/ui'
import { MfaSettings } from '../../components/MfaSettings'
import { normalizeSettings, validateSettings, INSTITUTION_MAX, ACADEMIC_YEAR_MAX } from '../../lib/settings'

// Numbers are held as strings while editing: storing them as numbers makes a
// cleared field collapse to 0 (Number('') === 0) and the admin cannot retype.
const toForm = (settings) => ({
  ...settings,
  institution: settings.institution ?? '',
  academicYear: settings.academicYear ?? '',
  passingScore: settings.passingScore === undefined || settings.passingScore === null ? '' : String(settings.passingScore),
  typingPassingRate:
    settings.typingPassingRate === undefined || settings.typingPassingRate === null
      ? ''
      : String(settings.typingPassingRate),
  attendanceRequirement:
    settings.attendanceRequirement === undefined || settings.attendanceRequirement === null
      ? ''
      : String(settings.attendanceRequirement),
})

export function Settings() {
  const { settings, updateSettings, resetData, toast, db, isSupabaseConfigured } = useApp()
  const [form, setForm] = useState(() => toForm(settings))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Keep the form in step with the store: a save from another tab, or the
  // reload after a reset, must not leave stale values on screen. Keyed on the
  // saved *content*, not the object, so the 60s background refresh (which
  // rebuilds the settings object) cannot wipe edits that are still unsaved.
  const savedKey = JSON.stringify(normalizeSettings(settings))
  useEffect(() => {
    setForm(toForm(settings))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey])

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const dirty = JSON.stringify(normalizeSettings(form)) !== savedKey

  const save = async () => {
    const check = validateSettings(form)
    if (!check.ok) {
      setErrors({ [check.field]: check.error })
      toast(check.error, 'error')
      return
    }
    setErrors({})
    setSaving(true)
    await updateSettings(normalizeSettings(form))
    setSaving(false)
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Configure institution details, assessment thresholds and system preferences."
        action={
          <Button icon={Save} onClick={save} disabled={!dirty} loading={saving}>
            Save Settings
          </Button>
        }
      />

      {dirty && (
        <p className="-mt-2 mb-4 flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> You have unsaved changes.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Institution Information" icon={Building2} />
            <CardBody className="space-y-4">
              <FormRow>
                <FormField
                  label="Institution Name"
                  required
                  error={errors.institution}
                  hint={`Shown on receipts and printed records. Up to ${INSTITUTION_MAX} characters.`}
                >
                  <Input
                    value={form.institution}
                    maxLength={INSTITUTION_MAX}
                    onChange={(e) => setField('institution', e.target.value)}
                    placeholder="e.g. HYT Global Institute"
                  />
                </FormField>
                <FormField
                  label="Academic Year"
                  required
                  error={errors.academicYear}
                  hint="Displayed alongside the institution name."
                >
                  <Input
                    value={form.academicYear}
                    maxLength={ACADEMIC_YEAR_MAX}
                    onChange={(e) => setField('academicYear', e.target.value)}
                    placeholder="e.g. 2026 - 2027"
                  />
                </FormField>
              </FormRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Assessment Thresholds" icon={Target} />
            <CardBody className="space-y-4">
              <FormRow cols={3}>
                <FormField
                  label="Default Passing Score (%)"
                  required
                  error={errors.passingScore}
                  hint="Pre-filled on new quizzes & exams"
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    value={form.passingScore}
                    onChange={(e) => setField('passingScore', e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Typing Test Passing Rate (%)"
                  required
                  error={errors.typingPassingRate}
                  hint="Virtual Assistant program"
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    value={form.typingPassingRate}
                    onChange={(e) => setField('typingPassingRate', e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Attendance Requirement (%)"
                  required
                  error={errors.attendanceRequirement}
                  hint="Minimum attendance to pass"
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    value={form.attendanceRequirement}
                    onChange={(e) => setField('attendanceRequirement', e.target.value)}
                  />
                </FormField>
              </FormRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="System Preferences" icon={Bell} />
            <CardBody className="space-y-1">
              {[
                {
                  key: 'allowSelfEnroll',
                  title: 'Allow online self-enrollment',
                  desc: 'Trainees can submit enrollment applications through the portal.',
                },
                {
                  key: 'notifyEmail',
                  title: 'Email notifications',
                  desc: 'Send account activation emails when a trainer or trainee is created.',
                },
                {
                  key: 'maintenanceMode',
                  title: 'Maintenance mode',
                  desc: 'Trainees and trainers see a maintenance notice. Super Admins keep access.',
                },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-3 py-3 transition hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-700">{opt.title}</span>
                    <span className="block text-xs text-slate-400">{opt.desc}</span>
                  </span>
                  <Toggle
                    checked={!!form[opt.key]}
                    onChange={(v) => setField(opt.key, v)}
                    aria-label={opt.title}
                  />
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
                <Badge tone={isSupabaseConfigured ? 'info' : 'neutral'}>
                  {isSupabaseConfigured ? 'Supabase (cloud)' : 'This browser'}
                </Badge>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Data Management" icon={Shield} />
            <CardBody className="space-y-3">
              <p className="text-xs text-slate-500">
                {isSupabaseConfigured
                  ? 'Records live in your Supabase project and are shared by every signed-in user. Reloading re-fetches the latest rows from the server.'
                  : 'All data is stored in this browser. Resetting restores the original demo dataset and discards any changes you have made.'}
              </p>
              <Button variant="danger" icon={RefreshCw} className="w-full" onClick={() => setConfirmReset(true)}>
                {isSupabaseConfigured ? 'Reload Data from Server' : 'Reset All Data'}
              </Button>
            </CardBody>
          </Card>

          <Card className="bg-brand-50/50">
            <CardBody className="flex items-start gap-3">
              <Cloud className="h-5 w-5 shrink-0 text-brand-600" />
              <p className="text-xs leading-relaxed text-slate-600">
                {isSupabaseConfigured
                  ? 'Records are stored in Supabase and synced across devices. Saved preferences apply to every user immediately.'
                  : 'This is an offline demonstration. No backend, database or payment gateway is used — all records are simulated and persisted in your browser.'}
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
          setForm(toForm(settings))
        }}
        title={isSupabaseConfigured ? 'Reload data from the server?' : 'Reset all data?'}
        message={
          isSupabaseConfigured
            ? 'This discards unsaved changes on this screen and re-fetches the latest records from the server. Nothing is deleted.'
            : 'This will permanently discard all changes and restore the original demo dataset. This action cannot be undone.'
        }
        confirmLabel={isSupabaseConfigured ? 'Reload Data' : 'Reset Data'}
        tone="danger"
      />
    </div>
  )
}

export default Settings
