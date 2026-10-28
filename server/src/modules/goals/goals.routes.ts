import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { dayKey } from '../../utils/date';
import { User } from '../users/user.model';
import { getOrCreateGoal } from './goal.model';

const router = Router();

async function loadToday(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found');
  return getOrCreateGoal(user, dayKey(new Date(), user.timezone));
}

router.get('/today', async (req, res) => {
  res.json({ goal: await loadToday(uid(req)) });
});

const targetsBody = z
  .object({
    focusTargetMin: z.number().int().min(10).max(480).optional(),
    screenLimitMin: z.number().int().min(15).max(1440).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

router.put('/today', async (req, res) => {
  const body = targetsBody.parse(req.body);
  const goal = await loadToday(uid(req));
  if (goal.achieved && body.focusTargetMin !== undefined) throw new HttpError(409, "Today's focus goal is already achieved");
  Object.assign(goal, body);
  await goal.save();
  res.json({ goal });
});

const screenBody = z.object({ minutes: z.number().int().min(0).max(1440) });

/** Report today's total screen time (manual entry in the MVP, device data later). */
router.post('/today/screen-time', async (req, res) => {
  const { minutes } = screenBody.parse(req.body);
  const goal = await loadToday(uid(req));
  goal.screenUsedMin = minutes;
  await goal.save();
  res.json({ goal });
});

export default router;
