import { useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/hooks'
import { goalProgress } from '../lib/logic'
import { useToast } from '../lib/toast'
import type { ChallengeEntry, LeaderboardEntry } from '../lib/types'
import { PALETTE } from '../ui/Face'
import { Button, Card, ErrorRetry, PageTitle, Spinner, Tokens } from '../ui/kit'

type Tab = 'challenges' | 'friends' | 'global'
const TABS: { id: Tab; label: string }[] = [
  { id: 'challenges', label: 'Challenges' },
  { id: 'friends', label: 'Friends' },
  { id: 'global', label: 'Global' },
]

export function SocialPage() {
  const [tab, setTab] = useState<Tab>('challenges')
  return (
    <>
      <PageTitle>Challenges &amp; leaderboard</PageTitle>
      <div role="tablist" aria-label="Sections" className="mb-4 flex gap-1 rounded-full bg-paper p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-10 flex-1 rounded-full font-bold transition-colors ${tab === t.id ? 'bg-ink text-white' : 'hover:bg-mist'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'challenges' ? <Challenges /> : <Leaderboard scope={tab} />}
    </>
  )
}

function Challenges() {
  const { refreshUser } = useAuth()
  const toast = useToast()
  const list = useFetch(async () => (await api.get<{ items: ChallengeEntry[] }>('/challenges')).items)

  if (list.loading) return <Spinner />
  if (list.error || !list.data) return <ErrorRetry message={list.error ?? 'Something went wrong'} onRetry={list.reload} />
  if (list.data.length === 0) return <p className="py-10 text-center">No active challenges this week.</p>

  async function act(path: string, done: string) {
    try {
      await api.post(path)
      await Promise.all([list.reload(), refreshUser()])
      toast(done)
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  const tints = [PALETTE.orange, PALETTE.purple, PALETTE.green, PALETTE.blue]
  return (
    <ul className="flex flex-col gap-3">
      {list.data.map(({ challenge: c, progress }, i) => {
        const claimed = Boolean(progress?.claimedAt)
        return (
          <li key={c.id} className="rounded-[1.625rem] p-4" style={{ background: tints[i % tints.length] }}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold">{c.title}</h2>
              <span className="rounded-full bg-white/70 px-3 py-1 text-sm">
                <Tokens amount={c.rewardTokens} />
              </span>
            </div>
            <p className="mt-1 text-sm">{c.description}</p>
            <div className="mt-3">
              {progress === null ? (
                <Button small onClick={() => act(`/challenges/${c.id}/join`, 'Joined!')}>
                  Join
                </Button>
              ) : (
                <>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/60" role="progressbar" aria-valuenow={progress.progress} aria-valuemax={c.target} aria-label={`${c.title} progress`}>
                    <div className="h-full rounded-full bg-ink" style={{ width: `${goalProgress(progress.progress, c.target) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-sm font-bold">
                    {progress.progress} / {c.target}
                  </p>
                  {progress.completed && !claimed && (
                    <Button small className="mt-2" onClick={() => act(`/challenges/${c.id}/claim`, 'Reward claimed!')}>
                      Claim reward
                    </Button>
                  )}
                  {claimed && <p className="mt-2 text-sm font-bold">Reward claimed ✓</p>}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Leaderboard({ scope }: { scope: 'friends' | 'global' }) {
  const board = useFetch(async () => (await api.get<{ entries: LeaderboardEntry[] }>('/leaderboard', { scope })).entries, [scope])
  if (board.loading) return <Spinner />
  if (board.error || !board.data) return <ErrorRetry message={board.error ?? 'Something went wrong'} onRetry={board.reload} />
  if (board.data.length === 0) {
    return <p className="py-10 text-center">{scope === 'friends' ? 'Add friends from your profile to compete.' : 'No focus logged this week yet.'}</p>
  }
  return (
    <ol className="flex flex-col gap-2">
      {board.data.map((e) => (
        <li key={`${e.rank}-${e.displayName}`}>
          <Card className={`flex items-center gap-3 !p-3 ${e.isMe ? 'ring-2 ring-ink' : ''}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple font-bold">{e.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{e.isMe ? `${e.displayName} (you)` : e.displayName}</p>
              <p className="text-xs text-muted">Level {e.level}</p>
            </div>
            <span className="font-bold">{e.focusMin} min</span>
          </Card>
        </li>
      ))}
    </ol>
  )
}
