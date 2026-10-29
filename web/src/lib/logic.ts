import type { Award, SessionRec, UnlockApp } from './types'

export const AWARD_LABELS: Record<string, string> = {
  focus_complete: 'Focus time',
  clean_bonus: 'No-distraction bonus',
  break_complete: 'Mindful break',
  goal_achieved: 'Daily goal reached',
  streak_bonus: 'Streak bonus',
  level_up: 'Level up!',
  challenge_reward: 'Challenge complete',
  screen_limit_kept: 'Stayed under screen limit',
  reward_redeem: 'Reward bought',
  donation: 'Donation pledge',
  streak_freeze: 'Streak freeze',
  app_unlock: 'App unlocked',
}

export const awardLabel = (reason: string) => AWARD_LABELS[reason] ?? reason

export const awardTotal = (awards: Award[]) => awards.reduce((n, a) => n + a.amount, 0)

/** Progress through the daily goal, 0..1. */
export function goalProgress(done: number, target: number): number {
  return target <= 0 ? 0 : Math.min(1, done / target)
}

/** "14:32" for a countdown in milliseconds. */
export function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Milliseconds left on an unlock at [now], or null when locked or expired. */
export function remainingMs(app: Pick<UnlockApp, 'unlockedUntil'>, now: number): number | null {
  if (!app.unlockedUntil) return null
  const left = new Date(app.unlockedUntil).getTime() - now
  return left > 0 ? left : null
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

/** Completed focus minutes per local calendar day, keyed "y-m-d". */
export function minutesByDay(sessions: SessionRec[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const s of sessions) {
    if (s.type !== 'focus' || s.status !== 'completed') continue
    const key = dayKey(new Date(s.startedAt))
    totals.set(key, (totals.get(key) ?? 0) + s.actualMin)
  }
  return totals
}

export interface DayMinutes {
  day: Date
  minutes: number
}

/** The last [days] local days, oldest first and ending today. */
export function focusMinutesByDay(sessions: SessionRec[], now: Date, days = 7): DayMinutes[] {
  const totals = minutesByDay(sessions)
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i))
    return { day, minutes: totals.get(dayKey(day)) ?? 0 }
  })
}

export type DayMood = 'future' | 'none' | 'some' | 'goal'

export interface CalendarCell {
  day: Date
  minutes: number
  mood: DayMood
}

/** The month containing [anchor] as a Sunday-first grid: nulls pad the first week, then one cell per day. */
export function monthCells(anchor: Date, sessions: SessionRec[], now: Date, goalMin: number): (CalendarCell | null)[] {
  const totals = minutesByDay(sessions)
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const cells: (CalendarCell | null)[] = Array.from({ length: first.getDay() }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), d)
    const minutes = totals.get(dayKey(day)) ?? 0
    const mood: DayMood = day > today ? 'future' : goalMin > 0 && minutes >= goalMin ? 'goal' : minutes > 0 ? 'some' : 'none'
    cells.push({ day, minutes, mood })
  }
  return cells
}

/** Reward slug to how the avatar item looks. One table, used wherever an avatar is drawn. */
export interface AvatarVisual {
  emoji?: string
  color?: string
}

export const AVATAR_VISUALS: Record<string, AvatarVisual> = {
  'hat-beanie': { emoji: '🧢' },
  'hat-headphones': { emoji: '🎧' },
  'hat-crown': { emoji: '👑' },
  'outfit-hoodie': { emoji: '🧥' },
  'outfit-yoga': { emoji: '🧘' },
  'bg-forest': { color: '#2E7D32' },
  'bg-ocean': { color: '#0277BD' },
}

/** Equipped items by slot, resolved from reward ids (as the API stores them) via the catalog's id to slug map. */
export function equippedVisuals(equippedIds: Record<string, string>, slugById: Record<string, string>): Record<string, AvatarVisual> {
  const out: Record<string, AvatarVisual> = {}
  for (const [slot, id] of Object.entries(equippedIds)) {
    const visual = AVATAR_VISUALS[slugById[id]]
    if (visual) out[slot] = visual
  }
  return out
}

export const baseEmoji = (base: string) => (base === 'fox' ? '🦊' : '🙂')

/** Reward estimate shown before a focus session: 1 token per minute plus the 20% clean bonus. */
export const estimateTokens = (minutes: number) => minutes + Math.round(minutes * 0.2)

/** Browser time zone, e.g. "Asia/Kolkata". */
export function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}
