import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatLeft } from '../lib/logic'
import { useToast } from '../lib/toast'
import type { Award } from '../lib/types'
import { Face, PALETTE, type FaceMood, type FaceShape } from '../ui/Face'
import { ChevronLeftIcon } from '../ui/Icons'
import { AwardList, Button } from '../ui/kit'

interface Kind {
  id: string
  title: string
  prompt: string
  minutes: number
  color: string
  shape: FaceShape
  mood: FaceMood
}

const KINDS: Kind[] = [
  { id: 'breathing', title: 'Breathe', prompt: 'Breathe in as the circle grows, out as it shrinks.', minutes: 3, color: PALETTE.green, shape: 'circle', mood: 'calm' },
  { id: 'eye_rest', title: 'Rest your eyes', prompt: 'Look at something 20 feet away. Blink slowly.', minutes: 1, color: PALETTE.blue, shape: 'blob', mood: 'sleepy' },
  { id: 'stretch', title: 'Stretch', prompt: 'Roll your shoulders, stretch your neck, reach up high.', minutes: 5, color: PALETTE.yellow, shape: 'bolt', mood: 'happy' },
  { id: 'walk', title: 'Short walk', prompt: 'Step away from the screen and walk around.', minutes: 5, color: PALETTE.orange, shape: 'squircle', mood: 'wink' },
]

export function BreakPage() {
  const [params] = useSearchParams()
  const after = params.get('after')
  const navigate = useNavigate()
  const toast = useToast()
  const { refreshUser } = useAuth()
  const [kind, setKind] = useState<Kind | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [awards, setAwards] = useState<Award[] | null>(null)
  const [busy, setBusy] = useState(false)

  const goHome = () => navigate('/')
  const left = kind ? Math.max(0, kind.minutes * 60000 - (now - startedAt)) : 0
  const inhale = Math.floor((now - startedAt) / 4000) % 2 === 0

  const finish = useCallback(async () => {
    if (!sessionId || busy) return
    setBusy(true)
    try {
      const res = await api.post<{ awards: Award[] }>(`/sessions/${sessionId}/complete`)
      setAwards(res.awards)
      await refreshUser()
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [sessionId, busy, refreshUser, toast])

  useEffect(() => {
    if (!kind || awards) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [kind, awards])

  useEffect(() => {
    if (kind && !awards && left === 0) void finish()
  }, [kind, awards, left, finish])

  async function start(k: Kind) {
    try {
      const res = await api.post<{ session: { id: string } }>('/sessions', {
        type: 'break',
        breakKind: k.id,
        plannedMin: k.minutes,
        platform: 'web',
        ...(after ? { afterSessionId: after } : {}),
      })
      setSessionId(res.session.id)
      setStartedAt(Date.now())
      setNow(Date.now())
      setKind(k)
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-5">
      <header className="flex items-center gap-2">
        <button type="button" aria-label="Back" onClick={goHome} className="rounded-full p-2 hover:bg-ink/5">
          <ChevronLeftIcon />
        </button>
        <h1 className="font-display text-2xl font-extrabold">Mindful break</h1>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-4 py-6">
        {awards ? (
          <div className="animate-pop rounded-[1.9rem] bg-green p-6 text-center">
            <Face mood="happy" color="#fff" size={80} className="mx-auto" />
            <h2 className="my-3 font-display text-2xl font-extrabold">Nicely done</h2>
            <AwardList awards={awards} />
            <Button full className="mt-5" onClick={goHome}>
              Back to dashboard
            </Button>
          </div>
        ) : kind ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div
              className="transition-transform duration-[4000ms] ease-in-out"
              style={{ transform: kind.id === 'breathing' && !inhale ? 'scale(0.7)' : 'scale(1)' }}
            >
              <Face shape={kind.shape} mood={kind.mood} color={kind.color} size={200} />
            </div>
            <p className="max-w-xs text-lg">{kind.prompt}</p>
            <p className="font-display text-5xl font-extrabold tabular-nums" role="timer">
              {formatLeft(left)}
            </p>
            <Button variant="outline" disabled={busy} onClick={finish}>
              I&apos;m done
            </Button>
          </div>
        ) : (
          <>
            <p className="font-display text-xl font-bold">Pick a mindful break</p>
            <ul className="flex flex-col gap-2.5">
              {KINDS.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => start(k)}
                    className="flex w-full items-center gap-4 rounded-[1.625rem] bg-paper p-3 text-left transition-transform hover:scale-[1.01]"
                  >
                    <Face shape={k.shape} mood={k.mood} color={k.color} size={56} />
                    <span>
                      <span className="block font-display text-lg font-bold">{k.title}</span>
                      <span className="text-sm">{k.minutes} min</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  )
}
