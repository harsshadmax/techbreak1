import {
  RULES,
  advanceStreak,
  applyDailyCap,
  breakAwards,
  focusAwards,
  levelForXp,
  rolloverStreak,
  sessionMinutes,
  streakBonus,
  xpForLevel,
  type Streak,
} from '../src/modules/tokens/engine';

const streak = (s: Partial<Streak>): Streak => ({ current: 0, longest: 0, lastActiveDate: null, freezes: 0, ...s });

describe('sessionMinutes', () => {
  const start = new Date('2026-10-28T10:00:00Z');
  it('uses elapsed server time, capped by the planned length', () => {
    expect(sessionMinutes(start, new Date('2026-10-28T10:30:00Z'), 25)).toBe(25);
    expect(sessionMinutes(start, new Date('2026-10-28T10:12:30Z'), 25)).toBe(12);
  });
  it('never exceeds the max session length', () => {
    expect(sessionMinutes(start, new Date('2026-10-28T15:00:00Z'), 500)).toBe(RULES.maxSessionMin);
  });
});

describe('focusAwards', () => {
  it('pays per minute plus a clean bonus with no interruptions', () => {
    expect(focusAwards({ actualMin: 25, interruptions: 0, focusMinToday: 0 })).toEqual([
      { amount: 25, reason: 'focus_complete' },
      { amount: 5, reason: 'clean_bonus' },
    ]);
  });
  it('drops the clean bonus when interrupted', () => {
    expect(focusAwards({ actualMin: 25, interruptions: 1, focusMinToday: 0 })).toEqual([{ amount: 25, reason: 'focus_complete' }]);
  });
  it('pays nothing for short or heavily interrupted sessions', () => {
    expect(focusAwards({ actualMin: 9, interruptions: 0, focusMinToday: 0 })).toEqual([]);
    expect(focusAwards({ actualMin: 25, interruptions: 3, focusMinToday: 0 })).toEqual([]);
  });
  it('stops crediting past the daily focus maximum', () => {
    expect(focusAwards({ actualMin: 60, interruptions: 1, focusMinToday: RULES.maxDailyFocusMin - 20 })).toEqual([
      { amount: 20, reason: 'focus_complete' },
    ]);
  });
});

describe('breakAwards', () => {
  const focusEndedAt = new Date('2026-10-28T10:25:00Z');
  it('rewards a break started soon after focus', () => {
    expect(breakAwards({ actualMin: 5, focusEndedAt, breakStartedAt: new Date('2026-10-28T10:30:00Z'), alreadyRewarded: false })).toEqual([
      { amount: RULES.breakReward, reason: 'break_complete' },
    ]);
  });
  it('ignores late, duplicate or orphan breaks', () => {
    const late = new Date('2026-10-28T10:40:00Z');
    expect(breakAwards({ actualMin: 5, focusEndedAt, breakStartedAt: late, alreadyRewarded: false })).toEqual([]);
    expect(breakAwards({ actualMin: 5, focusEndedAt, breakStartedAt: focusEndedAt, alreadyRewarded: true })).toEqual([]);
    expect(breakAwards({ actualMin: 5, focusEndedAt: null, breakStartedAt: focusEndedAt, alreadyRewarded: false })).toEqual([]);
  });
});

describe('applyDailyCap', () => {
  it('trims capped activity rewards but leaves milestone rewards alone', () => {
    const awards = applyDailyCap(
      [
        { amount: 25, reason: 'focus_complete' },
        { amount: 5, reason: 'clean_bonus' },
        { amount: 30, reason: 'goal_achieved' },
      ],
      390,
      400,
    );
    expect(awards).toEqual([
      { amount: 10, reason: 'focus_complete' },
      { amount: 30, reason: 'goal_achieved' },
    ]);
  });
});

describe('streaks', () => {
  it('extends on consecutive days and restarts after a gap', () => {
    expect(advanceStreak(streak({ current: 3, longest: 3, lastActiveDate: '2026-10-27' }), '2026-10-28')).toMatchObject({ current: 4, longest: 4 });
    expect(advanceStreak(streak({ current: 3, longest: 5, lastActiveDate: '2026-10-25' }), '2026-10-28')).toMatchObject({ current: 1, longest: 5 });
  });
  it('does not double count the same day', () => {
    const s = streak({ current: 2, lastActiveDate: '2026-10-28' });
    expect(advanceStreak(s, '2026-10-28')).toBe(s);
  });
  it('caps the streak bonus', () => {
    expect(streakBonus(3)).toBe(15);
    expect(streakBonus(40)).toBe(RULES.streakBonusCap);
  });
  it('rollover keeps an active streak, spends a freeze for one missed day, else resets', () => {
    expect(rolloverStreak(streak({ current: 4, lastActiveDate: '2026-10-27' }), '2026-10-28').streak.current).toBe(4);
    const frozen = rolloverStreak(streak({ current: 4, lastActiveDate: '2026-10-26', freezes: 1 }), '2026-10-28');
    expect(frozen).toEqual({ streak: expect.objectContaining({ current: 4, freezes: 0, lastActiveDate: '2026-10-27' }), usedFreeze: true });
    expect(rolloverStreak(streak({ current: 4, lastActiveDate: '2026-10-26' }), '2026-10-28').streak.current).toBe(0);
  });
});

describe('levels', () => {
  it('maps XP to levels using 100 × level^1.5 steps', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(383);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(400)).toBe(3);
  });
});
