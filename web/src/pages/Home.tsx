import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/hooks'
import { goalProgress } from '../lib/logic'
import { useToast } from '../lib/toast'
import type { DashboardData, Goal } from '../lib/types'
import { Face, PALETTE } from '../ui/Face'
import { FlameIcon, PhoneIcon, PuzzleIcon } from '../ui/Icons'
import { Avatar, Bento, Button, Card, ErrorRetry, FaceChip, Sheet, Spinner, Tokens, TokenPill } from '../ui/kit'

export function HomePage() {
  const { user: authUser, setUser } = useAuth()
  const navigate = useNavigate()
  const dash = useFetch(async () => {
    const d = await api.get<DashboardData>('/me/dashboard')
    setUser(d.user)
    return d
  })

  if (dash.loading) return <Spinner />
  if (dash.error || !dash.data) return <ErrorRetry message={dash.error ?? 'Something went wrong'} onRetry={dash.reload} />

  const { goal, challenges } = dash.data
  // The shared user is kept current by redeems and claims; the dashboard snapshot can be stale.
  const user = authUser ?? dash.data.user
  const first = user.displayName.trim().split(' ')[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-xs">Welcome back</p>
          <p className="truncate font-display text-base font-bold">{user.displayName}</p>
        </div>
        <TokenPill amount={user.tokenBalance} />
      </div>

      <h1 className="font-display text-[2rem] leading-[1.05] font-extrabold">Hello {first}! How long do you want to focus today?</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FaceChip label="25 min" color={PALETTE.green} mood="happy" onClick={() => navigate('/focus?min=25')} />
        <FaceChip label="45 min" color={PALETTE.orange} shape="squircle" mood="wink" onClick={() => navigate('/focus?min=45')} />
        <FaceChip label="60 min" color={PALETTE.blue} shape="blob" mood="sleepy" onClick={() => navigate('/focus?min=60')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ScreenTime goal={goal} onSaved={dash.reload} />
        <Bento color={PALETTE.purple} title="Streak" icon={<FlameIcon className="h-4 w-4" />}>
          <div className="flex h-[4.5rem] items-end gap-1" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full ${i < Math.min(7, Math.max(1, user.streak.current)) ? 'bg-ink' : 'bg-white/60'}`}
                style={{ height: 14 + i * 8 }}
              />
            ))}
          </div>
          <p className="mt-3 font-display text-2xl font-extrabold">
            {user.streak.current} {user.streak.current === 1 ? 'day' : 'days'}
          </p>
          <p className="text-xs">
            Level {user.level} · {user.streak.freezes} {user.streak.freezes === 1 ? 'freeze' : 'freezes'}
          </p>
        </Bento>
      </div>

      <Bento color={PALETTE.green} title="Yes or No quiz" icon={<PuzzleIcon className="h-4 w-4" />}>
        <p className="font-display text-xl leading-tight font-bold">Have you taken a mindful break since your last session?</p>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <Button small onClick={() => navigate('/break')}>
            Yes, break time
          </Button>
          <Button small onClick={() => navigate('/focus')}>
            No, focus
          </Button>
        </div>
      </Bento>

      <GoalCard goal={goal} />

      {challenges.length > 0 && (
        <section aria-labelledby="your-challenges">
          <h2 id="your-challenges" className="mb-2 font-display text-xl font-bold">
            Your challenges
          </h2>
          <div className="flex flex-col gap-2">
            {challenges.map(({ challenge, progress }) => (
              <Card key={challenge.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{challenge.title}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${goalProgress(progress?.progress ?? 0, challenge.target) * 100}%` }} />
                  </div>
                </div>
                <Tokens amount={challenge.rewardTokens} />
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ScreenTime({ goal, onSaved }: { goal: Goal; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState('')
  const used = goal.screenLimitMin ? Math.min(1, goal.screenUsedMin / goal.screenLimitMin) : 0
  const over = goal.screenUsedMin > goal.screenLimitMin

  async function save(e: FormEvent) {
    e.preventDefault()
    const value = Number.parseInt(minutes, 10)
    if (Number.isNaN(value) || value < 0) return
    try {
      await api.post('/goals/today/screen-time', { minutes: value })
      setOpen(false)
      await onSaved()
    } catch (err) {
      toast(errorMessage(err))
    }
  }

  return (
    <>
      <Bento color={PALETTE.orange} title="Screen time" icon={<PhoneIcon className="h-4 w-4" />}>
        <p className="font-display text-[2rem] leading-none font-extrabold">
          {Math.floor(goal.screenUsedMin / 60)}
          <span className="text-base font-bold">h </span>
          {goal.screenUsedMin % 60}
          <span className="text-base font-bold">min</span>
        </p>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/60">
          <div className="h-full rounded-full bg-ink" style={{ width: `${used * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs">{over ? `Over your ${goal.screenLimitMin} min limit` : `Limit ${goal.screenLimitMin} min`}</p>
        <Button
          variant="outline"
          small
          className="mt-2.5"
          onClick={() => {
            setMinutes(goal.screenUsedMin > 0 ? String(goal.screenUsedMin) : '')
            setOpen(true)
          }}
        >
          Log
        </Button>
      </Bento>
      <Sheet open={open} onClose={() => setOpen(false)} label="Log screen time">
        <form onSubmit={save} className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-extrabold">Today&apos;s screen time</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Total minutes so far</span>
            <input
              autoFocus
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-2xl bg-lavender px-4 py-3.5 text-lg outline-none focus:ring-2 focus:ring-ink"
            />
          </label>
          <p className="text-sm">Stay under your limit for +20 tokens, paid tomorrow.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Sheet>
    </>
  )
}

function GoalCard({ goal }: { goal: Goal }) {
  const progress = goalProgress(goal.focusDoneMin, goal.focusTargetMin)
  const r = 36
  const c = 2 * Math.PI * r
  return (
    <Card className="flex items-center gap-5 p-5">
      <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`${Math.round(progress * 100)} percent of the daily goal`}>
        <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#EDEBF1" strokeWidth="9" />
          <circle cx="44" cy="44" r={r} fill="none" stroke="#111" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{Math.round(progress * 100)}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-bold">{goal.achieved ? 'Daily goal reached' : 'Daily focus goal'}</p>
        <p className="text-sm">
          {goal.focusDoneMin} of {goal.focusTargetMin} minutes
        </p>
      </div>
      <Face mood={goal.achieved ? 'happy' : 'calm'} color={goal.achieved ? PALETTE.green : PALETTE.purple} size={52} />
    </Card>
  )
}
