// ===========================================================================
// Edge Function: export-trainer-feedback
// ---------------------------------------------------------------------------
// Super Admin CSV export of qualitative trainee -> trainer feedback.
//
// Security:
//   1. The caller's JWT is verified (auth.getUser).
//   2. The caller must be an active Super Admin.
//   3. The session must be AAL2 (MFA completed).
//   4. Data is read through the caller's own JWT, so the SECURITY DEFINER RPC
//      re-checks is_super_admin_mfa() and RLS still applies to anything else.
//   5. The service_role key never leaves the server and is not used to read
//      feedback rows.
//   6. Every export writes an audit row before the file is returned.
//
// Usage:
//   GET  /functions/v1/export-trainer-feedback?trainer_id=...&date_from=...
//   POST /functions/v1/export-trainer-feedback  { "filters": { ... } }
// ===========================================================================

import { corsHeaders, errorResponse } from '../_shared/cors.ts'
import { bearerToken, requireSuperAdmin } from '../_shared/auth.ts'
import { callerClient } from '../_shared/supabase.ts'
import { buildCsv, type CsvColumn } from '../_shared/csv.ts'

interface FeedbackRow {
  id: string
  trainer_id: string
  trainer_name: string | null
  trainee_id: string
  trainee_name: string | null
  program_id: string
  course_title: string | null
  enrollment_id: string
  feedback_text: string
  learning_experience: string | null
  trainer_strengths: string | null
  areas_for_improvement: string | null
  recommendation: string | null
  rating: number | null
  submitted_at: string
}

const FILTER_KEYS = [
  'trainer_id',
  'program_id',
  'trainee_id',
  'enrollment_id',
  'date_from',
  'date_to',
  'search',
] as const

const PAGE_SIZE = 1000
const MAX_ROWS = 1_000_000

function cleanFilters(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const raw = input?.[key]
    if (raw === null || raw === undefined) continue
    const value = String(raw).trim()
    if (!value) continue
    if (key === 'date_from' || key === 'date_to') {
      if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(value)) {
        throw new Error('Dates must be YYYY-MM-DD or an ISO timestamp.')
      }
    }
    if (key === 'search' && value.length > 200) {
      throw new Error('Search text is too long.')
    }
    out[key] = value
  }
  return out
}

async function readFilters(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url)
  const fromQuery: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const value = url.searchParams.get(key)
    if (value) fromQuery[key] = value
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const nested = (body?.filters ?? body) as Record<string, unknown>
    return cleanFilters({ ...fromQuery, ...nested })
  }

  return cleanFilters(fromQuery)
}

const COLUMNS: CsvColumn<FeedbackRow>[] = [
  { header: 'Trainer name', value: (r) => r.trainer_name ?? r.trainer_id },
  { header: 'Trainee name', value: (r) => r.trainee_name ?? r.trainee_id },
  { header: 'Trainee ID', value: (r) => r.trainee_id },
  { header: 'Course/Program', value: (r) => r.course_title ?? r.program_id },
  { header: 'Program ID', value: (r) => r.program_id },
  { header: 'Enrollment ID', value: (r) => r.enrollment_id },
  { header: 'Qualitative feedback', value: (r) => r.feedback_text },
  { header: 'Trainer strengths', value: (r) => r.trainer_strengths },
  { header: 'Areas for improvement', value: (r) => r.areas_for_improvement },
  { header: 'Learning experience', value: (r) => r.learning_experience },
  { header: 'Recommendations', value: (r) => r.recommendation },
  { header: 'Rating (1-5)', value: (r) => r.rating },
  { header: 'Submission date', value: (r) => r.submitted_at },
]

function timestampForFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    now.getUTCFullYear() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    '-' +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds())
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return errorResponse(auth.error, auth.status)

  // Feedback is sensitive: require the MFA challenge even when the account's
  // mfa_enforced flag is off.
  if (auth.aal !== 'aal2') {
    return errorResponse(
      'Multi-factor authentication is required to export trainer feedback.',
      403,
    )
  }

  const token = bearerToken(req)
  if (!token) return errorResponse('Missing Authorization bearer token.', 401)

  let filters: Record<string, string>
  try {
    filters = await readFilters(req)
  } catch (e) {
    return errorResponse((e as Error).message, 400)
  }

  const client = callerClient(token)
  const rows: FeedbackRow[] = []

  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.rpc('admin_trainer_feedback_page', {
        p_filters: filters,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      })

      if (error) {
        console.error('admin_trainer_feedback_page failed', error.message)
        return errorResponse('Could not read trainer feedback.', 500)
      }

      const batch = (Array.isArray(data) ? data : []) as FeedbackRow[]
      rows.push(...batch)

      if (rows.length > MAX_ROWS) {
        return errorResponse(
          'The report is too large to export in one file. Narrow the filters.',
          413,
        )
      }
      if (batch.length < PAGE_SIZE) break
    }

    // Fail closed: no file without an audit trail.
    const { error: auditError } = await client.rpc('log_trainer_feedback_export', {
      p_filters: filters,
      p_row_count: rows.length,
      p_format: 'csv',
    })
    if (auditError) {
      console.error('log_trainer_feedback_export failed', auditError.message)
      return errorResponse('Could not record the export audit entry.', 500)
    }
  } catch (e) {
    console.error('export-trainer-feedback failed', (e as Error).message)
    return errorResponse('Could not build the feedback report.', 500)
  }

  const csv = buildCsv(COLUMNS, rows)
  const filename = 'trainer-feedback-' + timestampForFilename() + '.csv'

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    },
  })
})
