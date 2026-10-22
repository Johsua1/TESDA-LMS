// ---------------------------------------------------------------------------
// Admission requirements
// ---------------------------------------------------------------------------
// Programs list their admission requirements as plain strings. Some are
// documents the trainee must upload (PSA birth certificate, CV, medical
// certificate, clearances, ID pictures); the rest are eligibility criteria that
// the registrar confirms during review and must NOT ask for an upload.
// ---------------------------------------------------------------------------

const DOCUMENT_KEYWORDS = [
  'psa',
  'birth certificate',
  'curriculum vitae',
  'resume',
  'medical certificate',
  'health clearance',
  'skin test',
  'barangay clearance',
  'nbi clearance',
  'police clearance',
  'id picture',
  'id photo',
  '2x2',
  'diploma',
  'transcript',
  'certificate of employment',
]

const CV_PATTERN = /\bcv\b/

export const needsDocument = (requirement) => {
  const text = String(requirement || '').toLowerCase()
  if (CV_PATTERN.test(text)) return true
  return DOCUMENT_KEYWORDS.some((keyword) => text.includes(keyword))
}

export const documentRequirements = (requirements = []) => requirements.filter(needsDocument)
