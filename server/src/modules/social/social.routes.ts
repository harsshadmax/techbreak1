import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { weekStartUtc } from '../../utils/date';
import { Session } from '../sessions/session.model';
import { User } from '../users/user.model';

const router = Router();

const leaderboardQuery = z.object({ scope: z.enum(['global', 'friends']).default('global') });

/** This week's ranking by completed focus minutes. */
router.get('/leaderboard', async (req, res) => {
  const { scope } = leaderboardQuery.parse(req.query);
  const me = await User.findById(uid(req), { friends: 1 });
  if (!me) throw new HttpError(404, 'User not found');

  const match: Record<string, unknown> = { type: 'focus', status: 'completed', startedAt: { $gte: weekStartUtc() } };
  if (scope === 'friends') match.userId = { $in: [me._id, ...me.friends] };

  const rows = await Session.aggregate<{ userId: string; focusMin: number; displayName: string; avatar: string; level: number }>([
    { $match: match },
    { $group: { _id: '$userId', focusMin: { $sum: '$actualMin' } } },
    { $sort: { focusMin: -1 } },
    { $limit: 50 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 0, userId: '$_id', focusMin: 1, displayName: '$user.displayName', avatar: '$user.avatar.base', level: '$user.level' } },
  ]);

  res.json({
    weekStart: weekStartUtc(),
    entries: rows.map((r, i) => ({ ...r, rank: i + 1, isMe: String(r.userId) === me.id })),
  });
});

router.get('/friends', async (req, res) => {
  const me = await User.findById(uid(req)).populate<{ friends: { id: string; displayName: string; level: number; streak: { current: number } }[] }>(
    'friends',
    'displayName level streak avatar',
  );
  if (!me) throw new HttpError(404, 'User not found');
  res.json({ items: me.friends });
});

const addFriendBody = z.object({ inviteCode: z.string().trim().min(4).max(16) });

/** Friendship is mutual and created from the other user's invite code. */
router.post('/friends', async (req, res) => {
  const userId = uid(req);
  const { inviteCode } = addFriendBody.parse(req.body);
  const friend = await User.findOne({ inviteCode: inviteCode.toUpperCase() });
  if (!friend) throw new HttpError(404, 'No user with that invite code');
  if (friend.id === userId) throw new HttpError(400, "That's your own invite code");
  await User.updateOne({ _id: userId }, { $addToSet: { friends: friend._id } });
  await User.updateOne({ _id: friend._id }, { $addToSet: { friends: userId } });
  res.status(201).json({ friend: { id: friend.id, displayName: friend.displayName, level: friend.level } });
});

export default router;
