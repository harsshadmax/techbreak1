import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { User } from '../users/user.model';
import { TokenTransaction } from './transaction.model';

const router = Router();

router.get('/balance', async (req, res) => {
  const user = await User.findById(uid(req), { tokenBalance: 1, xp: 1, level: 1 });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ tokenBalance: user.tokenBalance, xp: user.xp, level: user.level });
});

const listQuery = z.object({
  before: z.string().refine(Types.ObjectId.isValid, 'invalid cursor').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

router.get('/transactions', async (req, res) => {
  const { before, limit } = listQuery.parse(req.query);
  const filter: Record<string, unknown> = { userId: uid(req) };
  if (before) filter._id = { $lt: new Types.ObjectId(before) };
  const items = await TokenTransaction.find(filter).sort({ _id: -1 }).limit(limit);
  res.json({ items, nextCursor: items.length === limit ? items[items.length - 1]._id : null });
});

export default router;
