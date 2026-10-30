/**
 * Fills the demo account (username "iker", password "123456") with five weeks of realistic mock data so every
 * screen has something to show: sessions, a token ledger that adds up, streak, level, purchases, an equipped
 * avatar, donations, app unlocks, challenges, friends and a leaderboard.
 *
 * Safe to re-run: everything belonging to the demo users is deleted and rebuilt. Run seed.ts first.
 *   npm run seed:demo
 */
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { env } from '../src/config/env';
import { AppUnlock } from '../src/modules/apps/appUnlock.model';
import { Challenge, ChallengeProgress } from '../src/modules/challenges/challenge.model';
import { Goal } from '../src/modules/goals/goal.model';
import { Donation, InventoryItem, Reward } from '../src/modules/rewards/reward.model';
import { Session } from '../src/modules/sessions/session.model';
import {
  APP_CATALOG,
  RULES,
  advanceStreak,
  focusAwards,
  levelForXp,
  streakBonus,
  type Award,
  type BurnReason,
  type EarnReason,
  type Streak,
} from '../src/modules/tokens/engine';
import { TokenTransaction } from '../src/modules/tokens/transaction.model';
import { User } from '../src/modules/users/user.model';
import { addDays, dayKey, weekStartUtc } from '../src/utils/date';

const TZ = 'Asia/Kolkata';
const GOAL_MIN = 60;
const SCREEN_LIMIT = 240;
const NOW = new Date();
const MIN = 60_000;
const TODAY = dayKey(NOW, TZ);

/** Total focus minutes per day, oldest first and ending today (today is a work in progress). */
const DAILY_FOCUS = [
  0, 70, 65, 0, 80, 45, 0, 60, 75, 0, 0, 90, 65, 60, 0, 60, 100, 70, 0, 65, 60, 80, 90, 60, 70, 65, 75, 60, 85, 60, 70, 90, 65, 80,
  35,
];

/** Purchases by how many days ago (0 = today), in the order they happened. */
const PURCHASES: { daysAgo: number; slug?: string; app?: string; reason: BurnReason }[] = [
  { daysAgo: 26, slug: 'hat-beanie', reason: 'reward_redeem' },
  { daysAgo: 22, app: 'instagram', reason: 'app_unlock' },
  { daysAgo: 20, slug: 'outfit-hoodie', reason: 'reward_redeem' },
  { daysAgo: 17, slug: 'donate-tree', reason: 'donation' },
  { daysAgo: 15, app: 'youtube', reason: 'app_unlock' },
  { daysAgo: 13, slug: 'bg-forest', reason: 'reward_redeem' },
  { daysAgo: 11, slug: 'hat-headphones', reason: 'reward_redeem' },
  { daysAgo: 9, slug: 'streak_freeze', reason: 'streak_freeze' },
  { daysAgo: 7, app: 'netflix', reason: 'app_unlock' },
  { daysAgo: 5, slug: 'outfit-yoga', reason: 'reward_redeem' },
  { daysAgo: 4, app: 'snapchat', reason: 'app_unlock' },
  { daysAgo: 3, slug: 'bg-ocean', reason: 'reward_redeem' },
  { daysAgo: 2, slug: 'hat-crown', reason: 'reward_redeem' },
  { daysAgo: 1, app: 'tiktok', reason: 'app_unlock' },
];

const FRIENDS = [
  { name: 'Maya Rao', email: 'maya@techbreak.test', code: 'MAYA0001', minutes: [60, 75, 45, 90], streak: 21 },
  { name: 'Noah Kim', email: 'noah@techbreak.test', code: 'NOAH0001', minutes: [45, 60, 30], streak: 9 },
  { name: 'Zoe Park', email: 'zoe@techbreak.test', code: 'ZOE00001', minutes: [50, 25], streak: 4 },
  { name: 'Liam Ortiz', email: 'liam@techbreak.test', code: 'LIAM0001', minutes: [20], streak: 1 },
];

const at = (key: string, hhmm: string) => new Date(`${key}T${hhmm}:00+05:30`);
const dayAgo = (n: number) => addDays(TODAY, -n);
const oid = () => new Types.ObjectId();

