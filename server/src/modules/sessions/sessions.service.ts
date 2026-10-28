import mongoose, { type Types } from 'mongoose';
import { HttpError } from '../../middleware/errors';
import { dayKey } from '../../utils/date';
import { bumpChallenges } from '../challenges/challenge.model';
import { getOrCreateGoal } from '../goals/goal.model';
import {
  RULES,
  advanceStreak,
  applyDailyCap,
  breakAwards,
  focusAwards,
  sessionMinutes,
  streakBonus,
  sumAwards,
  type Award,
} from '../tokens/engine';
import { cappedEarnedToday, grant } from '../tokens/ledger';
import { User } from '../users/user.model';
import { Session, type ISession } from './session.model';

type StartInput = Pick<ISession, 'type' | 'plannedMin' | 'platform'> & {
  breakKind?: ISession['breakKind'];
  afterSessionId?: string;
};

export async function startSession(userId: string, input: StartInput) {
  // Only one running session per user: starting a new one abandons the old one.
  await Session.updateMany({ userId, status: 'active' }, { $set: { status: 'abandoned', endedAt: new Date() } });
  return Session.create({ ...input, userId, startedAt: new Date() });
}

export async function reportInterruption(userId: string, sessionId: string) {
  const session = await Session.findOneAndUpdate({ _id: sessionId, userId, status: 'active' }, { $inc: { interruptions: 1 } }, { new: true });
  if (!session) throw new HttpError(404, 'No active session with that id');
  return session;
}

export async function abandonSession(userId: string, sessionId: string) {
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, userId, status: 'active' },
    { $set: { status: 'abandoned', endedAt: new Date() } },
    { new: true },
  );
  if (!session) throw new HttpError(404, 'No active session with that id');
  return session;
}

/**
 * Complete a session and award tokens. Idempotent: completing an already
 * completed session returns the original awards without paying again.
 */
export async function completeSession(userId: string, sessionId: string) {
  return mongoose.connection.transaction(async (tx) => {
    const now = new Date();
    const user = await User.findById(userId).session(tx);
    if (!user) throw new HttpError(404, 'User not found');

    const session = await Session.findOneAndUpdate(
      { _id: sessionId, userId, status: 'active' },
      { $set: { status: 'completed', endedAt: now } },
      { new: true, session: tx },
    );
    if (!session) {
      const existing = await Session.findOne({ _id: sessionId, userId }).session(tx);
      if (!existing) throw new HttpError(404, 'Session not found');
      if (existing.status === 'completed') return { session: existing, awards: existing.awards, alreadyCompleted: true };
      throw new HttpError(409, 'Session was abandoned');
    }

    session.actualMin = sessionMinutes(session.startedAt, now, session.plannedMin);
    const today = dayKey(now, user.timezone);
    const goal = await getOrCreateGoal(user, today, tx);
    let awards: Award[] = [];

    if (session.type === 'focus') {
      awards = focusAwards({ actualMin: session.actualMin, interruptions: session.interruptions, focusMinToday: goal.focusDoneMin });
      if (session.actualMin >= RULES.minFocusMin) {
        goal.focusDoneMin += session.actualMin;
        await bumpChallenges(userId, 'focus_minutes', { inc: session.actualMin }, tx);
      }
      if (!goal.achieved && goal.focusDoneMin >= goal.focusTargetMin) {
        goal.achieved = true;
        const streak = advanceStreak(user.streak, today);
        await User.updateOne({ _id: user._id }, { $set: { streak } }, { session: tx });
        awards.push({ amount: RULES.goalBonus, reason: 'goal_achieved' });
        awards.push({ amount: streakBonus(streak.current), reason: 'streak_bonus' });
        await bumpChallenges(userId, 'streak_days', { set: streak.current }, tx);
      }
    } else {
      awards = await breakAwardsFor(userId, session, tx);
      if (session.actualMin >= RULES.minBreakMin) await bumpChallenges(userId, 'breaks', { inc: 1 }, tx);
    }

    awards = applyDailyCap(awards, await cappedEarnedToday(userId, today, tx));
    const credited = await grant(userId, awards, { day: today, refId: session._id, tx });

    session.awards = credited;
    session.tokensAwarded = sumAwards(credited);
    await session.save({ session: tx });
    await goal.save({ session: tx });
    return { session, awards: credited, alreadyCompleted: false };
  });
}

async function breakAwardsFor(userId: string, session: { _id: Types.ObjectId; afterSessionId?: Types.ObjectId; startedAt: Date; actualMin: number }, tx: mongoose.ClientSession) {
  if (!session.afterSessionId) return [];
  const focus = await Session.findOne({ _id: session.afterSessionId, userId, type: 'focus', status: 'completed' }).session(tx);
  const alreadyRewarded = !!(await Session.exists({
    afterSessionId: session.afterSessionId,
    type: 'break',
    status: 'completed',
    tokensAwarded: { $gt: 0 },
    _id: { $ne: session._id },
  }).session(tx));
  return breakAwards({ actualMin: session.actualMin, focusEndedAt: focus?.endedAt ?? null, breakStartedAt: session.startedAt, alreadyRewarded });
}
