// ---------------------------------------------------------------------------
// Timed-assessment RPC wrappers
// ---------------------------------------------------------------------------
// The attempt clock lives in the database. These helpers only *read* it: the
// existing runner still writes the attempt row once on submit, and the database
// trigger re-grades it, so there is no second attempt row and no client-side
// scoring authority.
// ---------------------------------------------------------------------------
import { supabase, isSupabaseConfigured } from './supabase'

export const assessmentBackendAvailable = isSupabaseConfigured

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    const err = new Error(error.message || 'Request failed.')
    err.code = error.code
    throw err
  }
  return data
}

// Server-owned quiz session clock (started_at / deadline_at).
export async function getQuizSessionState(programId, quizId) {
  if (!assessmentBackendAvailable) return null
  return rpc('get_quiz_session_state', { p_program_id: programId, p_quiz_id: quizId })
}

// Server-graded attempt. Returns null when the row has not reached the database
// yet, so the caller can fall back to the local result.
export async function getServerQuizAttempt(attemptId) {
  if (!assessmentBackendAvailable || !attemptId) return null
  try {
    return await rpc('get_quiz_attempt', { p_attempt_id: attemptId })
  } catch {
    return null
  }
}

export async function getServerExamAttempt(attemptId) {
  if (!assessmentBackendAvailable || !attemptId) return null
  try {
    return await rpc('get_exam_attempt', { p_attempt_id: attemptId })
  } catch {
    return null
  }
}
