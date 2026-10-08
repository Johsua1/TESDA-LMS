import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Hand,
  MessageSquare,
  Users,
  PhoneOff,
  X,
  Send,
  Info,
  Clock,
  Copy,
  Link2,
  ShieldCheck,
  Signal,
  BookOpen,
  FileText,
  Download,
  Crown,
  Circle,
  Radio,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById } from '../../store/selectors'
import { roleMeta } from '../../config/navigation'
import { cn, formatTime, formatDate, initials } from '../../lib/utils'

// deterministic pseudo-state for mock participants
const mockState = (seed) => ({
  micOn: seed % 3 !== 0,
  camOn: seed % 4 !== 1,
  handRaised: seed % 7 === 0,
})

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// ------------------------------- Video tile ---------------------------------
function VideoTile({ person, isSelf, isTrainer, micOn, camOn, handRaised, speaking, label }) {
  const showVideo = camOn
  return (
    <div
      className={cn(
        'group relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-slate-800 ring-1 transition-all',
        speaking ? 'ring-2 ring-emerald-400' : 'ring-slate-700/70',
      )}
    >
      {showVideo ? (
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90', person?.avatarColor || 'from-slate-600 to-slate-700')} />
      ) : (
        <div className="absolute inset-0 bg-slate-900" />
      )}

      {showVideo ? (
        <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white backdrop-blur-sm sm:h-20 sm:w-20 sm:text-2xl">
          {initials(person?.name || 'NA')}
        </span>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-2 text-slate-500">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-base font-semibold text-slate-300 ring-1 ring-slate-700">
            {initials(person?.name || 'NA')}
          </span>
          <span className="text-[11px] uppercase tracking-wide">Camera off</span>
        </div>
      )}

      {/* name plate */}
      <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center gap-2">
        <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {isTrainer && <Crown className="h-3 w-3 shrink-0 text-amber-400" />}
          <span className="truncate">
            {person?.name || 'Participant'}
            {isSelf && ' (You)'}
          </span>
          {label && <span className="rounded bg-white/20 px-1 text-[10px]">{label}</span>}
        </span>
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-md backdrop-blur-sm', micOn ? 'bg-black/50 text-white' : 'bg-red-500 text-white')}>
          {micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
        </span>
        {handRaised && (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400 text-amber-900" title="Hand raised">
            <Hand className="h-3 w-3" />
          </span>
        )}
      </div>

      {speaking && (
        <span className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <Radio className="h-2.5 w-2.5" /> Speaking
        </span>
      )}
    </div>
  )
}

// ------------------------------ Control button ------------------------------
function ControlButton({ icon: Icon, label, active, danger, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'relative flex h-12 w-12 items-center justify-center rounded-full transition-all',
        danger
          ? 'bg-red-600 text-white hover:bg-red-500'
          : active
            ? 'bg-white text-slate-900 hover:bg-slate-200'
            : 'bg-slate-700 text-white hover:bg-slate-600',
      )}
    >
      <Icon className="h-5 w-5" />
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

// --------------------------------- Room -------------------------------------
export function MeetRoom() {
  const { scheduleId } = useParams()
  const { db, user, saveAttendance, toast } = useApp()
  const navigate = useNavigate()
  const now = useClock()

  const schedule = db.schedules.find((s) => s.id === scheduleId)
  const program = schedule ? programById(schedule.programId) : null
  const trainer = schedule ? db.users.find((u) => u.id === schedule.trainerId) : null
  const ended = schedule?.status === 'Completed'

  // roster of everyone who should be in this class
  const roster = useMemo(() => {
    if (!schedule) return []
    const enrs = db.enrollments.filter(
      (e) => e.programId === schedule.programId && ['Enrolled', 'Approved', 'Completed'].includes(e.status),
    )
    const learners = enrs.map((e) => db.users.find((u) => u.id === e.traineeId)).filter(Boolean)
    const t = db.users.find((u) => u.id === schedule.trainerId)
    return t ? [t, ...learners] : learners
  }, [db, schedule])

  const others = roster.filter((p) => p.id !== user.id)

  // participants that are "connected" (mock presence — a few may be absent)
  const presentOthers = useMemo(
    () => others.filter((_, i) => (i + 1) % 5 !== 0),
    [others],
  )

  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [panel, setPanel] = useState(null) // 'chat' | 'people' | 'info' | null
  const [draft, setDraft] = useState('')
  const [joinedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [speakerIdx, setSpeakerIdx] = useState(0)
  const [chatOpenBadge, setChatOpenBadge] = useState(0)
  const chatEndRef = useRef(null)
  const attendanceRef = useRef(false)

  const [messages, setMessages] = useState(() => {
    const host = trainer?.name?.split(' ')[0] || 'Trainer'
    return [
      { id: 'm1', authorId: trainer?.id, name: host, text: `Good day everyone! Welcome to ${schedule?.lessonTitle || 'our class'}.`, time: 'now', own: false },
      { id: 'm2', authorId: null, name: 'System', text: 'You joined the class. Please keep your microphone muted unless speaking.', time: 'now', own: false, system: true },
    ]
  })

  // call duration
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - joinedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [joinedAt])

  // cycle the "active speaker" for a lifelike room
  useEffect(() => {
    if (presentOthers.length === 0) return undefined
    const t = setInterval(() => setSpeakerIdx((i) => (i + 1) % (presentOthers.length + 1)), 5000)
    return () => clearInterval(t)
  }, [presentOthers.length])

  // auto-record attendance when a trainee joins an in-progress class
  useEffect(() => {
    if (!schedule || attendanceRef.current) return
    if (user.role !== 'trainee') return
    attendanceRef.current = true
    const existing = db.attendance.find((a) => a.traineeId === user.id && a.scheduleId === schedule.id)
    if (existing) return
    const [sh, sm] = schedule.startTime.split(':').map(Number)
    const start = new Date()
    start.setHours(sh, sm, 0, 0)
    const isLate = Date.now() - start.getTime() > 10 * 60 * 1000
    saveAttendance({
      traineeId: user.id,
      programId: schedule.programId,
      scheduleId: schedule.id,
      lessonTitle: schedule.lessonTitle,
      trainerId: schedule.trainerId,
      date: schedule.date,
      timeIn: hhmm(new Date()),
      timeOut: null,
      status: isLate ? 'Late' : 'Present',
      remark: 'Joined online class',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule?.id, user.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, panel])

  if (!schedule) return <Navigate to={roleMeta[user.role]?.home || '/login'} replace />

  const sessionMaterials =
    program?.competencies
      .flatMap((c) => (c.units ? c.units.flatMap((u) => u.lessons) : c.lessons))
      .find((l) => l.id === schedule.lessonId)?.materials || []

  const openPanel = (next) => {
    setPanel((p) => (p === next ? null : next))
    if (next === 'chat') setChatOpenBadge(0)
  }

  const sendMessage = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [...m, { id: `m-${Date.now()}`, authorId: user.id, name: user.name, text, time: hhmm(new Date()), own: true }])
    setDraft('')
  }

  const leave = () => {
    toast('You left the class.', 'info')
    navigate(user.role === 'trainee' ? '/trainee/schedules' : user.role === 'trainer' ? '/trainer/schedules' : '/admin/schedules')
  }

  const copyInvite = () => {
    navigator.clipboard?.writeText(window.location.href)
    toast('Class link copied to clipboard.', 'info')
  }

  const presentCount = presentOthers.length + 1
  const speakingId = speakerIdx === 0 ? user.id : presentOthers[speakerIdx - 1]?.id

  const selfTile = (
    <VideoTile
      person={user}
      isSelf
      micOn={micOn}
      camOn={camOn}
      handRaised={handRaised}
      speaking={speakingId === user.id}
    />
  )

  const otherTiles = presentOthers.map((p, i) => {
    const st = mockState(i + 1)
    return (
      <VideoTile
        key={p.id}
        person={p}
        isTrainer={p.id === schedule.trainerId}
        micOn={st.micOn}
        camOn={st.camOn}
        handRaised={st.handRaised}
        speaking={speakingId === p.id}
      />
    )
  })

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200">
      {/* ------------------------------ Top bar ------------------------------ */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-tesda-blue text-white">
          <BookOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-white">{schedule.lessonTitle || schedule.unitTitle}</h1>
            {ended ? (
              <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                Session ended
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-400">
            {program?.title} · {schedule.competency} Competency · {formatTime(schedule.startTime)}–{formatTime(schedule.endTime)}
          </p>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300">
            <Signal className="h-3.5 w-3.5 text-emerald-400" /> Connected
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300">
            <Clock className="h-3.5 w-3.5" /> {formatDuration(elapsed)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300">
            <Users className="h-3.5 w-3.5" /> {presentCount}
          </span>
        </div>

        <button
          onClick={copyInvite}
          className="hidden items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 sm:inline-flex"
        >
          <Link2 className="h-3.5 w-3.5" /> Copy invite
        </button>
      </header>

      {ended && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
          This class session has ended. You can still review the room, chat history and class materials.
        </div>
      )}

      {/* ------------------------------- Body -------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Stage */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {sharing ? (
              <div className="mb-3">
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-slate-800 ring-1 ring-brand-500/60">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-900/60 to-slate-900" />
                  <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                      <MonitorUp className="h-7 w-7" />
                    </span>
                    <p className="text-sm font-semibold text-white">You are presenting your screen</p>
                    <p className="text-xs text-slate-400">Other participants can see your screen now.</p>
                    <button
                      onClick={() => setSharing(false)}
                      className="mt-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                    >
                      Stop presenting
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 z-20 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {user.name} (You) · Presenting
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn('grid gap-3', sharing ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}>
              {selfTile}
              {otherTiles}
            </div>

            {presentOthers.length === 0 && (
              <p className="mt-6 text-center text-sm text-slate-500">
                You are the first to join. Others will appear here as they connect.
              </p>
            )}
          </div>

          {/* ---------------------------- Controls --------------------------- */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-900/60 px-4 py-3">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <ControlButton
                icon={micOn ? Mic : MicOff}
                label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                active={!micOn}
                onClick={() => setMicOn((v) => !v)}
              />
              <ControlButton
                icon={camOn ? VideoIcon : VideoOff}
                label={camOn ? 'Turn camera off' : 'Turn camera on'}
                active={!camOn}
                onClick={() => setCamOn((v) => !v)}
              />
              <ControlButton
                icon={sharing ? MonitorOff : MonitorUp}
                label={sharing ? 'Stop sharing' : 'Share screen'}
                active={sharing}
                onClick={() => setSharing((v) => !v)}
              />
              <ControlButton
                icon={Hand}
                label={handRaised ? 'Lower hand' : 'Raise hand'}
                active={handRaised}
                onClick={() => setHandRaised((v) => !v)}
              />
              <ControlButton
                icon={MessageSquare}
                label="Chat"
                active={panel === 'chat'}
                onClick={() => openPanel('chat')}
                badge={chatOpenBadge}
              />
              <ControlButton icon={Users} label="Participants" active={panel === 'people'} onClick={() => openPanel('people')} />
              <ControlButton icon={Info} label="Class information" active={panel === 'info'} onClick={() => openPanel('info')} />
              <div className="mx-1 hidden h-8 w-px bg-slate-700 sm:block" />
              <ControlButton icon={PhoneOff} label="Leave class" danger onClick={leave} />
            </div>
          </div>
        </div>

        {/* ------------------------------ Side panel ---------------------------- */}
        {panel && (
          <aside className="flex w-full shrink-0 flex-col border-l border-slate-800 bg-slate-900 sm:w-80 lg:w-96">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                {panel === 'chat' && <MessageSquare className="h-4 w-4 text-brand-400" />}
                {panel === 'people' && <Users className="h-4 w-4 text-brand-400" />}
                {panel === 'info' && <Info className="h-4 w-4 text-brand-400" />}
                <h2 className="text-sm font-semibold text-white">
                  {panel === 'chat' ? 'In-call messages' : panel === 'people' ? `Participants (${presentCount})` : 'Class information'}
                </h2>
              </div>
              <button
                onClick={() => setPanel(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {panel === 'chat' && (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((m) => (
                    <div key={m.id} className={cn('flex flex-col', m.own ? 'items-end' : 'items-start')}>
                      {!m.system && (
                        <span className="mb-1 text-[11px] text-slate-500">
                          {m.name}
                          {m.authorId === schedule.trainerId && <span className="ml-1 text-amber-400">· Trainer</span>}
                        </span>
                      )}
                      <span
                        className={cn(
                          'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                          m.system
                            ? 'bg-slate-800/60 text-center text-xs italic text-slate-400'
                            : m.own
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-800 text-slate-200',
                        )}
                      >
                        {m.text}
                      </span>
                      {!m.system && <span className="mt-0.5 text-[10px] text-slate-600">{m.time}</span>}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendMessage} className="flex shrink-0 items-center gap-2 border-t border-slate-800 p-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Send a message…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-500 disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}

            {panel === 'people' && (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">In the call</p>
                <ul className="space-y-1">
                  {[{ person: user, self: true, isTrainer: user.id === schedule.trainerId, state: { micOn, camOn, handRaised } }, ...presentOthers.map((p, i) => ({ person: p, isTrainer: p.id === schedule.trainerId, state: mockState(i + 1) }))].map(
                    ({ person, self, isTrainer, state }) => (
                      <li key={person.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-800/60">
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white', person.avatarColor)}>
                          {initials(person.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                          {person.name}
                          {self && ' (You)'}
                        </span>
                        {isTrainer && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                        {state.handRaised && <Hand className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                        {state.micOn ? (
                          <Mic className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        ) : (
                          <MicOff className="h-3.5 w-3.5 shrink-0 text-red-400" />
                        )}
                      </li>
                    ),
                  )}
                </ul>

                {others.length > presentOthers.length && (
                  <>
                    <p className="px-1 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Not joined ({others.length - presentOthers.length})
                    </p>
                    <ul className="space-y-1">
                      {others
                        .filter((_, i) => (i + 1) % 5 === 0)
                        .map((p) => (
                          <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-60">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
                              {initials(p.name)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-400">{p.name}</span>
                            <Circle className="h-2 w-2 shrink-0 text-slate-600" />
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {panel === 'info' && (
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
                <div className="rounded-xl bg-slate-800/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Session</p>
                  <p className="mt-1 font-semibold text-white">{schedule.lessonTitle || schedule.unitTitle}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{schedule.unitTitle}</p>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                    <p className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" /> {program?.title}
                    </p>
                    <p className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" /> {schedule.competency} Competency
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" /> {formatDate(schedule.date, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" /> {trainer?.name} · {schedule.room}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <FileText className="h-3.5 w-3.5" /> Learning Materials
                  </p>
                  <div className="space-y-2">
                    {sessionMaterials.map((m) => {
                      const hasFile = Boolean(m.url)
                      const inner = (
                        <>
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-slate-200">{m.name}</span>
                            <span className="block text-[10px] uppercase text-slate-500">
                              {hasFile ? m.type : 'No file attached'}
                            </span>
                          </span>
                          <Download className={`h-3.5 w-3.5 shrink-0 ${hasFile ? 'text-brand-400' : 'text-slate-600'}`} />
                        </>
                      )
                      const base = 'flex w-full items-center gap-3 rounded-lg border border-slate-800 p-3 text-left transition'
                      return hasFile ? (
                        <a
                          key={m.id || m.name}
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className={`${base} hover:border-brand-500/50 hover:bg-slate-800/60`}
                        >
                          {inner}
                        </a>
                      ) : (
                        <div
                          key={m.id || m.name}
                          title="No file attached to this material"
                          className={`${base} cursor-not-allowed opacity-60`}
                        >
                          {inner}
                        </div>
                      )
                    })}
                    {sessionMaterials.length === 0 && (
                      <p className="text-xs text-slate-500">No materials attached to this session.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting link</p>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/50 p-2">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{schedule.meetingLink || 'In-app room'}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(schedule.meetingLink || window.location.href)
                        toast('Link copied.', 'info')
                      }}
                      className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                      aria-label="Copy meeting link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

export default MeetRoom
