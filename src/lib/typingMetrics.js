// ---------------------------------------------------------------------------
// Typing test metrics
// ---------------------------------------------------------------------------
// Same definitions used by the mainstream typing tests (Monkeytype, Typing.com):
//   gross WPM = every typed character / 5 / minutes
//   net WPM   = correctly typed characters / 5 / minutes
//   accuracy  = correct characters / typed characters
//   errors    = incorrectly typed characters
//
// Characters are compared position by position against the target passage, so
// a correction (backspace + retype) is measured on the final text.
// ---------------------------------------------------------------------------

export const TYPING_TARGET_WPM = 40

export function computeTypingStats(target = '', typed = '', seconds = 0) {
  const limit = Math.min(typed.length, target.length)
  let correctChars = 0
  let incorrectChars = 0

  for (let i = 0; i < limit; i += 1) {
    if (typed[i] === target[i]) correctChars += 1
    else incorrectChars += 1
  }

  const typedChars = typed.length
  const minutes = seconds > 0 ? seconds / 60 : 0
  const grossWpm = minutes ? Math.round(typedChars / 5 / minutes) : 0
  const netWpm = minutes ? Math.round(correctChars / 5 / minutes) : 0
  const accuracy = typedChars ? Math.round((correctChars / typedChars) * 100) : 100

  const targetWords = target.trim().split(/\s+/)
  const typedWords = typed.trim().split(/\s+/).filter(Boolean)
  let correctWords = 0
  let incorrectWords = 0

  typedWords.forEach((word, i) => {
    if (word === targetWords[i]) correctWords += 1
    else incorrectWords += 1
  })

  return {
    correctChars,
    incorrectChars,
    typedChars,
    grossWpm,
    netWpm,
    // `wpm` is what the UI/trainer reports: net speed, errors already deducted.
    wpm: netWpm,
    accuracy,
    errors: incorrectChars,
    totalWords: targetWords.length,
    correctWords,
    incorrectWords,
    typedWords: typedWords.length,
    seconds: Math.round(seconds),
  }
}

// Score = net WPM against the 40 WPM target, capped at 100%. Accuracy is
// already baked into net WPM (wrong characters never count toward speed), so
// multiplying by accuracy again would punish the same mistakes twice.
export const typingScore = (wpm, target = TYPING_TARGET_WPM) =>
  Math.max(0, Math.min(100, Math.round(((Number(wpm) || 0) / target) * 100)))

// The attempt is complete only when the target length is reached AND the final
// character was actually typed. Without the second check, a space typed in the
// place of the closing period fills the last slot and ends the test early.
export const isPassageComplete = (target = '', typed = '') =>
  target.length > 0 &&
  typed.length >= target.length &&
  typed[target.length - 1] === target[target.length - 1]

export const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total < 60) return total + 's'
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return rest ? minutes + 'm ' + rest + 's' : minutes + 'm'
}
