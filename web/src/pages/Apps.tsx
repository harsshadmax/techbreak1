import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch, useNow } from '../lib/hooks'
import { formatLeft, remainingMs } from '../lib/logic'
import { useToast } from '../lib/toast'
import type { UnlockApp, User } from '../lib/types'
import { Face, FACE_SHAPES, PALETTE } from '../ui/Face'
import { LockIcon, UnlockIcon } from '../ui/Icons'
import { Button, ErrorRetry, PageTitle, Sheet, Spinner, TokenPill } from '../ui/kit'

const TINTS = [PALETTE.orange, PALETTE.yellow, PALETTE.coral, PALETTE.purple, PALETTE.blue, PALETTE.green]

interface AppsResponse {
  now: string
  items: UnlockApp[]
}

export function AppsPage() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const now = useNow()
  const apps = useFetch(() => api.get<AppsResponse>('/apps'))
  const [selected, setSelected] = useState<UnlockApp | null>(null)
  const [busy, setBusy] = useState(false)
  // Server time minus device time when the list was fetched, so a wrong device clock doesn't matter.
  const offset = useMemo(() => (apps.data ? new Date(apps.data.now).getTime() - Date.now() : 0), [apps.data])

  if (apps.loading) return <Spinner />
  if (apps.error || !apps.data) return <ErrorRetry message={apps.error ?? 'Something went wrong'} onRetry={apps.reload} />

  const clock = now + offset
  const balance = user?.tokenBalance ?? 0
  const left = selected ? remainingMs(selected, clock) : null

  async function unlock(app: UnlockApp) {
    setBusy(true)
    try {
      const res = await api.post<{ user: User }>(`/apps/${app.id}/unlock`)
      setUser(res.user)
      setSelected(null)
      toast(`${app.name} unlocked for ${app.minutes} min`)
      await apps.reload()
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageTitle right={<TokenPill amount={balance} />}>Unlock your apps</PageTitle>
      <p className="mb-4 text-sm">Spend tokens for guilt-free time.</p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {apps.data.items.map((app, i) => {
          const remaining = remainingMs(app, clock)
          const open = remaining !== null
          const shape = FACE_SHAPES[[...app.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % FACE_SHAPES.length]
          return (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => setSelected(app)}
                aria-label={open ? `${app.name} unlocked, ${Math.ceil(remaining / 60000)} minutes left` : `Unlock ${app.name} for ${app.cost} tokens`}
                className={`flex aspect-[0.95] w-full flex-col justify-between rounded-[1.625rem] p-4 text-left transition-transform hover:scale-[1.02] ${
                  open ? 'ring-[3px] ring-ink' : ''
                }`}
                style={{ background: TINTS[i % TINTS.length] }}
              >
                <span className="flex w-full items-start justify-between">
                  <Face shape={shape} mood={open ? 'happy' : 'sleepy'} color="rgba(255,255,255,0.7)" size={52} />
                  {open ? <UnlockIcon className="h-5 w-5" /> : <LockIcon className="h-5 w-5" />}
                </span>
                <span>
                  <span className="block font-display text-xl font-extrabold">{app.name}</span>
                  <span className="mt-1 block text-xs">
                    {open ? `Unlocked · ${formatLeft(remaining)} left` : `${app.minutes} min · ${app.cost} tokens`}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs">TechBreak tracks the time you unlock. It does not block other apps on your device.</p>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} label="Unlock app">
        {selected && (
          <div className="flex flex-col gap-3">
            {left !== null ? (
              <>
                <h2 className="font-display text-2xl font-extrabold">{selected.name} is open</h2>
                <p>{Math.ceil(left / 60000)} minutes left. It locks again by itself when the time is up.</p>
                <Button onClick={() => setSelected(null)}>Got it</Button>
              </>
            ) : balance >= selected.cost ? (
              <>
                <h2 className="font-display text-2xl font-extrabold">Unlock {selected.name}?</h2>
                <p>
                  {selected.minutes} minutes of access for {selected.cost} tokens. You will have {balance - selected.cost} tokens left.
                </p>
                <div className="mt-2 grid grid-cols-[1fr_2fr] gap-2.5">
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Not now
                  </Button>
                  <Button disabled={busy} onClick={() => unlock(selected)}>
                    Unlock for {selected.cost}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-extrabold">Not enough tokens</h2>
                <p>
                  {selected.name} costs {selected.cost} tokens and you have {balance}. A focus session earns more.
                </p>
                <div className="mt-2 grid grid-cols-[1fr_2fr] gap-2.5">
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Not now
                  </Button>
                  <Button onClick={() => navigate('/focus')}>Earn tokens</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>
    </>
  )
}
