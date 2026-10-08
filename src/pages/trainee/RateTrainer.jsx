import { useMemo, useState } from 'react'
import { Star, Send } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { activeEnrollmentsOf, traineeTrainerRating, enrollmentTrainerId } from '../../store/selectors'
import { programById } from '../../data/programs'
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Avatar,
  Badge,
  EmptyState,
  Textarea,
  Stars,
} from '../../components/ui'
import { formatDate } from '../../lib/utils'

export function RateTrainer() {
  const { db, user, saveTrainerRating, toast } = useApp()
  // Drafts keyed by trainerId, only set once the trainee edits a card.
  const [drafts, setDrafts] = useState({})

  // One card per trainer the trainee is actually enrolled under.
  const cards = useMemo(() => {
    // The trainer handling this trainee (admin-assigned on the enrollment),
    // with fallbacks for older records.
    const resolveTrainer = (enrollment) => {
      let trainerId = enrollmentTrainerId(db, enrollment)
      if (!trainerId) {
        const program = programById(enrollment.programId)
        trainerId = program?.trainerId
      }
      if (!trainerId) {
        trainerId = db.users.find((u) => u.role === 'trainer' && (u.programs || []).includes(enrollment.programId))?.id
      }
      if (!trainerId) {
        trainerId = db.schedules.find((s) => s.programId === enrollment.programId)?.trainerId
      }
      return trainerId ? db.users.find((u) => u.id === trainerId) : null
    }

    const map = new Map()
    activeEnrollmentsOf(db, user.id).forEach((e) => {
      const trainer = resolveTrainer(e)
      if (!trainer || map.has(trainer.id)) return
      map.set(trainer.id, { trainer, programId: e.programId })
    })
    return [...map.values()]
  }, [db, user.id])

  const draftFor = (trainerId) => {
    if (drafts[trainerId]) return drafts[trainerId]
    const existing = traineeTrainerRating(db, user.id, trainerId)
    return { rating: existing?.rating || 0, comment: existing?.comment || '' }
  }

  const setDraft = (trainerId, patch) =>
    setDrafts((d) => {
      const existing = traineeTrainerRating(db, user.id, trainerId)
      const base = d[trainerId] || { rating: existing?.rating || 0, comment: existing?.comment || '' }
      return { ...d, [trainerId]: { ...base, ...patch } }
    })

  const submit = (card) => {
    const value = draftFor(card.trainer.id)
    if (!value.rating) {
      toast('Please choose a star rating first.', 'warning')
      return
    }
    const existing = traineeTrainerRating(db, user.id, card.trainer.id)
    saveTrainerRating({
      traineeId: user.id,
      trainerId: card.trainer.id,
      programId: card.programId,
      rating: value.rating,
      comment: (value.comment || '').trim(),
      date: existing?.date || new Date().toISOString().slice(0, 10),
    })
    setDrafts((d) => {
      const next = { ...d }
      delete next[card.trainer.id]
      return next
    })
  }

  return (
    <div>
      <PageHeader
        title="Rate Trainer"
        description="Share your feedback on the trainers handling your enrolled programs."
      />

      {cards.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {cards.map((card) => {
            const { trainer, programId } = card
            const program = programById(programId)
            const existing = traineeTrainerRating(db, user.id, trainer.id)
            const value = draftFor(trainer.id)
            return (
              <Card key={trainer.id}>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={trainer.name} color={trainer.avatarColor} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">{trainer.name}</p>
                      <p className="text-xs text-slate-400">{trainer.position || 'Trainer'}</p>
                    </div>
                    <Badge tone="brand">{program?.code || 'Program'}</Badge>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {program?.title}
                  </div>

                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">Your rating</p>
                    <Stars value={value.rating} onChange={(n) => setDraft(trainer.id, { rating: n })} />
                  </div>

                  <Textarea
                    value={value.comment}
                    onChange={(e) => setDraft(trainer.id, { comment: e.target.value })}
                    rows={3}
                    placeholder="Optional — what went well, or what could be improved?"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                      {existing ? `You rated this trainer on ${formatDate(existing.date)}` : 'Not rated yet'}
                    </p>
                    <Button icon={Send} onClick={() => submit(card)}>
                      {existing ? 'Update rating' : 'Submit rating'}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Star}
            title="No trainers to rate"
            description="Once you're enrolled in a program, you can rate its trainer here."
          />
        </Card>
      )}
    </div>
  )
}

export default RateTrainer
