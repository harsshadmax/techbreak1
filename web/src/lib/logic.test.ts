import { describe, expect, it } from 'vitest'
import { awardTotal, equippedVisuals, estimateTokens, focusMinutesByDay, formatLeft, goalProgress, minutesByDay, monthCells, remainingMs } from './logic'
import type { SessionRec } from './types'

const focus = (startedAt: Date, actualMin: number, extra: Partial<SessionRec> = {}): SessionRec => ({
  type: 'focus',
  status: 'completed',
  actualMin,
  startedAt: startedAt.toISOString(),
  tokensAwarded: 0,
  ...extra,
})

describe('goalProgress', () => {
  it('is clamped to 0..1', () => {
    expect(goalProgress(90, 60)).toBe(1)
    expect(goalProgress(30, 120)).toBe(0.25)
    expect(goalProgress(10, 0)).toBe(0)
  })
})

describe('awards', () => {
  it('adds up the breakdown', () => {
    expect(awardTotal([{ amount: 25, reason: 'focus_complete' }, { amount: 5, reason: 'clean_bonus' }, { amount: 30, reason: 'goal_achieved' }, { amount: 5, reason: 'streak_bonus' }])).toBe(65)
  })
  it('estimates 1 token per minute plus 20%', () => {
    expect(estimateTokens(25)).toBe(30)
  })
})

describe('countdowns', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatLeft((14 * 60 + 32) * 1000)).toBe('14:32')
    expect(formatLeft(9 * 60000 + 5000)).toBe('9:05')
    expect(formatLeft(-5)).toBe('0:00')
  })
  it('is null when locked or expired and counts down while open', () => {
    const now = Date.parse('2026-10-30T12:00:00Z')
    expect(remainingMs({ unlockedUntil: null }, now)).toBeNull()
    expect(remainingMs({ unlockedUntil: '2026-10-30T11:59:59Z' }, now)).toBeNull()
    expect(remainingMs({ unlockedUntil: '2026-10-30T12:00:00Z' }, now)).toBeNull()
    expect(remainingMs({ unlockedUntil: '2026-10-30T12:14:32Z' }, now)).toBe((14 * 60 + 32) * 1000)
  })
})

describe('focus calendar', () => {
  const now = new Date(2026, 9, 29, 12)

  it('groups completed focus sessions by local day and ignores breaks and abandoned ones', () => {
    const days = focusMinutesByDay(
      [
        focus(new Date(2026, 9, 29, 9), 25),
        focus(new Date(2026, 9, 29, 11), 20),
        focus(new Date(2026, 9, 27, 9), 45),
        focus(new Date(2026, 9, 28, 9), 30, { status: 'abandoned' }),
        focus(new Date(2026, 9, 28, 10), 5, { type: 'break' }),
        focus(new Date(2026, 9, 1, 9), 60),
      ],
      now,
    )
    expect(days).toHaveLength(7)
    expect(days.at(-1)!.minutes).toBe(45)
    expect(days[4].minutes).toBe(45)
    expect(days[5].minutes).toBe(0)
    expect(days.reduce((n, d) => n + d.minutes, 0)).toBe(90)
    expect(minutesByDay([focus(new Date(2026, 9, 1, 9), 60)]).size).toBe(1)
  })

  it('pads the first week and has one cell per day', () => {
    const cells = monthCells(now, [], now, 20)
    // 1 Oct 2026 is a Thursday, so four blanks come first.
    expect(cells.slice(0, 4).every((c) => c === null)).toBe(true)
    expect(cells.filter(Boolean)).toHaveLength(31)
    expect(cells[4]!.day.getDate()).toBe(1)
  })

  it('marks goal days, some-focus days, empty days and the future', () => {
    const cells = monthCells(now, [focus(new Date(2026, 9, 27, 9), 25), focus(new Date(2026, 9, 28, 9), 10)], now, 20).filter(Boolean)
    const mood = (day: number) => cells[day - 1]!.mood
    expect(mood(27)).toBe('goal')
    expect(mood(28)).toBe('some')
    expect(mood(26)).toBe('none')
    expect(mood(30)).toBe('future')
  })
})

describe('avatar', () => {
  it('resolves reward ids to visuals via slugs', () => {
    const visuals = equippedVisuals({ hat: 'id-beanie', background: 'id-forest', outfit: 'id-unknown' }, { 'id-beanie': 'hat-beanie', 'id-forest': 'bg-forest' })
    expect(visuals.hat.emoji).toBe('🧢')
    expect(visuals.background.color).toBeTruthy()
    expect(visuals.outfit).toBeUndefined()
  })
})
