/**
 * Token Engine rules. Everything here is pure so it can be unit-tested and tuned
 * without a database. The ledger (ledger.ts) applies the results transactionally.
 */
import { env } from '../../config/env';
import { addDays } from '../../utils/date';

export type EarnReason =
  | 'focus_complete'
  | 'clean_bonus'
  | 'break_complete'
  | 'goal_achieved'
  | 'screen_limit_kept'
  | 'streak_bonus'
  | 'challenge_reward'
  | 'level_up';

export type BurnReason = 'reward_redeem' | 'donation' | 'streak_freeze' | 'app_unlock';

export interface Award {
  amount: number;
  reason: EarnReason;
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  freezes: number;
}

export const RULES = {
  tokensPerMinute: 1,
  minFocusMin: 10,
  maxInterruptions: 2,
  cleanBonusPct: 0.2,
  breakReward: 5,
  breakWindowMin: 10,
  minBreakMin: 1,
  goalBonus: 30,
  screenLimitBonus: 20,
  streakBonusPerDay: 5,
  streakBonusCap: 50,
  levelUpBonus: 50,
  maxSessionMin: 120,
  maxDailyFocusMin: 480,
  maxStreakFreezes: 2,
  get dailyEarnCap() {
    return env.dailyEarnCap;
  },
};

export interface UnlockableApp {
  id: string;
  name: string;
  category: 'social' | 'streaming';
  /** Tokens spent per unlock. */
  cost: number;
  /** Minutes of access one unlock buys. */
  minutes: number;
}

/** Apps users can unlock for a limited time by spending tokens. The app only records the time window. */
export const APP_CATALOG: readonly UnlockableApp[] = [
  { id: 'instagram', name: 'Instagram', category: 'social', cost: 30, minutes: 15 },
  { id: 'snapchat', name: 'Snapchat', category: 'social', cost: 20, minutes: 10 },
  { id: 'tiktok', name: 'TikTok', category: 'social', cost: 30, minutes: 15 },
  { id: 'youtube', name: 'YouTube', category: 'streaming', cost: 40, minutes: 20 },
  { id: 'netflix', name: 'Netflix', category: 'streaming', cost: 60, minutes: 30 },
  { id: 'spotify', name: 'Spotify', category: 'streaming', cost: 15, minutes: 10 },
];

/** Activity rewards count toward the daily cap; milestone rewards don't. */
export const CAPPED_REASONS: readonly EarnReason[] = ['focus_complete', 'clean_bonus', 'break_complete'];

/** Minutes the server credits for a session, based on server timestamps only. */
export function sessionMinutes(startedAt: Date, endedAt: Date, plannedMin: number): number {
  const elapsed = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000);
  return Math.max(0, Math.min(elapsed, plannedMin, RULES.maxSessionMin));
}

export function focusAwards(input: { actualMin: number; interruptions: number; focusMinToday: number }): Award[] {
  const { actualMin, interruptions, focusMinToday } = input;
  if (actualMin < RULES.minFocusMin || interruptions > RULES.maxInterruptions) return [];
  const credited = Math.max(0, Math.min(actualMin, RULES.maxDailyFocusMin - focusMinToday));
  if (credited === 0) return [];
  const base = credited * RULES.tokensPerMinute;
  const awards: Award[] = [{ amount: base, reason: 'focus_complete' }];
  if (interruptions === 0) awards.push({ amount: Math.round(base * RULES.cleanBonusPct), reason: 'clean_bonus' });
  return awards;
}

/** A break earns tokens if it lasted long enough and started soon after the focus session it follows. */
export function breakAwards(input: { actualMin: number; focusEndedAt: Date | null; breakStartedAt: Date; alreadyRewarded: boolean }): Award[] {
  const { actualMin, focusEndedAt, breakStartedAt, alreadyRewarded } = input;
  if (alreadyRewarded || !focusEndedAt || actualMin < RULES.minBreakMin) return [];
  const gapMs = breakStartedAt.getTime() - focusEndedAt.getTime();
  if (gapMs < 0 || gapMs > RULES.breakWindowMin * 60000) return [];
  return [{ amount: RULES.breakReward, reason: 'break_complete' }];
}

/** Trim capped awards so the user's capped earnings for the day never exceed the cap. */
export function applyDailyCap(awards: Award[], cappedEarnedToday: number, cap = RULES.dailyEarnCap): Award[] {
  let room = Math.max(0, cap - cappedEarnedToday);
  return awards
    .map((a) => {
      if (!CAPPED_REASONS.includes(a.reason)) return a;
      const amount = Math.min(a.amount, room);
      room -= amount;
      return { ...a, amount };
    })
    .filter((a) => a.amount > 0);
}

/** Called when the user hits their daily goal: extend or restart the streak. */
export function advanceStreak(streak: Streak, today: string): Streak {
  if (streak.lastActiveDate === today) return streak;
  const current = streak.lastActiveDate === addDays(today, -1) ? streak.current + 1 : 1;
  return { ...streak, current, longest: Math.max(streak.longest, current), lastActiveDate: today };
}

export function streakBonus(current: number): number {
  return Math.min(current * RULES.streakBonusPerDay, RULES.streakBonusCap);
}

/**
 * Called once per user per local day. If yesterday was missed, spend a freeze to
 * bridge it, otherwise reset the streak.
 */
export function rolloverStreak(streak: Streak, today: string): { streak: Streak; usedFreeze: boolean } {
  const yesterday = addDays(today, -1);
  if (streak.current === 0 || !streak.lastActiveDate || streak.lastActiveDate >= yesterday) {
    return { streak, usedFreeze: false };
  }
  if (streak.freezes > 0 && streak.lastActiveDate === addDays(today, -2)) {
    return { streak: { ...streak, freezes: streak.freezes - 1, lastActiveDate: yesterday }, usedFreeze: true };
  }
  return { streak: { ...streak, current: 0 }, usedFreeze: false };
}

/** Total XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let k = 1; k < level; k++) total += Math.round(100 * k ** 1.5);
  return total;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function sumAwards(awards: Award[]): number {
  return awards.reduce((n, a) => n + a.amount, 0);
}
