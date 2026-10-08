import { Plus, Trash2 } from 'lucide-react'
import { Button, Input, Select, Badge } from '../ui'
import { uid, cn } from '../../lib/utils'

const TYPES = [
  { key: 'mcq', label: 'Multiple Choice' },
  { key: 'tf', label: 'True / False' },
  { key: 'id', label: 'Identification' },
]

const blank = () => ({ id: uid('q'), type: 'mcq', q: '', options: ['', '', '', ''], answer: '' })

// Reusable question bank editor (used by quizzes and exams).
export function QuestionBuilder({ questions = [], onChange }) {
  const update = (id, patch) => onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  const add = () => onChange([...questions, blank()])
  const remove = (id) => onChange(questions.filter((q) => q.id !== id))

  const changeType = (q, type) => {
    if (type === 'mcq') {
      update(q.id, {
        type,
        options: q.options?.length ? q.options : ['', '', '', ''],
        answer: typeof q.answer === 'string' ? q.answer : '',
      })
    } else if (type === 'tf') {
      update(q.id, { type, options: undefined, answer: q.answer === true })
    } else {
      update(q.id, { type, options: undefined, answer: typeof q.answer === 'string' ? q.answer : '' })
    }
  }

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          No questions yet. Add your first question below.
        </p>
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="brand">Q{i + 1}</Badge>
              <Select value={q.type} onChange={(e) => changeType(q, e.target.value)} className="h-8 w-44 text-xs">
                {TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="button"
              onClick={() => remove(q.id)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Remove question"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <Input
            className="mt-3"
            value={q.q}
            onChange={(e) => update(q.id, { q: e.target.value })}
            placeholder="Enter the question…"
          />

          {q.type === 'mcq' && (
            <div className="mt-3 space-y-2">
              {(q.options || []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update(q.id, { answer: opt })}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      q.answer === opt && opt !== ''
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 text-slate-400',
                    )}
                    title="Mark as correct answer"
                  >
                    {String.fromCharCode(65 + oi)}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const options = [...q.options]
                      const prev = options[oi]
                      options[oi] = e.target.value
                      const answer = q.answer === prev ? e.target.value : q.answer
                      update(q.id, { options, answer })
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  />
                  {(q.options || []).length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const options = q.options.filter((_, idx) => idx !== oi)
                        update(q.id, { options, answer: options.includes(q.answer) ? q.answer : '' })
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-600"
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update(q.id, { options: [...(q.options || []), ''] })}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  + Add option
                </button>
                <span className="text-xs text-slate-400">Tap a letter to mark the correct answer.</span>
              </div>
            </div>
          )}

          {q.type === 'tf' && (
            <div className="mt-3 flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => update(q.id, { answer: v })}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition',
                    q.answer === v
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-brand-200',
                  )}
                >
                  {v ? 'True' : 'False'}
                </button>
              ))}
            </div>
          )}

          {q.type === 'id' && (
            <Input
              className="mt-3"
              value={q.answer || ''}
              onChange={(e) => update(q.id, { answer: e.target.value })}
              placeholder="Correct answer (identification)"
            />
          )}
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={add}>
        Add question
      </Button>
    </div>
  )
}

export default QuestionBuilder
