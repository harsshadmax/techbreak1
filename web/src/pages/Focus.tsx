import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { estimateTokens, formatLeft } from '../lib/logic'
import { useToast } from '../lib/toast'
import type { Award } from '../lib/types'
import { Face } from '../ui/Face'
import { ChevronLeftIcon } from '../ui/Icons'
import { AwardList, Button, Sheet } from '../ui/kit'

const PRESETS = [25, 45, 60]
type Phase = 'choosing' | 'running' | 'finished'

export function FocusPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { refreshUser } = useAuth()
  const initial = Number(params.get('min'))
  const [planned, setPlanned] = useState(PRESETS.includes(initial) ? initial : 25)
  const [phase, setPhase] = useState<Phase>('choosing')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [interruptions, setInterruptions] = useState(0)
  const [awards, setAwards] = useState<Award[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const away = useRef(false)

  // Go back, or to the dashboard when this page was opened directly (a link or reload).
  const leave = useCallback(() => (window.history.length > 1 ? navigate(-1) : navigate('/')), [navigate])
  const goHome = useCallback(() => navigate('/'), [navigate])

  const left = Math.max(0, planned * 60000 - (now - startedAt))

  const complete = useCallback(async () => {
    if (!sessionId) return
    setBusy(true)
    try {
      const res = await api.post<{ awards: Award[] }>(`/sessions/${sessionId}/complete`)
      setAwards(res.awards)
      await refreshUser()
      setPhase('finished')
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [sessionId, refreshUser, toast])

  // Tick while running and finish when the time is up.
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'running' && left === 0 && !busy) void complete()
  }, [phase, left, busy, complete])

  // Leaving the tab counts as an interruption and reduces the reward.
  useEffect(() => {
    if (phase !== 'running' || !sessionId) return
    const onChange = () => {
      if (document.hidden && !away.current) {
        away.current = true
        setInterruptions((n) => n + 1)
        api.patch(`/sessions/${sessionId}/interrupt`).catch(() => undefined)
      } else if (!document.hidden) {
        away.current = false
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [phase, sessionId])

  async function start() {
    setBusy(true)
    try {
      const res = await api.post<{ session: { id: string } }>('/sessions', { type: 'focus', plannedMin: planned, platform: 'web' })
      setSessionId(res.session.id)
      setStartedAt(Date.now())
      setNow(Date.now())
      setInterruptions(0)
      away.current = false
      setPhase('running')
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function giveUp() {
    setConfirmGiveUp(false)
    if (sessionId) await api.post(`/sessions/${sessionId}/abandon`).catch(() => undefined)
    goHome()
  }

  const progress = phase === 'running' ? 1 - left / (planned * 60000) : 0
  const r = 110
  const c = 2 * Math.PI * r

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-5">
      <header className="flex items-center gap-2">
        <button type="button" aria-label="Back" onClick={phase === 'running' ? () => setConfirmGiveUp(true) : leave} className="rounded-full p-2 hover:bg-ink/5">
          <ChevronLeftIcon />
        </button>
        <h1 className="font-display text-2xl font-extrabold">Focus mode</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        {phase === 'finished' ? (
          <div className="animate-pop w-full rounded-[1.9rem] bg-green p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl font-extrabold">Session complete</h2>
              <Face mood="happy" color="#fff" size={56} />
            </div>
            <AwardList awards={awards} />
            <div className="mt-5 grid gap-2.5">
              {awards.length > 0 && <Button onClick={() => navigate(`/break?after=${sessionId}`)}>Take a mindful break (+5)</Button>}
              <Button variant={awards.length > 0 ? 'ghost' : 'primary'} onClick={goHome}>
                Back to dashboard
              </Button>
            </div>
          </div>
        ) : (
          <>
            {phase === 'choosing' && <p className="font-display text-xl font-bold">How long do you want to focus?</p>}
            <div role="group" aria-label="Session length" className="flex gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={phase === 'running'}
                  aria-pressed={planned === m}
                  onClick={() => setPlanned(m)}
                  className={`min-h-11 rounded-full border-[1.5px] border-ink px-5 font-bold transition-colors ${
                    planned === m ? 'bg-ink text-white' : 'bg-paper hover:bg-white/70'
                  } ${phase === 'running' ? 'opacity-50' : ''}`}
                >
                  {m} min
                </button>
              ))}
            </div>

            <div className="relative h-[260px] w-[260px]" role="timer" aria-label="Time left">
              <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="130" cy="130" r={r} fill="none" stroke="#fff" strokeWidth="16" />
                <circle
                  cx="130"
                  cy="130"
                  r={r}
                  fill="none"
                  stroke="#111"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - progress)}
                  className="transition-[stroke-dashoffset] duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-6xl font-extrabold tabular-nums">{phase === 'running' ? formatLeft(left) : `${planned}:00`}</span>
                <span className="text-sm">{phase === 'running' ? (interruptions === 0 ? 'Distraction-free so far' : `${interruptions} interruption${interruptions === 1 ? '' : 's'}`) : 'minutes'}</span>
              </div>
            </div>

            <p className="text-sm font-bold">{phase === 'running' ? 'Stay on this tab to keep your bonus.' : `About ${estimateTokens(planned)} tokens for this session`}</p>

            {phase === 'choosing' ? (
              <Button full disabled={busy} onClick={start}>
                Start
              </Button>
            ) : (
              <div className="grid w-full gap-1">
                <Button variant="light" full disabled={busy} onClick={complete}>
                  Finish early
                </Button>
                <Button variant="ghost" onClick={() => setConfirmGiveUp(true)}>
                  Give up
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={confirmGiveUp} onClose={() => setConfirmGiveUp(false)} label="Give up this session">
        <h2 className="font-display text-2xl font-extrabold">Give up this session?</h2>
        <p className="mt-2">You won&apos;t earn tokens for it.</p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={() => setConfirmGiveUp(false)}>
            Keep going
          </Button>
          <Button onClick={giveUp}>Give up</Button>
        </div>
      </Sheet>
    </main>
  )
}
