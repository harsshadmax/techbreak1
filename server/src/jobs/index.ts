import cron from 'node-cron';
import mongoose from 'mongoose';
import { sendPush } from '../integrations/push';
import { Goal } from '../modules/goals/goal.model';
import { RULES, rolloverStreak } from '../modules/tokens/engine';
import { grant } from '../modules/tokens/ledger';
import { User, type UserDoc } from '../modules/users/user.model';
import { addDays, dayKey, localHour } from '../utils/date';

/**
 * Users live in different time zones, so the job runs hourly and handles each
 * user whose local day has changed since their last rollover.
 */
export async function runHourly(now = new Date()): Promise<void> {
  for await (const user of User.find({}, { timezone: 1, streak: 1, lastRolloverDate: 1, fcmTokens: 1, settings: 1 })) {
    const today = dayKey(now, user.timezone);
    try {
      if (user.lastRolloverDate !== today) await rolloverUser(user, today);
      if (localHour(now, user.timezone) === 20) await streakReminder(user, today);
    } catch (err) {
      console.error(`rollover failed for ${user.id}`, err);
    }
  }
}

async function rolloverUser(user: UserDoc, today: string) {
  const yesterday = addDays(today, -1);
  await mongoose.connection.transaction(async (tx) => {
    const { streak } = rolloverStreak(user.streak, today);
    await User.updateOne({ _id: user._id }, { $set: { streak, lastRolloverDate: today } }, { session: tx });

    // "Stayed under screen limit" can only be judged once the day is over.
    const goal = await Goal.findOneAndUpdate(
      { userId: user._id, date: yesterday, screenBonusAwarded: false, screenUsedMin: { $ne: null } },
      { $set: { screenBonusAwarded: true } },
      { new: true, session: tx },
    );
    if (goal && goal.screenUsedMin !== null && goal.screenUsedMin <= goal.screenLimitMin) {
      await grant(user._id, [{ amount: RULES.screenLimitBonus, reason: 'screen_limit_kept' }], { day: yesterday, refId: goal._id, tx });
    }
  });
}

async function streakReminder(user: UserDoc, today: string) {
  if (user.streak.current === 0 || user.streak.lastActiveDate === today || !user.settings.breakReminders) return;
  const goal = await Goal.findOne({ userId: user._id, date: today });
  const left = goal ? Math.max(0, goal.focusTargetMin - goal.focusDoneMin) : user.settings.dailyFocusGoalMin;
  await sendPush(user.id, 'Keep your streak alive 🔥', `${left} more focus minutes keeps your ${user.streak.current}-day streak going.`);
}

export function startJobs() {
  cron.schedule('5 * * * *', () => {
    runHourly().catch((err) => console.error('hourly job failed', err));
  });
}
