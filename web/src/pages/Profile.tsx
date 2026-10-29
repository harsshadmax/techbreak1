import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import type { User } from '../lib/types'
import { ChartIcon, ChevronRightIcon, CopyIcon, FlagIcon, FlameIcon, LogoutIcon, UserPlusIcon } from '../ui/Icons'
import { Avatar, Button, Card, PageTitle, Sheet, Tokens } from '../ui/kit'

export function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const [dialog, setDialog] = useState<'goal' | 'friend' | null>(null)
  const [goal, setGoal] = useState(120)
  const [code, setCode] = useState('')

  if (!user) return null

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(user!.inviteCode)
      toast('Invite code copied')
    } catch {
      toast(`Your invite code is ${user!.inviteCode}`)
    }
  }

  async function saveGoal() {
    try {
      const res = await api.patch<{ user: User }>('/me', { settings: { dailyFocusGoalMin: goal } })
      setUser(res.user)
      setDialog(null)
      toast('Saved. Applies from tomorrow')
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  async function addFriend(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    try {
      const res = await api.post<{ friend: { displayName: string } }>('/friends', { inviteCode: code.trim() })
      setDialog(null)
      setCode('')
      toast(`You and ${res.friend.displayName} are now friends`)
    } catch (err) {
      toast(errorMessage(err))
    }
  }

  return (
    <>
      <PageTitle>Profile</PageTitle>
      <div className="flex flex-col items-center gap-1 pt-4 pb-5 text-center">
        <Avatar user={user} size={88} />
        <h2 className="mt-3 font-display text-2xl font-extrabold">{user.displayName}</h2>
        <p className="text-sm">
          Level {user.level} · {user.xp} XP
        </p>
        <Tokens amount={user.tokenBalance} className="text-lg" />
      </div>

      <Card className="!p-1.5">
        <ul className="divide-y divide-ink/10">
          <Row icon={<FlameIcon />} title="Streak" subtitle={`Longest: ${user.streak.longest} days · Freezes: ${user.streak.freezes}`} right={<span className="font-display text-2xl font-extrabold">{user.streak.current}</span>} />
          <Row
            icon={<FlagIcon />}
            title="Daily focus goal"
            subtitle={`${user.settings.dailyFocusGoalMin} minutes`}
            right={<ChevronRightIcon />}
            onClick={() => {
              setGoal(Math.min(300, Math.max(30, user.settings.dailyFocusGoalMin)))
              setDialog('goal')
            }}
          />
          <Row icon={<ChartIcon />} title="Insights" right={<ChevronRightIcon />} to="/insights" />
          <Row
            icon={<CopyIcon />}
            title="Your invite code"
            subtitle={user.inviteCode}
            right={
              <button type="button" aria-label="Copy invite code" onClick={copyCode} className="rounded-full p-2 hover:bg-mist">
                <CopyIcon />
              </button>
            }
          />
          <Row icon={<UserPlusIcon />} title="Add a friend" onClick={() => setDialog('friend')} />
        </ul>
      </Card>

      <Button variant="outline" full className="mt-4" onClick={logout}>
        <LogoutIcon className="h-5 w-5" /> Sign out
      </Button>

      <Sheet open={dialog === 'goal'} onClose={() => setDialog(null)} label="Daily focus goal">
        <h2 className="font-display text-2xl font-extrabold">Daily focus goal</h2>
        <p className="mt-3 text-center font-display text-4xl font-extrabold">{goal} minutes</p>
        <input type="range" min={30} max={300} step={30} value={goal} onChange={(e) => setGoal(Number(e.target.value))} aria-label="Daily focus goal in minutes" className="my-4 w-full accent-ink" />
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button onClick={saveGoal}>Save</Button>
        </div>
      </Sheet>

      <Sheet open={dialog === 'friend'} onClose={() => setDialog(null)} label="Add a friend">
        <form onSubmit={addFriend} className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-extrabold">Add a friend</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Friend&apos;s invite code</span>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full rounded-2xl bg-lavender px-4 py-3.5 text-lg tracking-widest uppercase outline-none focus:ring-2 focus:ring-ink"
            />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Sheet>
    </>
  )
}

interface RowProps {
  icon: ReactNode
  title: string
  subtitle?: string
  right?: ReactNode
  onClick?: () => void
  to?: string
}

function Row({ icon, title, subtitle, right, onClick, to }: RowProps) {
  const inner = (
    <>
      <span className="text-ink/70">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-bold">{title}</span>
        {subtitle && <span className="block text-sm text-muted">{subtitle}</span>}
      </span>
      {right}
    </>
  )
  const cls = 'flex w-full items-center gap-3 rounded-2xl px-3 py-3 hover:bg-mist/60'
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  )
}
