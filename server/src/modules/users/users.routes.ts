import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { dayKey, isValidTimeZone } from '../../utils/date';
import { Challenge, ChallengeProgress } from '../challenges/challenge.model';
import { getOrCreateGoal } from '../goals/goal.model';
import { AVATAR_SLOTS, InventoryItem } from '../rewards/reward.model';
import { User } from './user.model';

const router = Router();

async function me(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

router.get('/', async (req, res) => {
  res.json({ user: await me(uid(req)) });
});

const patchBody = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  timezone: z.string().refine(isValidTimeZone, 'unknown time zone').optional(),
  settings: z
    .object({
      dailyFocusGoalMin: z.number().int().min(10).max(480).optional(),
      dailyScreenLimitMin: z.number().int().min(15).max(1440).optional(),
      breakReminders: z.boolean().optional(),
    })
    .optional(),
});

router.patch('/', async (req, res) => {
  const { settings, ...rest } = patchBody.parse(req.body);
  const update: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(settings ?? {})) update[`settings.${key}`] = value;
  const user = await User.findByIdAndUpdate(uid(req), { $set: update }, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user });
});

/** Everything the dashboard screen needs in one call. */
router.get('/dashboard', async (req, res) => {
  const user = await me(uid(req));
  const now = new Date();
  const goal = await getOrCreateGoal(user, dayKey(now, user.timezone));
  const progress = await ChallengeProgress.find({ userId: user._id, claimedAt: null });
  const challenges = await Challenge.find({ _id: { $in: progress.map((p) => p.challengeId) }, endsAt: { $gte: now } });
  res.json({
    user,
    goal,
    challenges: challenges.map((c) => ({ challenge: c, progress: progress.find((p) => p.challengeId.equals(c._id)) })),
  });
});

const deviceBody = z.object({ fcmToken: z.string().min(10) });

router.post('/devices', async (req, res) => {
  const { fcmToken } = deviceBody.parse(req.body);
  await User.updateOne({ _id: uid(req) }, { $addToSet: { fcmTokens: fcmToken } });
  res.status(204).end();
});

const avatarBody = z.object({
  slot: z.enum(AVATAR_SLOTS),
  rewardId: z.string().refine(Types.ObjectId.isValid, 'invalid id').nullable(),
});

/** Equip an owned item in a slot, or clear the slot with rewardId: null. */
router.put('/avatar', async (req, res) => {
  const userId = uid(req);
  const { slot, rewardId } = avatarBody.parse(req.body);
  if (rewardId) {
    const item = await InventoryItem.findOne({ userId, rewardId }).populate<{ rewardId: { slot?: string } }>('rewardId');
    if (!item) throw new HttpError(403, "You don't own that item");
    if (item.rewardId.slot !== slot) throw new HttpError(400, `That item doesn't go in the ${slot} slot`);
  }
  const update = rewardId ? { $set: { [`avatar.equipped.${slot}`]: new Types.ObjectId(rewardId) } } : { $unset: { [`avatar.equipped.${slot}`]: 1 } };
  const user = await User.findByIdAndUpdate(userId, update, { new: true });
  res.json({ user });
});

export default router;
