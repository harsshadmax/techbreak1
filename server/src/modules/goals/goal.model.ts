import { Schema, model, type ClientSession, type Types } from 'mongoose';
import { HttpError } from '../../middleware/errors';
import type { UserDoc } from '../users/user.model';

export interface IGoal {
  userId: Types.ObjectId;
  date: string;
  focusTargetMin: number;
  focusDoneMin: number;
  screenLimitMin: number;
  screenUsedMin: number | null;
  achieved: boolean;
  screenBonusAwarded: boolean;
}

const schema = new Schema<IGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    focusTargetMin: { type: Number, required: true },
    focusDoneMin: { type: Number, default: 0 },
    screenLimitMin: { type: Number, required: true },
    screenUsedMin: { type: Number, default: null },
    achieved: { type: Boolean, default: false },
    screenBonusAwarded: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

schema.index({ userId: 1, date: 1 }, { unique: true });

export const Goal = model<IGoal>('Goal', schema);

/** Today's goal, created from the user's default targets on first access. */
export async function getOrCreateGoal(user: UserDoc, date: string, tx?: ClientSession) {
  const goal = await Goal.findOneAndUpdate(
    { userId: user._id, date },
    { $setOnInsert: { focusTargetMin: user.settings.dailyFocusGoalMin, screenLimitMin: user.settings.dailyScreenLimitMin } },
    { upsert: true, new: true, session: tx },
  );
  if (!goal) throw new HttpError(500, 'Could not load goal');
  return goal;
}
