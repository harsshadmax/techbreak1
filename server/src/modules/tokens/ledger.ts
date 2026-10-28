/**
 * Applies token changes. Every call must run inside a MongoDB transaction so the
 * ledger rows and the cached `tokenBalance` on the user never drift apart.
 */
import type { ClientSession, Types } from 'mongoose';
import { HttpError } from '../../middleware/errors';
import { User } from '../users/user.model';
import { CAPPED_REASONS, RULES, levelForXp, sumAwards, type Award, type BurnReason } from './engine';
import { TokenTransaction } from './transaction.model';

interface LedgerOpts {
  day: string;
  refId?: Types.ObjectId | string;
  tx: ClientSession;
}

/** Credit awards (plus any level-up bonus they trigger). Returns everything actually credited. */
export async function grant(userId: Types.ObjectId | string, awards: Award[], { day, refId, tx }: LedgerOpts): Promise<Award[]> {
  const credited = awards.filter((a) => a.amount > 0);
  if (credited.length === 0) return [];
  const total = sumAwards(credited);

  const user = await User.findByIdAndUpdate(userId, { $inc: { tokenBalance: total, xp: total } }, { new: true, session: tx });
  if (!user) throw new HttpError(404, 'User not found');

  const newLevel = levelForXp(user.xp);
  if (newLevel > user.level) {
    // Level-up bonus adds tokens but not XP, so it can't cascade into further level-ups.
    const bonus = RULES.levelUpBonus * (newLevel - user.level);
    credited.push({ amount: bonus, reason: 'level_up' });
    await User.updateOne({ _id: userId }, { $set: { level: newLevel }, $inc: { tokenBalance: bonus } }, { session: tx });
  }

  let balance = user.tokenBalance - total;
  await TokenTransaction.insertMany(
    credited.map((a) => {
      balance += a.amount;
      return { userId, amount: a.amount, type: 'earn', reason: a.reason, refId, day, balanceAfter: balance };
    }),
    { session: tx },
  );
  return credited;
}

/** Debit tokens. Fails with 402 rather than letting the balance go negative. */
export async function spend(userId: Types.ObjectId | string, amount: number, reason: BurnReason, { day, refId, tx }: LedgerOpts) {
  const user = await User.findOneAndUpdate(
    { _id: userId, tokenBalance: { $gte: amount } },
    { $inc: { tokenBalance: -amount } },
    { new: true, session: tx },
  );
  if (!user) throw new HttpError(402, 'Not enough tokens');
  await TokenTransaction.create(
    [{ userId, amount: -amount, type: 'burn', reason, refId, day, balanceAfter: user.tokenBalance }],
    { session: tx },
  );
  return user;
}

/** Tokens earned today from capped (activity) reasons. */
export async function cappedEarnedToday(userId: Types.ObjectId | string, day: string, tx: ClientSession): Promise<number> {
  const rows = await TokenTransaction.find({ userId, day, type: 'earn', reason: { $in: CAPPED_REASONS } }, { amount: 1 }).session(tx);
  return rows.reduce((n, r) => n + r.amount, 0);
}
