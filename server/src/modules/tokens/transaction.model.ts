import { Schema, model, type Types } from 'mongoose';
import type { BurnReason, EarnReason } from './engine';

export interface ITokenTransaction {
  userId: Types.ObjectId;
  amount: number;
  type: 'earn' | 'burn';
  reason: EarnReason | BurnReason;
  refId?: Types.ObjectId;
  /** User-local day the transaction belongs to (for the daily cap). */
  day: string;
  balanceAfter: number;
  createdAt: Date;
}

const schema = new Schema<ITokenTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['earn', 'burn'], required: true },
    reason: { type: String, required: true },
    refId: Schema.Types.ObjectId,
    day: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, day: 1 });

export const TokenTransaction = model<ITokenTransaction>('TokenTransaction', schema, 'token_transactions');
