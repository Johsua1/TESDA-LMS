// ---------------------------------------------------------------------------
// Trainer feedback data layer (RPC wrappers)
// ---------------------------------------------------------------------------
// All writes go through SECURITY DEFINER functions: the trainee cannot choose
// the trainer, the completion check and the duplicate check are re-run on the
// server, and the Super Admin functions refuse to run without MFA (AAL2).
// ---------------------------------------------------------------------------
import { supabase, isSupabaseConfigured } from './supabase'

export const feedbackBackendAvailable = isSupabaseConfigured

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    const err = new Error(error.message || 'Request failed.')
    err.code = error.code
    throw err
  }
  return data
}

// Every enrollment of the signed-in trainee with its feedback status:
// { enrollment_id, program_id, program_title, trainer_id, trainer_name,
//   status: 'not_required' | 'pending' | 'submitted', eligible, completion, ... }
export async function fetchMyFeedbackStatus() {
  if (!feedbackBackendAvailable) return []
  const rows = await rpc('get_my_trainer_feedback_status')
  return Array.isArray(rows) ? rows : []
}

// The trainee's own submitted rows. RLS allows only the author (and a Super
// Admin at AAL2), so trainers receive zero rows here by design.
export async function fetchMyFeedbackRows() {
  if (!feedbackBackendAvailable) return []
  const { data, error } = await supabase
    .from('trainer_feedback')
    .select('*')
    .eq('is_submitted', true)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function submitTrainerFeedback({
  enrollmentId,
  feedbackText,
  learningExperience,
  trainerStrengths,
  areasForImprovement,
  recommendation,
  rating,
}) {
  return rpc('submit_trainer_feedback', {
    p_enrollment_id: enrollmentId,
    p_feedback_text: feedbackText,
    p_learning_experience: learningExperience || null,
    p_trainer_strengths: trainerStrengths || null,
    p_areas_for_improvement: areasForImprovement || null,
    p_recommendation: recommendation || null,
    p_rating: rating || null,
  })
}

export async function fetchAdminFeedbackPage(filters = {}, limit = 500, offset = 0) {
  const rows = await rpc('admin_trainer_feedback_page', {
    p_filters: filters,
    p_limit: limit,
    p_offset: offset,
  })
  return Array.isArray(rows) ? rows : []
}

export async function correctTrainerFeedback({
  id,
  feedbackText,
  learningExperience,
  trainerStrengths,
  areasForImprovement,
  recommendation,
  reason,
}) {
  return rpc('admin_correct_trainer_feedback', {
    p_id: id,
    p_feedback_text: feedbackText,
    p_learning_experience: learningExperience || null,
    p_trainer_strengths: trainerStrengths || null,
    p_areas_for_improvement: areasForImprovement || null,
    p_recommendation: recommendation || null,
    p_reason: reason || null,
  })
}

export async function fetchFeedbackRevisions(feedbackId) {
  const { data, error } = await supabase
    .from('trainer_feedback_revisions')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

// CSV export. The Edge Function re-checks MFA, streams the filtered rows and
// writes an audit row before releasing the file, so we never build the file in
// the browser.
export async function downloadFeedbackCsv(filters = {}) {
  if (!feedbackBackendAvailable) throw new Error('Supabase is not configured.')
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in again to export.')

  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      params.set(key, String(value).trim())
    }
  })
  const qs = params.toString()
  const base = String(supabase.supabaseUrl || '').replace(/\/$/, '')
  const res = await fetch(`${base}/functions/v1/export-trainer-feedback${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {
      /* ignore */
    }
    if (res.status === 404) {
      throw new Error('Export function is not deployed yet (supabase functions deploy export-trainer-feedback).')
    }
    throw new Error(detail || `Export failed (${res.status}).`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trainer-feedback-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