interface FocusSpec {
  id: Types.ObjectId;
  day: string;
  start: Date;
  minutes: number;
  interruptions: number;
}

type Event =
  | { t: Date; kind: 'focus'; spec: FocusSpec }
  | { t: Date; kind: 'break'; id: Types.ObjectId; afterId: Types.ObjectId; day: string; breakKind: string; minutes: number; start: Date }
  | { t: Date; kind: 'spend'; amount: number; reason: BurnReason; refId?: Types.ObjectId; day: string }
  | { t: Date; kind: 'bonus'; amount: number; reason: EarnReason; refId?: Types.ObjectId; day: string };

const BREAKS = [
  { kind: 'breathing', minutes: 3 },
  { kind: 'stretch', minutes: 5 },
  { kind: 'eye_rest', minutes: 1 },
  { kind: 'walk', minutes: 5 },
];

/** Split a day's focus minutes into one or two sessions. */
function split(total: number): number[] {
  if (total >= 90) return [45, total - 45];
  if (total >= 65) return [25, total - 25];
  return total > 0 ? [total] : [];
}

async function main() {
  await mongoose.connect(env.mongoUri);

  const rewards = new Map((await Reward.find()).map((r) => [r.slug, r]));
  if (rewards.size === 0) throw new Error('No rewards found. Run `npm run seed` first.');

  // 1. Users.
  const upsertUser = async (email: string, set: Record<string, unknown>, onInsert: Record<string, unknown>) => {
    await User.updateOne({ email }, { $set: set, $setOnInsert: onInsert }, { upsert: true });
    return (await User.findOne({ email }))!;
  };
  const iker = await upsertUser(
    'iker@techbreak.test',
    { username: 'iker', displayName: 'Iker', passwordHash: await bcrypt.hash('123456', 10), timezone: TZ },
    { inviteCode: 'IKER0001' },
  );
  const friendUsers = [];
  for (const f of FRIENDS) friendUsers.push(await upsertUser(f.email, { displayName: f.name, timezone: TZ }, { inviteCode: f.code }));
  const ids = [iker._id, ...friendUsers.map((u) => u._id)];

  // 2. Wipe previous demo data.
  await Promise.all([
    Session.deleteMany({ userId: { $in: ids } }),
    Goal.deleteMany({ userId: { $in: ids } }),
    TokenTransaction.deleteMany({ userId: { $in: ids } }),
    InventoryItem.deleteMany({ userId: { $in: ids } }),
    Donation.deleteMany({ userId: { $in: ids } }),
    ChallengeProgress.deleteMany({ userId: { $in: ids } }),
    AppUnlock.deleteMany({ userId: { $in: ids } }),
  ]);

  // 3. Build iker's timeline of events.
  const events: Event[] = [];
  const focusIds: Types.ObjectId[] = [];
  DAILY_FOCUS.forEach((total, i) => {
    const day = dayAgo(DAILY_FOCUS.length - 1 - i);
    split(total).forEach((minutes, n) => {
      const id = oid();
      focusIds.push(id);
      let start = at(day, n === 0 ? `${String(9 + (i % 3)).padStart(2, '0')}:${i % 2 ? '30' : '00'}` : '15:00');
      const isToday = day === TODAY;
      if (isToday) start = new Date(Math.min(at(day, '09:00').getTime(), NOW.getTime() - (minutes + 10) * MIN));
      if (dayKey(start, TZ) !== day) return; // too early in the day to have a session yet
      const spec: FocusSpec = { id, day, start, minutes, interruptions: (i * 3 + n) % 7 === 0 ? 1 : 0 };
      events.push({ t: new Date(start.getTime() + minutes * MIN), kind: 'focus', spec });
      if ((i + n) % 2 === 0) {
        const b = BREAKS[(i + n) % BREAKS.length];
        const bStart = new Date(start.getTime() + (minutes + 2) * MIN);
        if (bStart.getTime() + b.minutes * MIN < NOW.getTime()) {
          events.push({ t: new Date(bStart.getTime() + b.minutes * MIN), kind: 'break', id: oid(), afterId: id, day, breakKind: b.kind, minutes: b.minutes, start: bStart });
        }
      }
    });
  });

  // Screen time: under the limit earns the +20 bonus the next morning.
  const screenUsed = new Map<string, number>();
  DAILY_FOCUS.forEach((_, i) => {
    const day = dayAgo(DAILY_FOCUS.length - 1 - i);
    const used = day === TODAY ? 95 : 140 + ((i * 53) % 150);
    screenUsed.set(day, used);
    if (day !== TODAY && used <= SCREEN_LIMIT) events.push({ t: at(addDays(day, 1), '00:10'), kind: 'bonus', amount: RULES.screenLimitBonus, reason: 'screen_limit_kept', day: addDays(day, 1) });
  });

  const owned: { slug: string; at: Date }[] = [];
  const pastUnlocks: { app: string; at: Date; cost: number }[] = [];
  let donation: { slug: string; at: Date } | null = null;
  for (const p of PURCHASES) {
    const day = dayAgo(p.daysAgo);
    const t = at(day, '20:00');
    if (t > NOW) continue;
    if (p.app) {
      const app = APP_CATALOG.find((a) => a.id === p.app)!;
      events.push({ t, kind: 'spend', amount: app.cost, reason: p.reason, day });
      pastUnlocks.push({ app: app.id, at: t, cost: app.cost });
    } else {
      const reward = rewards.get(p.slug!)!;
      events.push({ t, kind: 'spend', amount: reward.cost, reason: p.reason, refId: reward._id, day });
      if (p.reason === 'reward_redeem') owned.push({ slug: reward.slug, at: t });
      if (p.reason === 'donation') donation = { slug: reward.slug, at: t };
    }
  }
  // An unlock that is open right now.
  const spotify = APP_CATALOG.find((a) => a.id === 'spotify')!;
  const spotifyStart = new Date(NOW.getTime() - 2 * MIN);
  events.push({ t: spotifyStart, kind: 'spend', amount: spotify.cost, reason: 'app_unlock', day: TODAY });

  // This week's challenges.
  const challenges = new Map((await Challenge.find()).map((c) => [c.title, c]));
  const weekStart = weekStartUtc(NOW);
  const claimedAt = new Date(Math.max(weekStart.getTime() + 2 * 3600_000, NOW.getTime() - 20 * 3600_000));
  const streakChallenge = challenges.get('Three-Day Streak');
  if (streakChallenge) events.push({ t: claimedAt, kind: 'bonus', amount: streakChallenge.rewardTokens, reason: 'challenge_reward', refId: streakChallenge._id, day: dayKey(claimedAt, TZ) });

  events.sort((a, b) => a.t.getTime() - b.t.getTime());

  // 4. Replay the events through the same rules the server applies.
  let balance = 0;
  let xp = 0;
  let level = 1;
  let streak: Streak = { current: 0, longest: 0, lastActiveDate: null, freezes: 0 };
  const doneByDay = new Map<string, number>();
  const txs: Record<string, unknown>[] = [];
  const sessions: Record<string, unknown>[] = [];

  const credit = (awards: Award[], t: Date, day: string, refId?: Types.ObjectId): Award[] => {
    const credited = awards.filter((a) => a.amount > 0);
    const total = credited.reduce((n, a) => n + a.amount, 0);
    xp += total;
    const newLevel = levelForXp(xp);
    const all = [...credited];
    if (newLevel > level) all.push({ amount: RULES.levelUpBonus * (newLevel - level), reason: 'level_up' });
    level = Math.max(level, newLevel);
    for (const a of all) {
      balance += a.amount;
      txs.push({ _id: oid(), userId: iker._id, amount: a.amount, type: 'earn', reason: a.reason, refId, day, balanceAfter: balance, createdAt: t });
    }
    return all;
  };

  for (const ev of events) {
    if (ev.kind === 'focus') {
      const { spec } = ev;
      const before = doneByDay.get(spec.day) ?? 0;
      const awards = focusAwards({ actualMin: spec.minutes, interruptions: spec.interruptions, focusMinToday: before });
      doneByDay.set(spec.day, before + spec.minutes);
      if (before < GOAL_MIN && before + spec.minutes >= GOAL_MIN) {
        streak = advanceStreak(streak, spec.day);
        awards.push({ amount: RULES.goalBonus, reason: 'goal_achieved' }, { amount: streakBonus(streak.current), reason: 'streak_bonus' });
      }
      const credited = credit(awards, ev.t, spec.day, spec.id);
      sessions.push({
        _id: spec.id, userId: iker._id, type: 'focus', plannedMin: spec.minutes, actualMin: spec.minutes, status: 'completed',
        interruptions: spec.interruptions, startedAt: spec.start, endedAt: ev.t, platform: spec.day.endsWith('5') ? 'android' : 'web',
        tokensAwarded: credited.reduce((n, a) => n + a.amount, 0), awards: credited, createdAt: spec.start, updatedAt: ev.t,
      });
    } else if (ev.kind === 'break') {
      const credited = credit([{ amount: RULES.breakReward, reason: 'break_complete' }], ev.t, ev.day, ev.id);
      sessions.push({
        _id: ev.id, userId: iker._id, type: 'break', breakKind: ev.breakKind, afterSessionId: ev.afterId, plannedMin: ev.minutes,
        actualMin: ev.minutes, status: 'completed', interruptions: 0, startedAt: ev.start, endedAt: ev.t, platform: 'web',
        tokensAwarded: RULES.breakReward, awards: credited, createdAt: ev.start, updatedAt: ev.t,
      });
    } else if (ev.kind === 'bonus') {
      credit([{ amount: ev.amount, reason: ev.reason }], ev.t, ev.day, ev.refId);
    } else {
      if (balance < ev.amount) throw new Error(`Demo timeline overspends: ${ev.reason} of ${ev.amount} at balance ${balance}`);
      balance -= ev.amount;
      txs.push({ _id: oid(), userId: iker._id, amount: -ev.amount, type: 'burn', reason: ev.reason, refId: ev.refId, day: ev.day, balanceAfter: balance, createdAt: ev.t });
    }
  }
  const lastAchieved = [...doneByDay].filter(([, m]) => m >= GOAL_MIN).map(([d]) => d).sort().at(-1) ?? null;
  streak = { ...streak, lastActiveDate: lastAchieved, freezes: PURCHASES.some((p) => p.reason === 'streak_freeze' && at(dayAgo(p.daysAgo), '20:00') <= NOW) ? 1 : 0 };

  // 5. Write everything.
  const col = (m: { collection: mongoose.Collection }) => m.collection;
  await col(Session).insertMany(sessions as never[]);
  await col(TokenTransaction).insertMany(txs as never[]);

  const goals = DAILY_FOCUS.map((_, i) => {
    const day = dayAgo(DAILY_FOCUS.length - 1 - i);
    const done = doneByDay.get(day) ?? 0;
    const used = screenUsed.get(day)!;
    return {
      _id: oid(), userId: iker._id, date: day, focusTargetMin: GOAL_MIN, focusDoneMin: done, screenLimitMin: SCREEN_LIMIT, screenUsedMin: used,
      achieved: done >= GOAL_MIN, screenBonusAwarded: day !== TODAY && used <= SCREEN_LIMIT, createdAt: at(day, '00:00'), updatedAt: at(day, '23:00'),
    };
  });
  await col(Goal).insertMany(goals as never[]);

  await col(InventoryItem).insertMany(owned.map((o) => ({ _id: oid(), userId: iker._id, rewardId: rewards.get(o.slug)!._id, acquiredAt: o.at })) as never[]);
  if (donation) {
    const r = rewards.get(donation.slug)!;
    await col(Donation).insertMany([{ _id: oid(), userId: iker._id, rewardId: r._id, cause: r.cause ?? r.name, tokens: r.cost, status: 'pledged', pledgedAt: donation.at }] as never[]);
  }
  const unlocks = [
    ...pastUnlocks.map((u) => {
      const app = APP_CATALOG.find((a) => a.id === u.app)!;
      return { _id: oid(), userId: iker._id, appId: app.id, tokens: u.cost, startedAt: u.at, expiresAt: new Date(u.at.getTime() + app.minutes * MIN) };
    }),
    { _id: oid(), userId: iker._id, appId: spotify.id, tokens: spotify.cost, startedAt: spotifyStart, expiresAt: new Date(spotifyStart.getTime() + spotify.minutes * MIN) },
  ];
  await col(AppUnlock).insertMany(unlocks as never[]);

  // Challenge progress comes from the data above.
  const weekSessions = sessions.filter((s) => (s.startedAt as Date) >= weekStart);
  const weekFocus = weekSessions.filter((s) => s.type === 'focus').reduce((n, s) => n + (s.actualMin as number), 0);
  const weekBreaks = weekSessions.filter((s) => s.type === 'break').length;
  const progress: [string, number, boolean][] = [
    ['Focus Five', weekFocus, false],
    ['Break Champion', weekBreaks, false],
    ['Three-Day Streak', 3, true],
  ];
  for (const [title, value, claimed] of progress) {
    const c = challenges.get(title);
    if (!c) continue;
    await ChallengeProgress.updateOne(
      { challengeId: c._id, userId: iker._id },
      { $set: { progress: Math.min(value, c.target), completed: value >= c.target, claimedAt: claimed ? claimedAt : null } },
      { upsert: true },
    );
  }

  const equipSlug = { hat: 'hat-crown', outfit: 'outfit-hoodie', background: 'bg-forest' } as const;
  const equipped = Object.fromEntries(Object.entries(equipSlug).filter(([, slug]) => owned.some((o) => o.slug === slug)).map(([slot, slug]) => [slot, rewards.get(slug)!._id]));
  await User.updateOne(
    { _id: iker._id },
    {
      $set: {
        tokenBalance: balance, xp, level, streak, 'avatar.equipped': equipped,
        'settings.dailyFocusGoalMin': GOAL_MIN, 'settings.dailyScreenLimitMin': SCREEN_LIMIT,
        friends: friendUsers.map((u) => u._id), lastRolloverDate: TODAY,
      },
    },
  );

  // 6. Friends with a week of focus, so the leaderboards have people on them.
  for (const [k, f] of FRIENDS.entries()) {
    const u = friendUsers[k];
    const rows = f.minutes.map((m, j) => {
      const start = new Date(Math.max(weekStart.getTime() + (j + 1) * MIN, NOW.getTime() - (j + 1) * 9 * 3600_000 - k * 30 * MIN));
      return {
        _id: oid(), userId: u._id, type: 'focus', plannedMin: m, actualMin: m, status: 'completed', interruptions: 0, startedAt: start,
        endedAt: new Date(start.getTime() + m * MIN), platform: 'web', tokensAwarded: m, awards: [{ amount: m, reason: 'focus_complete' }],
        createdAt: start, updatedAt: start,
      };
    });
    const earned = f.minutes.reduce((n, m) => n + m, 0) + f.streak * 30;
    await col(Session).insertMany(rows as never[]);
    await col(TokenTransaction).insertMany([{ _id: oid(), userId: u._id, amount: earned, type: 'earn', reason: 'focus_complete', day: TODAY, balanceAfter: earned, createdAt: NOW }] as never[]);
    await User.updateOne(
      { _id: u._id },
      { $set: { tokenBalance: earned, xp: earned, level: levelForXp(earned), streak: { current: f.streak, longest: f.streak, lastActiveDate: TODAY, freezes: 0 }, friends: [iker._id], lastRolloverDate: TODAY } },
    );
  }

  const ledger = txs.reduce((n, t) => n + (t.amount as number), 0);
  console.log(`Demo data for iker: balance ${balance} (ledger sum ${ledger}), level ${level}, streak ${streak.current} (best ${streak.longest}), freezes ${streak.freezes}`);
  console.log(`  ${sessions.length} sessions, ${txs.length} ledger rows, ${owned.length} avatar items, ${unlocks.length} app unlocks, ${FRIENDS.length} friends`);
  console.log(`  this week: ${weekFocus} focus min, ${weekBreaks} breaks`);
  if (ledger !== balance) throw new Error('Ledger does not add up to the balance');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
