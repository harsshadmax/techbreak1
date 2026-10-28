import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { dayKey } from '../../utils/date';
import { RULES } from '../tokens/engine';
import { spend } from '../tokens/ledger';
import { User } from '../users/user.model';
import { Donation, InventoryItem, REWARD_KINDS, Reward } from './reward.model';

const router = Router();

const listQuery = z.object({ kind: z.enum(REWARD_KINDS).optional() });

router.get('/rewards', async (req, res) => {
  const { kind } = listQuery.parse(req.query);
  res.json({ items: await Reward.find({ active: true, ...(kind ? { kind } : {}) }).sort({ kind: 1, cost: 1 }) });
});

/** Spend tokens on a reward. Avatar items go to the inventory, donations are pledged, perks apply immediately. */
router.post('/rewards/:id/redeem', async (req, res) => {
  const userId = uid(req);
  if (!Types.ObjectId.isValid(req.params.id)) throw new HttpError(400, 'invalid reward id');

  const result = await mongoose.connection.transaction(async (tx) => {
    const reward = await Reward.findOne({ _id: req.params.id, active: true }).session(tx);
    if (!reward) throw new HttpError(404, 'Reward not found');
    const user = await User.findById(userId).session(tx);
    if (!user) throw new HttpError(404, 'User not found');
    const day = dayKey(new Date(), user.timezone);

    switch (reward.kind) {
      case 'avatar_item': {
        if (await InventoryItem.exists({ userId, rewardId: reward._id }).session(tx)) throw new HttpError(409, 'You already own this item');
        await spend(userId, reward.cost, 'reward_redeem', { day, refId: reward._id, tx });
        await InventoryItem.create([{ userId, rewardId: reward._id }], { session: tx });
        break;
      }
      case 'donation': {
        await spend(userId, reward.cost, 'donation', { day, refId: reward._id, tx });
        await Donation.create([{ userId, rewardId: reward._id, cause: reward.cause ?? reward.name, tokens: reward.cost }], { session: tx });
        break;
      }
      case 'perk': {
        if (reward.slug !== 'streak_freeze') throw new HttpError(400, 'Unknown perk');
        if (user.streak.freezes >= RULES.maxStreakFreezes) throw new HttpError(409, `You can hold at most ${RULES.maxStreakFreezes} streak freezes`);
        await spend(userId, reward.cost, 'streak_freeze', { day, refId: reward._id, tx });
        await User.updateOne({ _id: userId }, { $inc: { 'streak.freezes': 1 } }, { session: tx });
        break;
      }
    }
    return User.findById(userId).session(tx);
  });

  res.json({ user: result });
});

router.get('/inventory', async (req, res) => {
  res.json({ items: await InventoryItem.find({ userId: uid(req) }).populate('rewardId').sort({ acquiredAt: -1 }) });
});

router.get('/donations', async (req, res) => {
  const items = await Donation.find({ userId: uid(req) }).sort({ pledgedAt: -1 });
  const totalTokens = items.reduce((n, d) => n + d.tokens, 0);
  res.json({ items, totalTokens });
});

export default router;
