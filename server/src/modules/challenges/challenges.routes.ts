import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { uid } from '../../middleware/auth';
import { HttpError } from '../../middleware/errors';
import { dayKey } from '../../utils/date';
import { grant } from '../tokens/ledger';
import { User } from '../users/user.model';
import { Challenge, ChallengeProgress } from './challenge.model';

const router = Router();

function challengeId(raw: string) {
  if (!Types.ObjectId.isValid(raw)) throw new HttpError(400, 'invalid challenge id');
  return raw;
}

/** Active challenges with the caller's progress (null if not joined). */
router.get('/', async (req, res) => {
  const now = new Date();
  const challenges = await Challenge.find({ startsAt: { $lte: now }, endsAt: { $gte: now } }).sort({ endsAt: 1 });
  const progress = await ChallengeProgress.find({ userId: uid(req), challengeId: { $in: challenges.map((c) => c._id) } });
  res.json({
    items: challenges.map((c) => ({ challenge: c, progress: progress.find((p) => p.challengeId.equals(c._id)) ?? null })),
  });
});

router.post('/:id/join', async (req, res) => {
  const now = new Date();
  const challenge = await Challenge.findOne({ _id: challengeId(req.params.id), startsAt: { $lte: now }, endsAt: { $gte: now } });
  if (!challenge) throw new HttpError(404, 'No active challenge with that id');
  const progress = await ChallengeProgress.findOneAndUpdate(
    { challengeId: challenge._id, userId: uid(req) },
    { $setOnInsert: { progress: 0, completed: false, claimedAt: null } },
    { upsert: true, new: true },
  );
  res.status(201).json({ progress });
});

router.post('/:id/claim', async (req, res) => {
  const userId = uid(req);
  const id = challengeId(req.params.id);
  const awards = await mongoose.connection.transaction(async (tx) => {
    const progress = await ChallengeProgress.findOneAndUpdate(
      { challengeId: id, userId, completed: true, claimedAt: null },
      { $set: { claimedAt: new Date() } },
      { new: true, session: tx },
    );
    if (!progress) throw new HttpError(409, 'Challenge not completed or already claimed');
    const challenge = await Challenge.findById(id).session(tx);
    const user = await User.findById(userId).session(tx);
    if (!challenge || !user) throw new HttpError(404, 'Not found');
    return grant(userId, [{ amount: challenge.rewardTokens, reason: 'challenge_reward' }], {
      day: dayKey(new Date(), user.timezone),
      refId: challenge._id,
      tx,
    });
  });
  res.json({ awards });
});

export default router;
