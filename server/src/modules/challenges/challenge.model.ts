import { Schema, model, type ClientSession, type Types } from 'mongoose';

export const CHALLENGE_METRICS = ['focus_minutes', 'breaks', 'streak_days'] as const;
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

export interface IChallenge {
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  startsAt: Date;
  endsAt: Date;
  rewardTokens: number;
  scope: 'global' | 'friends' | 'group';
}

const challengeSchema = new Schema<IChallenge>(
  {
    title: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    metric: { type: String, enum: CHALLENGE_METRICS, required: true },
    target: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    rewardTokens: { type: Number, required: true },
    scope: { type: String, enum: ['global', 'friends', 'group'], default: 'global' },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

export const Challenge = model<IChallenge>('Challenge', challengeSchema);

export interface IChallengeProgress {
  challengeId: Types.ObjectId;
  userId: Types.ObjectId;
  progress: number;
  completed: boolean;
  claimedAt: Date | null;
}

const progressSchema = new Schema<IChallengeProgress>(
  {
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

progressSchema.index({ challengeId: 1, userId: 1 }, { unique: true });

export const ChallengeProgress = model<IChallengeProgress>('ChallengeProgress', progressSchema, 'challenge_progress');

/** Advance the user's progress on every active, joined challenge that tracks `metric`. */
export async function bumpChallenges(
  userId: Types.ObjectId | string,
  metric: ChallengeMetric,
  change: { inc: number } | { set: number },
  tx: ClientSession,
): Promise<void> {
  const now = new Date();
  const active = await Challenge.find({ metric, startsAt: { $lte: now }, endsAt: { $gte: now } }, { target: 1 }).session(tx);
  for (const challenge of active) {
    const progress = await ChallengeProgress.findOne({ challengeId: challenge._id, userId, completed: false }).session(tx);
    if (!progress) continue; // not joined, or already completed
    progress.progress = 'inc' in change ? progress.progress + change.inc : Math.max(progress.progress, change.set);
    if (progress.progress >= challenge.target) progress.completed = true;
    await progress.save({ session: tx });
  }
}
