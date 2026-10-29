import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { markOnboarded } from '../lib/onboarding'
import { useToast } from '../lib/toast'
import type { User } from '../lib/types'
import { Face, PALETTE, type FaceMood, type FaceShape } from '../ui/Face'
import { Button } from '../ui/kit'

const SLIDES: { shape: FaceShape; mood: FaceMood; color: string; title: string; body: string }[] = [
  { shape: 'circle', mood: 'calm', color: PALETTE.green, title: 'Earn tokens for focus', body: 'Start a focus session and earn a token for every minute you stay off your phone.' },
  { shape: 'blob', mood: 'sleepy', color: PALETTE.blue, title: 'Take mindful breaks', body: 'Breathe, rest your eyes or stretch between sessions. Breaks earn bonus tokens too.' },
  { shape: 'bolt', mood: 'happy', color: PALETTE.yellow, title: 'Unlock your apps', body: 'Spend tokens on timed access to Instagram, YouTube and more, guilt free.' },
]

export function OnboardingPage() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [goal, setGoal] = useState(120)
  const [saving, setSaving] = useState(false)
  const last = page === SLIDES.length

  async function finish() {
    if (!user) return
    setSaving(true)
    try {
      const res = await api.patch<{ user: User }>('/me', { settings: { dailyFocusGoalMin: goal } })
      await api.put('/goals/today', { focusTargetMin: goal })
      setUser(res.user)
    } catch (e) {
      toast(errorMessage(e))
    }
    markOnboarded(user.id)
    navigate('/', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <div className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        {last ? (
          <>
            <h1 className="font-display text-3xl font-extrabold">Set your daily focus goal</h1>
            <p className="mt-6 font-display text-5xl font-extrabold">{goal} minutes</p>
            <input
              type="range"
              min={10}
              max={300}
              step={10}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              aria-label="Daily focus goal in minutes"
              className="mt-6 w-full accent-ink"
            />
            <p className="mt-4 text-sm">You can change this any time in your profile.</p>
          </>
        ) : (
          <div key={page} className="animate-pop flex flex-col items-center">
            <Face shape={SLIDES[page].shape} mood={SLIDES[page].mood} color={SLIDES[page].color} size={180} />
            <h1 className="mt-7 font-display text-3xl font-extrabold">{SLIDES[page].title}</h1>
            <p className="mt-3 text-lg">{SLIDES[page].body}</p>
          </div>
        )}
      </div>

      <div className="mb-5 flex justify-center gap-2" aria-hidden="true">
        {Array.from({ length: SLIDES.length + 1 }, (_, i) => (
          <span key={i} className={`h-2 rounded-full transition-all ${i === page ? 'w-5 bg-ink' : 'w-2 bg-ink/20'}`} />
        ))}
      </div>
      <Button full disabled={saving} onClick={last ? finish : () => setPage((p) => p + 1)}>
        {last ? "Let's go" : 'Next'}
      </Button>
    </main>
  )
}
