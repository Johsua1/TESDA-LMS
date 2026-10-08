// Secure temporary password generation (Edge Function runtime).

export function generateTempPassword(len = 12): string {
  // Ambiguous characters removed. Guarantees a mix of classes below.
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%*'
  const all = upper + lower + digits + symbols

  const pick = (set: string): string => {
    const b = new Uint8Array(1)
    crypto.getRandomValues(b)
    return set[b[0] % set.length]
  }

  const out: string[] = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  for (let i = out.length; i < Math.max(len, 12); i++) out.push(pick(all))

  // Fisher-Yates shuffle with CSPRNG.
  for (let i = out.length - 1; i > 0; i--) {
    const b = new Uint8Array(1)
    crypto.getRandomValues(b)
    const j = b[0] % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }

  return out.join('')
}
